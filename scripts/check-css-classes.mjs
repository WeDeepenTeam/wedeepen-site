#!/usr/bin/env node
/**
 * check-css-classes.mjs — guard against a class disappearing from the build.
 *
 * Compiled Tailwind only emits the utilities it can find in the HTML it scans,
 * so the failure mode of `npm run css:build` is silent: a class stays in the
 * markup, its rule never gets generated, and the page renders unstyled in that
 * one spot. This walks every page, takes each utility-shaped class it uses, and
 * checks the rule exists in the stylesheet that page links (or in the page's
 * own <style> block).
 *
 * Run: npm run css:classes
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'tmp', 'scripts', 'images', 'infra', '.git', 'css']);

/**
 * Classes that are not Tailwind utilities and are never expected in the CSS:
 * JS hooks, third-party widget ids, and component classes each page styles in
 * its own <style> block. Plus three opacity values that are not on Tailwind's
 * scale (it goes ...90, 95, 100), so they generated nothing under the CDN
 * either and are dead in the markup today.
 */
const EXPECTED_ABSENT = new Set([
  'wd-header', 'faq-trigger', 'drawer-link', 'btn-rose',
  'hc-track', 'hc-prev', 'hc-next', 'hc-dots', 'hc-dot',
  'bg-ink/98', 'border-white/12', 'text-white/72',
]);
const EXPECTED_ABSENT_RE = [/^elfsight-app-/];

// Tailwind escapes a class name into a selector: specials take a backslash,
// and a comma becomes the CSS hex escape `\2c ` (trailing space included).
// Order matters, or the backslash inserted for the comma gets escaped in turn.
const escape = (c) => c.replace(/[.*+?^${}()|[\]\\/:%#!&='"<>@~]/g, (m) => '\\' + m).replace(/,/g, '\\2c ');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const sheets = new Map();
async function sheet(name) {
  if (!sheets.has(name)) sheets.set(name, await fs.readFile(path.join(ROOT, 'css', `${name}.css`), 'utf-8'));
  return sheets.get(name);
}

const missing = new Map();
let pages = 0;

for (const file of (await walk(ROOT)).sort()) {
  const html = await fs.readFile(file, 'utf-8');
  const link = html.match(/<link rel="stylesheet" href="\/css\/([a-z0-9-]+)\.css">/);
  if (!link) continue;
  pages++;
  const css = await sheet(link[1]);
  const inline = (html.match(/<style>[\s\S]*?<\/style>/g) ?? []).join('\n');
  const tokens = new Set();
  for (const m of html.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g))
    for (const t of m[1].split(/\s+/)) if (t) tokens.add(t);

  for (const token of tokens) {
    if (/\$\{|^[A-Z]/.test(token)) continue;                            // template holes, component names
    if (!/^(-?[a-z]+[a-z0-9]*[:/[\]().%#-]|[a-z]+-)/.test(token)) continue; // not utility-shaped
    if (EXPECTED_ABSENT.has(token) || EXPECTED_ABSENT_RE.some((r) => r.test(token))) continue;
    const selector = '.' + escape(token);
    if (css.includes(selector) || inline.includes(selector)) continue;
    if (!missing.has(token)) missing.set(token, []);
    missing.get(token).push(path.relative(ROOT, file));
  }
}

if (missing.size) {
  console.error(`css: ${missing.size} class(es) used but never generated across ${pages} pages.`);
  console.error('Run `npm run css:build`, or add the class to EXPECTED_ABSENT if it is not a Tailwind utility.');
  for (const [token, files] of [...missing].sort((a, b) => b[1].length - a[1].length))
    console.error(`  ${token}  (${files.length} page(s), e.g. ${files[0]})`);
  process.exit(1);
}
console.log(`css: every utility used on ${pages} pages resolves`);

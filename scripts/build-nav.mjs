#!/usr/bin/env node
/**
 * build-nav.mjs — stamp the site nav into every page.
 *
 * The nav is defined once in scripts/nav/links.json. This script rewrites the
 * link list inside every page's desktop and mobile nav, marking the current
 * page as active. Pages keep their own header/wrapper markup; only the block
 * between <!-- nav:links --> and <!-- /nav:links --> is regenerated.
 *
 * First run on a page without markers: finds the legacy link run (from the
 * Love Immersion link or dropdown through the Podcast link) and replaces it.
 *
 * Run from anywhere: `node scripts/build-nav.mjs`   (or `npm run nav:sync`)
 * Add --check to exit non-zero if any page is out of date (no writes).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNavLinks, START, END } from './nav/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'tmp', '.git', 'scripts']);
const CHECK = process.argv.includes('--check');

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

function pagePathOf(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  return '/' + rel.replace(/index\.html$/, '');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Block already stamped: <indent><!-- nav:links --> ... <!-- /nav:links -->
const MARKED = new RegExp(`^([ \\t]*)${esc(START)}[\\s\\S]*?${esc(END)}`, 'gm');

// Legacy runs, desktop and mobile. Each starts at either the plain Love
// Immersion link or its dropdown wrapper and ends at the Podcast link.
const LEGACY_DESKTOP = /^([ \t]*)(?:<a href="\/love-immersion\/[^"]*" class="[^"]*">Love Immersion<\/a>|<div class="relative group">[\s\S]*?\n\1<\/div>)\n(?:[ \t]*<a href="\/[^"]*" class="[^"]*">[^<]*<\/a>\n)*?[ \t]*<a href="\/podcast\/" class="[^"]*">Podcast<\/a>/m;
const LEGACY_MOBILE = /^([ \t]*)(?:<a href="\/love-immersion\/[^"]*" class="[^"]*">Love Immersion<\/a>|<div class="flex flex-col gap-4">[\s\S]*?\n\1<\/div>)\n(?:[ \t]*<a href="\/[^"]*" class="[^"]*">[^<]*<\/a>\n)*?[ \t]*<a href="\/podcast\/" class="[^"]*">Podcast<\/a>/m;

function stamp(html, pagePath) {
  let desktopDone = false;
  // Marked blocks: first is desktop, second is mobile (document order).
  let out = html.replace(MARKED, (_, indent) => {
    const v = desktopDone ? 'mobile' : 'desktop';
    desktopDone = true;
    return renderNavLinks(v, pagePath, indent);
  });
  if (desktopDone) return out;

  // Legacy page: desktop nav comes first in the document, mobile second.
  const d = out.match(LEGACY_DESKTOP);
  if (!d) return null;
  const desktop = renderNavLinks('desktop', pagePath, d[1]);
  out = out.slice(0, d.index) + desktop + out.slice(d.index + d[0].length);
  // Search for the mobile run only after the block we just inserted
  const from = d.index + desktop.length;
  const m = out.slice(from).match(LEGACY_MOBILE);
  if (!m) return null;
  const at = from + m.index;
  out = out.slice(0, at) + renderNavLinks('mobile', pagePath, m[1]) + out.slice(at + m[0].length);
  return out;
}

let changed = 0, same = 0;
const skipped = [];
for await (const file of walk(ROOT)) {
  const html = await fs.readFile(file, 'utf8');
  const next = stamp(html, pagePathOf(file));
  if (next === null) { skipped.push(path.relative(ROOT, file)); continue; }
  if (next === html) { same++; continue; }
  changed++;
  if (!CHECK) await fs.writeFile(file, next);
}

console.log(`nav: ${changed} page(s) ${CHECK ? 'out of date' : 'updated'}, ${same} unchanged`);
if (skipped.length) console.log(`nav: skipped (no recognizable nav): ${skipped.join(', ')}`);
if (CHECK && changed) process.exit(1);

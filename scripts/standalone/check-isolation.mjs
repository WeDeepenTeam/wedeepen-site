#!/usr/bin/env node
/**
 * check-isolation.mjs — keep the standalone sections standalone.
 *
 * Standalone sections (scripts/standalone/sections.json) link out
 * to the main site, but the main site must not link in. This walks every
 * committed .html page outside those sections and fails on any link into one.
 * Standalone sections may link to each other.
 *
 * It also checks that each section is still discoverable by crawlers:
 * present in sitemap.xml and linked from llms.txt.
 *
 * Run: node scripts/standalone/check-isolation.mjs   (npm run standalone:check)
 * Exit 0 = clean, 1 = a main-site page links in or a section is undiscoverable.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { sections } = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/standalone/sections.json'), 'utf8'));

const PROTECTED = [
  ...sections.map((s) => ({ path: s.path, allowFrom: [] })),
];
const STANDALONE_DIRS = PROTECTED.map((p) => p.path.slice(1));
const SKIP_DIRS = new Set(['node_modules', 'scripts', 'tmp', 'images', 'fonts', 'css', 'js', 'supabase', '.git', '.github']);

async function walk(dir, rel = '') {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const r = rel + e.name + (e.isDirectory() ? '/' : '');
    if (e.isDirectory()) out.push(...await walk(path.join(dir, e.name), r));
    else if (e.name.endsWith('.html')) out.push(r);
  }
  return out;
}

const problems = [];
for (const file of await walk(ROOT)) {
  if (STANDALONE_DIRS.some((d) => file.startsWith(d))) continue;
  const html = await fs.readFile(path.join(ROOT, file), 'utf8');
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = m[1].replace(/^https?:\/\/(?:www\.)?wedeepen\.com/i, '');
    for (const p of PROTECTED) {
      const bare = p.path.replace(/\/$/, '');
      if ((href === bare || href.startsWith(p.path)) && !p.allowFrom.some((a) => file.startsWith(a))) {
        problems.push(`${file} links to ${m[1]} (${p.path} must not be linked from the main site)`);
      }
    }
  }
}

const sitemap = await fs.readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
const llms = await fs.readFile(path.join(ROOT, 'llms.txt'), 'utf8');
for (const s of sections) {
  if (!sitemap.includes(`<loc>https://wedeepen.com${s.path}</loc>`)) problems.push(`${s.path} is missing from sitemap.xml (run npm run standalone:build)`);
  if (!llms.includes(`https://wedeepen.com${s.path}`)) problems.push(`${s.path} is not linked from llms.txt, so AI tools won't find it`);
}

for (const p of problems) console.log(`FAIL: ${p}`);
console.log(problems.length ? `RESULT: FAIL (${problems.length})` : `RESULT: PASS (${PROTECTED.map((p) => p.path).join(', ')} isolated and discoverable)`);
process.exit(problems.length ? 1 : 0);

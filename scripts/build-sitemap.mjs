#!/usr/bin/env node
/**
 * build-sitemap.mjs — generate sitemap.xml for wedeepen.com.
 *
 * Walks the repo for every index.html, skips any with `noindex` in its robots
 * meta (the redirect-only stubs like /bl, /bi, /eo, /zoom), and writes a
 * sorted sitemap to /sitemap.xml.
 *
 * Run from anywhere: `node scripts/build-sitemap.mjs`
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SITE = 'https://wedeepen.com';
const OUT = path.join(ROOT, 'sitemap.xml');

// Priority + changefreq hints by URL prefix. First match wins.
const RULES = [
  { match: (p) => p === '/',                                       priority: '1.0', changefreq: 'weekly' },
  { match: (p) => p === '/events/',                                priority: '0.9', changefreq: 'weekly' },
  { match: (p) => p.startsWith('/love-immersion/') && p !== '/love-immersion/', priority: '0.8', changefreq: 'monthly' },
  { match: (p) => ['/love-immersion/', '/love-club/', '/biohacking-love/', '/podcast/', '/gallery/', '/love-guides/'].includes(p), priority: '0.9', changefreq: 'weekly' },
  { match: (p) => ['/about/', '/reviews/'].includes(p),            priority: '0.7', changefreq: 'monthly' },
  { match: (p) => p.startsWith('/gallery/'),                       priority: '0.6', changefreq: 'monthly' },
  { match: (p) => p.startsWith('/deepen-with-christina/'),         priority: '0.6', changefreq: 'yearly'  },
  { match: () => true,                                              priority: '0.5', changefreq: 'monthly' },
];

async function walk(dir, depth = 0) {
  const out = [];
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    // Skip dotfiles + obvious non-content dirs at any depth.
    if (e.name.startsWith('.') || ['node_modules', 'scripts', 'images', 'tmp', 'infra'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...await walk(full, depth + 1));
    } else if (e.isFile() && e.name === 'index.html') {
      out.push(full);
    }
  }
  return out;
}

async function isIndexable(file) {
  const html = await fs.readFile(file, 'utf-8');
  // Skip if explicit noindex
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  if (m && /noindex/i.test(m[1])) return false;
  // Skip if it's a meta-refresh redirect stub (defensive — most of these also have noindex)
  if (/<meta\s+http-equiv=["']refresh["']/i.test(html)) return false;
  return true;
}

function fileToUrlPath(file) {
  const rel = path.relative(ROOT, file);
  let urlPath = '/' + path.dirname(rel) + '/';
  urlPath = urlPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (urlPath === '/.' || urlPath === '/./') urlPath = '/';
  return urlPath;
}

function rule(urlPath) {
  return RULES.find(r => r.match(urlPath));
}

async function lastmod(file) {
  const st = await fs.stat(file);
  return st.mtime.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  const files = await walk(ROOT);
  const urls = [];
  for (const f of files) {
    if (!await isIndexable(f)) continue;
    const urlPath = fileToUrlPath(f);
    const { priority, changefreq } = rule(urlPath);
    urls.push({
      loc: `${SITE}${urlPath}`,
      lastmod: await lastmod(f),
      changefreq,
      priority,
    });
  }
  urls.sort((a, b) => a.loc.localeCompare(b.loc));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  await fs.writeFile(OUT, xml, 'utf-8');
  console.log(`✓ Wrote ${urls.length} URLs to ${path.relative(ROOT, OUT)}`);
}

main().catch(e => { console.error(e); process.exit(1); });

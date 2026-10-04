#!/usr/bin/env node
/**
 * build-llms-full.mjs — write /llms-full.txt, the plain-text companion to /llms.txt.
 *
 * Follows the llms.txt proposal (https://llmstxt.org/): one Markdown file with
 * the readable text of the core pages, the Four Pillars, and
 * a one-paragraph summary per podcast episode, so AI tools can read the site
 * without crawling 240 pages. Everything comes from the committed HTML and
 * episode data, so it can't say anything the site doesn't.
 *
 * Run: node scripts/build-llms-full.mjs   (also runs in the Standalone build workflow)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://wedeepen.com';
const CORE = ['/', '/about/', '/love-club/', '/love-immersion/october-2026/', '/events/', '/love-guides/',
  '/book-session-with-christina/', '/four-pillars/', '/reviews/', '/podcast/'];

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ldquo;/g, '“')
  .replace(/&rdquo;/g, '”').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
  .replace(/&middot;/g, '·').replace(/&rarr;/g, '→').replace(/&larr;/g, '←').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

// Readable text of a page's <main> (or body), with headings kept as Markdown.
function pageText(html) {
  let s = (html.match(/<main\b[\s\S]*?<\/main>/i) || html.match(/<body\b[\s\S]*?<\/body>/i) || [html])[0];
  s = s.replace(/<(script|style|noscript|svg|nav|footer|header|form|button)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<div[^>]*id="(?:mobile-nav|wd-header)"[\s\S]*?<\/div>/gi, ' ')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(+n + 1)} ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|div|section|li|tr|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decode(s).split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
    .filter((l, i, a) => l !== a[i - 1]).join('\n').replace(/\n(#+ )/g, '\n\n$1');
}
const titleOf = (html) => decode((html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]).trim();
const read = (p) => fs.readFile(path.join(ROOT, p === '/' ? 'index.html' : `${p.slice(1)}index.html`), 'utf8');

const out = [`# WeDeepen: full text for language models`,
  `> Plain-text version of wedeepen.com's core pages, answer and guide pages, and podcast episode summaries. Generated from the live site's HTML; the linked pages are the source of truth. Index: ${SITE}/llms.txt`, ''];

for (const p of CORE) {
  const html = await read(p);
  out.push(`---\n\n## ${titleOf(html)}\n\nURL: ${SITE}${p}\n\n${pageText(html)}\n`);
}

// Standalone answer pages (scripts/standalone/sections.json, kind "collection").
const sections = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/standalone/sections.json'), 'utf8').catch(() => '{}')).sections || [];
let answerCount = 0;
for (const sec of sections.filter((x) => x.kind === 'collection')) {
  const pages = JSON.parse(await fs.readFile(path.join(ROOT, sec.data), 'utf8').catch(() => '{}')).pages || [];
  if (!pages.length) continue;
  out.push(`---\n\n# ${sec.label}\n`);
  for (const a of pages) {
    answerCount++;
    out.push(`## ${a.title}\n\nURL: ${SITE}${sec.path}${a.slug}/\nPublished: ${String(a.created_at).slice(0, 10)}\n\nShort answer: ${a.short_answer}\n\n${pageText(a.content_html || '')}\n`);
  }
}

// Episode URLs come from the generated pages themselves, matched by title.
const episodes = JSON.parse(await fs.readFile(path.join(ROOT, 'podcast/data/episodes.json'), 'utf8')).episodes || [];
const epDir = path.join(ROOT, 'deepen-with-christina');
const byTitle = new Map();
for (const d of await fs.readdir(epDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const html = await fs.readFile(path.join(epDir, d.name, 'index.html'), 'utf8').catch(() => '');
  const name = (html.match(/"@type": "PodcastEpisode",\s*"name": "((?:[^"\\]|\\.)*)"/) || [])[1];
  if (name) byTitle.set(JSON.parse(`"${name}"`), `${SITE}/deepen-with-christina/${encodeURI(d.name)}/`);
}
out.push('---\n\n# Mastering Love podcast (formerly Deepen with Christina): episode summaries\n');
for (const ep of episodes.filter((e) => e.title)) {
  const desc = decode(String(ep.description || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  out.push(`## ${ep.title}\n\n${byTitle.get(ep.title) ? `URL: ${byTitle.get(ep.title)}\n` : ''}${ep.date ? `Published: ${ep.date}\n` : ''}\n${desc.slice(0, 700)}${desc.length > 700 ? '…' : ''}\n`);
}

const text = out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
await fs.writeFile(path.join(ROOT, 'llms-full.txt'), text, 'utf8');
console.log(`Wrote llms-full.txt: ${CORE.length} pages, ${answerCount} answers, ${episodes.length} episodes, ${Math.round(text.length / 1024)} KB`);

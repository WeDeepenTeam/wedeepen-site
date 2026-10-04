#!/usr/bin/env node
/**
 * build-seo-schema.mjs — BreadcrumbList and FAQPage JSON-LD for hand-written pages.
 *
 * Both blocks are generated from what the page already shows, so the schema
 * can never say something the visitor can't read:
 *
 *   - FAQPage is read from the page's own visible `.faq-item` accordion
 *     (question = the `.faq-trigger` label, answer = the `.faq-answer` text).
 *     Only pages listed in FAQ_PAGES get one. The homepage FAQPage lives in
 *     its hand-written @graph and is not touched here.
 *   - BreadcrumbList is Home > [parent] > page, from the table below.
 *
 * Output goes between <!-- seo:schema --> and <!-- /seo:schema --> markers,
 * inserted just before </head> the first time. Episode pages get their
 * breadcrumb from podcast/data/generate_episode_pages.py; /podcast/archive/
 * from build-podcast-archive.mjs.
 *
 *   npm run seo:schema          regenerate
 *   npm run seo:schema:check    fail if any page is stale
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SITE = 'https://wedeepen.com';

const LI = { name: 'Love Immersion', path: '/love-immersion/' };
const PAGES = [
  { path: '/about/', name: 'About' },
  { path: '/events/', name: 'Events' },
  { path: '/love-guides/', name: 'Faculty' },
  { path: '/reviews/', name: 'Reviews' },
  { path: '/four-pillars/', name: 'The Four Pillars' },
  { path: '/podcast/', name: 'Podcast' },
  { path: '/love-club/', name: 'Love Club', faq: true },
  { path: '/book-session-with-christina/', name: 'Book a Session with Christina' },
  { path: '/schedule-with-christina/', name: 'Schedule with Christina' },
  { path: '/join/', name: 'Join' },
  { path: '/gallery/', name: 'Photo Galleries' },
  { path: '/biohacking-love/', name: 'Biohacking Love' },
  { path: '/inperson/', name: 'WeDeepen In-Person' },
  { path: '/love-immersion/', name: 'Love Immersion', faq: true },
  { path: '/love-immersion/october-2026/', name: 'Love Immersion VIII: October 2026', parent: LI, faq: true },
  { path: '/love-immersion/nye-2026/', name: "Love Immersion New Year's Edition 2026–27", parent: LI },
  { path: '/love-immersion/march-2027/', name: 'Love Immersion IX: March 2027', parent: LI },
  { path: '/love-immersion/july-2027/', name: 'Love Immersion X: July 2027', parent: LI },
];

const START = '<!-- seo:schema -->';
const END = '<!-- /seo:schema -->';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', middot: '·', rarr: '→', eacute: 'é' };
function text(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div|h\d)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Visible FAQ accordion -> [{q, a}]. Relies on the site's shared faq-item markup. */
function readFaq(html) {
  const body = html.slice(html.indexOf('<body'));
  const out = [];
  const parts = body.split(/<div class="faq-item\b/).slice(1);
  for (const part of parts) {
    const q = part.match(/<button[^>]*faq-trigger[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/);
    const a = part.match(/<div class="faq-answer[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (!q || !a) continue;
    const qt = text(q[1]), at = text(a[1]);
    if (qt && at) out.push({ q: qt, a: at });
  }
  return out;
}

function breadcrumb(page) {
  const trail = [{ name: 'Home', path: '/' }];
  if (page.parent) trail.push(page.parent);
  trail.push(page);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: SITE + t.path })),
  };
}

function faqPage(page, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE}${page.path}#faq`,
    url: SITE + page.path,
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

const script = (obj) => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`;

let stale = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page.path, 'index.html');
  const html = await fs.readFile(file, 'utf-8');
  // A noindex page is not in search, so it gets no search markup.
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) { console.log(`skip ${page.path} (noindex)`); continue; }
  const blocks = [script(breadcrumb(page))];
  if (page.faq) {
    const items = readFaq(html);
    if (!items.length) throw new Error(`${page.path}: faq: true but no .faq-item found`);
    blocks.push(script(faqPage(page, items)));
  }
  const block = `${START}\n${blocks.join('\n')}\n  ${END}`;
  let next;
  if (html.includes(START)) {
    next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    next = html.replace('</head>', `  ${block}\n</head>`);
  }
  if (next === html) continue;
  stale++;
  if (CHECK) { console.error(`stale: ${page.path}`); continue; }
  await fs.writeFile(file, next);
  console.log(`updated ${page.path}${page.faq ? ` (FAQ: ${readFaq(html).length} questions)` : ''}`);
}
if (CHECK && stale) { console.error(`${stale} page(s) need \`npm run seo:schema\``); process.exit(1); }
if (!CHECK) console.log(stale ? `${stale} page(s) written` : 'all pages up to date');

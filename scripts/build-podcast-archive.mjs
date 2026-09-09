#!/usr/bin/env node
/**
 * build-podcast-archive.mjs — generate /podcast/archive/index.html.
 *
 * Why this page exists: /podcast/ renders its episode list client-side from
 * episodes.json, so the static HTML contains no episode links. That left the
 * back catalogue orphaned — crawlers could only reach episodes through the
 * sitemap, which earns them no internal link equity and buries them in the
 * crawl queue. This page is a flat, static, fully-crawlable index of every
 * episode, so each one sits two clicks from the homepage.
 *
 * The page shell (head, header, mobile nav, footer) is borrowed from
 * podcast/index.html at build time rather than duplicated, so nav changes
 * there flow through here automatically and can't drift.
 *
 * Run: node scripts/build-podcast-archive.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DONOR = path.join(ROOT, 'podcast/index.html');
const EPISODES = path.join(ROOT, 'podcast/data/episodes.json');
const OUT_DIR = path.join(ROOT, 'podcast/archive');
const URL_PATH = '/podcast/archive/';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Must match slugify() in podcast/data/generate_episode_pages.py and the copy
// in podcast/index.html. Python \w is Unicode-aware, so accented letters stay.
const slugify = (title) => title.toLowerCase()
  .replace(/[^\p{L}\p{N}_\s-]/gu, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');

// The show an episode aired under, read off its number prefix.
const showOf = (title) => {
  const p = (title.match(/^([A-Za-z]+)\s*\d/) || [])[1];
  if (!p) return 'Deepen with Christina';
  const key = p.toUpperCase();
  if (key === 'ML') return 'Mastering Love';
  if (key === 'YLA') return 'Your Love Age';
  return 'Deepen with Christina';
};

function slice(src, startMarker, endMarker, from = 0) {
  const a = src.indexOf(startMarker, from);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a === -1 || b === -1) {
    throw new Error(`build-podcast-archive: could not find ${JSON.stringify(startMarker)} .. ${JSON.stringify(endMarker)} in podcast/index.html. The donor shell changed; update this script.`);
  }
  return src.slice(a, b);
}

const donor = await fs.readFile(DONOR, 'utf8');
const { episodes } = JSON.parse(await fs.readFile(EPISODES, 'utf8'));

// --- Borrow the shell -------------------------------------------------------
// Head: everything up to </head>, with the page-identity tags swapped out.
let head = donor.slice(0, donor.indexOf('</head>'));
const TITLE = 'Every Episode | Mastering Love Podcast Archive';
const DESC = `Every episode of the WeDeepen podcast in one place: ${episodes.length} conversations on love, sex, dating, and human connection with Christina Weber.`;

head = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(TITLE)}</title>`)
  .replace(/<meta name="description" content="[\s\S]*?">/, `<meta name="description" content="${esc(DESC)}">`)
  .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="https://wedeepen.com${URL_PATH}">`)
  .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="https://wedeepen.com${URL_PATH}">`)
  .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(TITLE)}">`)
  .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(DESC)}">`)
  .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(TITLE)}">`)
  .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(DESC)}">`)
  // The donor's JSON-LD describes the show hub; this page gets its own below.
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '');

// Body open + sticky header + mobile nav, up to the first content <section>.
// Split on the section tag, not the comment banner above it: the header itself
// is introduced by an identical banner, so a comment-based split silently
// returned an empty shell.
let shellTop = slice(donor, '<body class="bg-ink text-white">', '\n  <section');
// Drop only the trailing comment banner that introduced the removed section.
// The comment body is tempered so it cannot run past its own '-->' and
// swallow the header, which is exactly what a lazy [\s\S]*? did here.
shellTop = shellTop.replace(/\s*<!--(?:(?!-->)[\s\S])*-->\s*$/, '\n');
for (const needle of ['id="wd-header"', 'id="mobile-nav"', 'id="mobile-toggle"']) {
  if (!shellTop.includes(needle)) {
    throw new Error(`build-podcast-archive: borrowed shell is missing ${needle}. The donor layout changed; update the split markers.`);
  }
}
// Footer markup only. The donor's trailing <script> block drives the episode
// fetch/search on /podcast/ and would throw here, so this page ships its own.
const footer = slice(donor, '  <footer class="bg-ink border-t', '  <script>');

// --- Build the episode list -------------------------------------------------
const byYear = new Map();
for (const ep of episodes) {
  if (!ep.title) continue;
  const year = (ep.date || '').slice(0, 4) || 'Undated';
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year).push(ep);
}
const years = [...byYear.keys()].sort().reverse();

const sections = years.map((year) => {
  const rows = byYear.get(year).map((ep) => {
    const url = `/deepen-with-christina/${slugify(ep.title)}/`;
    return `          <li class="border-b border-white/5 last:border-0">
            <a href="${url}" class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3 group">
              <span class="text-white/35 text-xs tabular-nums shrink-0 sm:w-24">${esc(ep.date_pretty || '')}</span>
              <span class="text-white/80 group-hover:text-gold transition text-sm leading-snug">${esc(ep.title)}</span>
            </a>
          </li>`;
  }).join('\n');

  return `      <div class="mb-14">
        <h2 class="font-heading text-2xl md:text-3xl font-semibold mb-1">${year}</h2>
        <p class="text-white/40 text-xs mb-5">${byYear.get(year).length} episode${byYear.get(year).length === 1 ? '' : 's'}</p>
        <ul>
${rows}
        </ul>
      </div>`;
}).join('\n\n');

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: TITLE,
  description: DESC,
  url: `https://wedeepen.com${URL_PATH}`,
  isPartOf: {
    '@type': 'PodcastSeries',
    name: 'Mastering Love',
    alternateName: 'Deepen with Christina',
    url: 'https://wedeepen.com/podcast/',
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Podcast', item: 'https://wedeepen.com/podcast/' },
      { '@type': 'ListItem', position: 2, name: 'Every Episode', item: `https://wedeepen.com${URL_PATH}` },
    ],
  },
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: episodes.length,
    itemListElement: episodes.filter((e) => e.title).map((ep, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: ep.title,
      url: `https://wedeepen.com/deepen-with-christina/${slugify(ep.title)}/`,
    })),
  },
};

const page = `<!DOCTYPE html>
<html lang="en">
<head>
${head.slice(head.indexOf('<head>') + '<head>'.length).trim()}

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
${shellTop}
  <!-- ============================
       ARCHIVE
       ============================ -->
  <section class="pt-32 md:pt-40 pb-20 md:pb-28 px-6">
    <div class="max-w-3xl mx-auto">
      <a href="/podcast/" class="text-gold text-sm hover:underline inline-flex items-center gap-2 mb-6">&larr; Back to the podcast</a>
      <p class="text-gold text-xs tracking-[0.25em] uppercase font-semibold mb-3">The Full Archive</p>
      <h1 class="font-heading text-4xl md:text-5xl font-normal leading-[1.1] tracking-tight mb-5">Every Episode</h1>
      <p class="text-white/60 leading-relaxed mb-4 max-w-2xl">${episodes.length} conversations on love, sex, dating, and the evolving landscape of human connection, hosted by Christina Weber. Mastering Love, formerly Deepen with Christina, and the Your Love Age episodes that came before it.</p>
      <p class="text-white/40 text-sm">Looking for something specific? <a href="/podcast/" class="text-gold hover:underline">Search the episode list</a>.</p>
    </div>
  </section>

  <section class="pb-24 md:pb-32 px-6 bg-ink">
    <div class="max-w-3xl mx-auto">
${sections}
    </div>
  </section>

  <!-- ============================
       CTA
       ============================ -->
  <section class="py-16 md:py-20 px-6" style="background: linear-gradient(135deg, #1A1A1A 0%, #2a1620 100%);">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="font-heading text-3xl md:text-4xl font-normal mb-5 leading-tight">Love the podcast? <span class="italic" style="color:#C4577A;">Come practice it.</span></h2>
      <p class="text-white/60 mb-8 leading-relaxed">The conversations here become reality inside the Love Club.</p>
      <a href="/love-club/" class="btn-rose">Join Love Club</a>
    </div>
  </section>

${footer}
  <script>
    const header = document.getElementById('wd-header');
    window.addEventListener('scroll', () => { header.classList.toggle('scrolled', window.scrollY > 50); });
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileClose = document.getElementById('mobile-close');
    const mobileNav = document.getElementById('mobile-nav');
    mobileToggle.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    mobileNav.querySelectorAll('a').forEach(l => l.addEventListener('click', () => mobileNav.classList.remove('open')));
  </script>
  <script src="/js/lead-capture.js?v=20" defer></script>
</body>
</html>
`;

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUT_DIR, 'index.html'), page, 'utf8');
console.log(`Wrote podcast/archive/index.html — ${episodes.length} episodes across ${years.length} years`);

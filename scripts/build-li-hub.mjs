#!/usr/bin/env node
/**
 * build-li-hub.mjs — fill the retreat list on /love-immersion/.
 *
 * /love-immersion/ used to be a noindex stub that bounced to whichever retreat
 * was next, which meant "the current retreat" was hardcoded in five places
 * (nav links.json, the events page URL overrides, lead-capture.js, the podcast
 * generator's nav copy, and a Cloudflare redirect rule) and every one of them
 * had to be rotated by hand when a date passed.
 *
 * Now it is a real page, everything links to it permanently, and this script
 * regenerates just the card list and the Event schema inside the li:autogen
 * and li:schema markers. The page's copy around them is hand-written; leave it
 * alone.
 *
 * The retreats are read from the dated pages' own Event JSON-LD rather than a
 * separate list, because a separate list drifts: the EVENTS array in
 * love-immersion/_generate_event_pages.py still says October 16-19 while the
 * page, its schema, and the events feed all say 17-19.
 *
 *   npm run li:hub          regenerate
 *   npm run li:hub:check    fail if stale (CI)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'love-immersion');
const HUB = path.join(DIR, 'index.html');
const CHECK = process.argv.includes('--check');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Oct 17-19, 2026", or "Dec 31, 2026 - Jan 3, 2027" when it straddles a month. */
function dateRange(startISO, endISO) {
  const s = new Date(startISO), e = new Date(endISO);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  const sameYear = s.getFullYear() === e.getFullYear();
  const left = `${MONTHS[s.getMonth()]} ${s.getDate()}${sameYear ? '' : ', ' + s.getFullYear()}`;
  return `${left} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

/** Everything after the colon in "Love Immersion VIII: 2026" is noise here. */
function shortName(name) {
  return name.replace(/^Love Immersion:?\s*/i, '').replace(/:\s*20\d\d[–-]?\d*$/, '').trim() || 'Love Immersion';
}

async function collect() {
  const events = [];
  for (const entry of (await fs.readdir(DIR, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const file = path.join(DIR, entry.name, 'index.html');
    const html = await fs.readFile(file, 'utf-8').catch(() => null);
    if (!html) continue;
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let data;
      try { data = JSON.parse(m[1]); } catch { continue; }
      if (data['@type'] !== 'Event' || !data.startDate) continue;
      events.push({ slug: entry.name, data });
    }
  }
  return events.sort((a, b) => a.data.startDate.localeCompare(b.data.startDate));
}

function card({ slug, data }, featured) {
  const url = `/love-immersion/${slug}/`;
  const range = dateRange(data.startDate, data.endDate ?? data.startDate);
  const place = data.location?.name && data.location.name !== 'Venue TBA'
    ? `${esc(data.location.name)}, Austin, TX`
    : 'Austin, TX · venue announced soon';
  const low = data.offers?.lowPrice;
  const price = low ? `From $${Number(low).toLocaleString('en-US')}` : 'Pricing announced soon';
  const name = esc(shortName(data.name));

  if (featured) {
    return `        <a href="${url}" data-li-end="${esc(data.endDate ?? data.startDate)}"
           class="group block rounded-3xl overflow-hidden mb-8 border border-gold/25 hover:border-gold/50 transition"
           style="background: linear-gradient(135deg, rgba(160,27,74,0.16) 0%, rgba(26,26,26,0.9) 55%);">
          <div class="grid md:grid-cols-5">
            <div class="md:col-span-2 aspect-[16/10] md:aspect-auto overflow-hidden">
              <img src="${esc(data.image ?? '/images/love-immersion-spotlight.jpg')}" alt="Love Immersion ${name} in Austin, Texas"
                   class="w-full h-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="eager" width="1200" height="750">
            </div>
            <div class="md:col-span-3 p-7 md:p-10">
              <p class="text-gold text-xs uppercase tracking-[0.25em] font-semibold mb-4">Next retreat</p>
              <h3 class="font-heading text-3xl md:text-4xl text-white font-normal leading-tight mb-3">Love Immersion ${name}</h3>
              <p class="text-white text-lg md:text-xl mb-2">${range}</p>
              <p class="text-white/55 text-sm mb-6">${place} &middot; ${price}</p>
              <p class="text-white/70 text-sm md:text-base leading-relaxed mb-7">${esc(data.description ?? '')}</p>
              <span class="btn-rose inline-block !py-3 !px-8">See the retreat</span>
            </div>
          </div>
        </a>`;
  }
  return `          <a href="${url}" data-li-end="${esc(data.endDate ?? data.startDate)}"
             class="group block rounded-2xl p-7 border border-white/10 hover:border-gold/40 transition" style="background: rgba(255,255,255,0.03);">
            <p class="text-gold text-xs uppercase tracking-[0.22em] font-semibold mb-3">${range}</p>
            <h3 class="font-heading text-2xl text-white font-normal leading-tight mb-2">Love Immersion ${name}</h3>
            <p class="text-white/50 text-sm mb-5">${place} &middot; ${price}</p>
            <span class="text-gold group-hover:text-gold-light text-sm font-medium transition">See the retreat &rarr;</span>
          </a>`;
}

function replaceBlock(html, marker, body) {
  const open = `<!-- ${marker} -->`, close = `<!-- /${marker} -->`;
  const start = html.indexOf(open), end = html.indexOf(close);
  if (start === -1 || end === -1) throw new Error(`love-immersion/index.html is missing the ${marker} markers`);
  return html.slice(0, start + open.length) + '\n' + body + '\n' + html.slice(end).replace(/^\s*/, '      ');
}

const events = await collect();
const upcoming = events.filter((e) => new Date(e.data.endDate ?? e.data.startDate) >= new Date());

const cards = upcoming.length
  ? [
      card(upcoming[0], true),
      upcoming.length > 1
        ? `        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">\n${upcoming.slice(1).map((e) => card(e, false)).join('\n')}\n        </div>`
        : '',
    ].filter(Boolean).join('\n')
  : '';

const schema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Upcoming Love Immersion retreats',
  url: 'https://wedeepen.com/love-immersion/',
  itemListElement: upcoming.map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: e.data })),
};

let html = await fs.readFile(HUB, 'utf-8');
const next = replaceBlock(
  replaceBlock(html, 'li:autogen', cards),
  'li:schema',
  upcoming.length ? `  <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>` : '',
);

if (next === html) {
  console.log(`li:hub: up to date (${upcoming.length} upcoming of ${events.length})`);
} else if (CHECK) {
  console.error('li:hub: love-immersion/index.html is out of date. Run `npm run li:hub`.');
  process.exit(1);
} else {
  await fs.writeFile(HUB, next);
  console.log(`li:hub: wrote ${upcoming.length} upcoming retreat(s) of ${events.length} indexable`);
  for (const e of upcoming) console.log(`  ${e.slug}  ${dateRange(e.data.startDate, e.data.endDate ?? e.data.startDate)}`);
}

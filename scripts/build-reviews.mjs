#!/usr/bin/env node
/**
 * build-reviews.mjs — render the review wall on /reviews/ from reviews/data/reviews.json.
 *
 * The page used to embed two Elfsight widgets (Google reviews + a testimonials
 * slider). Their content now lives in reviews.json, one list, and this script
 * writes the cards and the counts between the reviews:* markers in
 * reviews/index.html. The copy around them (including the summary card) is
 * hand-written; leave it alone.
 *
 * New Google reviews arrive on their own: the "Google reviews" workflow runs
 * scripts/reviews/sync-google.mjs daily, then this. To add one by hand, put it
 * in reviews.json with source "google", the review's url, its date, and
 * category "google". Order in the file is the order on the page.
 *
 * The rating panel uses Google's own average and total from
 * reviews/data/google.json when the sync has written it (Google's total also
 * counts star-only reviews, which aren't shown), else the cards' numbers.
 *
 *   node scripts/build-reviews.mjs           regenerate
 *   node scripts/build-reviews.mjs --check   fail if stale (CI)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'reviews', 'index.html');
const DATA = path.join(ROOT, 'reviews', 'data', 'reviews.json');
const GOOGLE_SUMMARY = path.join(ROOT, 'reviews', 'data', 'google.json');
const CHECK = process.argv.includes('--check');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GOOGLE_G = '<svg class="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>';

function monthYear(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function stars(n) {
  const on = '&#9733;'.repeat(n), off = '&#9733;'.repeat(5 - n);
  return `<div class="rv-stars" aria-label="${n} out of 5 stars"><span>${on}</span>${off ? `<span class="rv-star-off">${off}</span>` : ''}</div>`;
}

function card(r, i) {
  const anon = /^anonymous$/i.test(r.name);
  const initial = anon ? '&#9829;' : esc(r.name.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '&#9829;');
  const tone = i % 2 ? 'rv-av-gold' : 'rv-av-rose';
  const meta = [r.caption, r.date && monthYear(r.date)].filter(Boolean).map(esc).join(' &middot; ');
  const text = r.text.map((p) => `<p>${esc(p)}</p>`).join('');
  const foot = r.source === 'google'
    ? `\n          <a class="rv-source" href="${esc(r.url)}" target="_blank" rel="noopener">${GOOGLE_G}<span>Posted on Google</span></a>`
    : '';
  return `
        <article class="rv-card" data-cat="${esc(r.category)}">
          <div class="flex items-center gap-3 mb-3">
            <div class="rv-av ${tone}" aria-hidden="true">${initial}</div>
            <div class="min-w-0">
              <p class="text-charcoal font-semibold text-sm truncate">${esc(r.name)}</p>${meta ? `
              <p class="text-charcoal/70 text-xs">${meta}</p>` : ''}
            </div>
          </div>
          ${stars(r.rating)}
          <div class="rv-text">${text}</div>
          <button type="button" class="rv-more" hidden>Read more</button>${foot}
        </article>`;
}

function replaceBetween(html, name, inner) {
  const re = new RegExp(`(<!-- reviews:${name} -->)[\\s\\S]*?(<!-- /reviews:${name} -->)`);
  if (!re.test(html)) throw new Error(`reviews/index.html is missing the reviews:${name} markers`);
  return html.replace(re, `$1${inner}$2`);
}

const reviews = JSON.parse(await fs.readFile(DATA, 'utf-8'));
const google = reviews.filter((r) => r.source === 'google');
const summary = JSON.parse(await fs.readFile(GOOGLE_SUMMARY, 'utf-8').catch(() => '{}'));
const googleAvg = Number(summary.averageRating ?? google.reduce((s, r) => s + r.rating, 0) / google.length).toFixed(1);
const googleTotal = summary.totalReviewCount ?? google.length;
const counts = { all: reviews.length };
for (const r of reviews) counts[r.category] = (counts[r.category] || 0) + 1;

let html = await fs.readFile(PAGE, 'utf-8');
const before = html;
html = replaceBetween(html, 'cards', reviews.map(card).join('') + '\n        ');
html = replaceBetween(html, 'google-rating', googleAvg);
html = replaceBetween(html, 'google-count', String(googleTotal));
for (const [cat, n] of Object.entries(counts)) {
  if (html.includes(`<!-- reviews:count-${cat} -->`)) html = replaceBetween(html, `count-${cat}`, String(n));
}

if (CHECK) {
  if (html !== before) { console.error('reviews/index.html is stale. Run: node scripts/build-reviews.mjs'); process.exit(1); }
  console.log('reviews/index.html is up to date.');
} else {
  await fs.writeFile(PAGE, html);
  console.log(`Wrote ${reviews.length} reviews (${google.length} from Google; panel says ${googleAvg} from ${googleTotal}).`);
}

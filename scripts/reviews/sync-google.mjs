#!/usr/bin/env node
/**
 * sync-google.mjs — pull WeDeepen's Google reviews into reviews/data/reviews.json.
 *
 * Reads every review through the Google Business Profile API (the only
 * official source that returns all of them) and:
 *   - adds reviews that aren't in reviews.json yet, newest first, at the top
 *     of the Google block
 *   - updates the text or stars of ones the reviewer edited
 *   - never removes anything (a review that disappears from Google is logged,
 *     not deleted; take it out by hand if it should go)
 *   - writes Google's own average and total to reviews/data/google.json for
 *     the rating panel
 *
 * Reviews with stars but no text are skipped, same as the old Elfsight widget.
 *
 * Needs five env vars (GitHub secrets in the "Google reviews" workflow; get
 * them once with scripts/reviews/google-auth.mjs):
 *   GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID
 *
 * Without them it prints a notice and exits 0, so the workflow stays green
 * until setup is done.
 *
 *   node scripts/reviews/sync-google.mjs                  sync from the API
 *   node scripts/reviews/sync-google.mjs --from file.json  sync from a saved API response (testing)
 *
 * Then run scripts/build-reviews.mjs to re-render the page.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'reviews', 'data', 'reviews.json');
const SUMMARY = path.join(ROOT, 'reviews', 'data', 'google.json');

// Google has no public link to a single review, so new ones point at the profile.
const PROFILE_URL = 'https://www.google.com/maps/place/WeDeepen+Relationships/@46.423669,-129.9427085,3z/data=!3m1!4b1!4m6!3m5!1s0xaa80f86b624c8bfb:0x4a10ae169fb52202!8m2!3d46.423669!4d-129.9427086!16s%2Fg%2F11xryrltcy?hl=en-US';
const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

const env = (k) => process.env[k]?.trim();
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GBP_CLIENT_ID'),
      client_secret: env('GBP_CLIENT_SECRET'),
      refresh_token: env('GBP_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${body.error_description || body.error}. The refresh token may have expired; rerun scripts/reviews/google-auth.mjs.`);
  return body.access_token;
}

async function fetchAll() {
  const token = await getAccessToken();
  const base = `https://mybusiness.googleapis.com/v4/accounts/${env('GBP_ACCOUNT_ID')}/locations/${env('GBP_LOCATION_ID')}/reviews`;
  const reviews = [];
  let page = '', meta = {};
  do {
    const url = `${base}?pageSize=50&orderBy=${encodeURIComponent('updateTime desc')}${page ? `&pageToken=${page}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`Reviews request failed (${res.status}): ${body.error?.message || JSON.stringify(body)}`);
    reviews.push(...(body.reviews || []));
    meta = { averageRating: body.averageRating, totalReviewCount: body.totalReviewCount };
    page = body.nextPageToken || '';
  } while (page);
  return { reviews, ...meta };
}

/** Google appends a machine translation to some comments; keep the original. */
function cleanComment(c) {
  const t = String(c || '');
  const m = t.match(/\(Original\)\n([\s\S]*)$/);
  return (m ? m[1] : t.replace(/\n*\(Translated by Google\)[\s\S]*$/, '')).trim();
}

function toEntry(r) {
  const text = cleanComment(r.comment).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  return {
    source: 'google',
    id: r.reviewId,
    name: r.reviewer?.isAnonymous ? 'Anonymous' : (r.reviewer?.displayName || 'Google reviewer').trim(),
    caption: 'Google review',
    category: 'google',
    rating: STARS[r.starRating] || 5,
    date: (r.createTime || '').slice(0, 10),
    url: PROFILE_URL,
    text,
  };
}

if (!process.argv.includes('--from') && !['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN', 'GBP_ACCOUNT_ID', 'GBP_LOCATION_ID'].every(env)) {
  console.log('::notice::Google review sync is not set up yet (GBP_* secrets missing). Setup: scripts/reviews/README.md. Skipping.');
  process.exit(0);
}

const from = process.argv[process.argv.indexOf('--from') + 1];
const api = process.argv.includes('--from') ? JSON.parse(await fs.readFile(from, 'utf-8')) : await fetchAll();
const incoming = api.reviews.map(toEntry).filter((e) => e.text.length);

const data = JSON.parse(await fs.readFile(DATA, 'utf-8'));
const google = data.filter((r) => r.source === 'google');
const added = [], updated = [];

for (const e of incoming) {
  // Older entries came from Elfsight and have no id yet; match those by name,
  // and only when the name is unique, so two "Anonymous" reviews never merge.
  let match = google.find((r) => r.id === e.id);
  if (!match) {
    const byName = google.filter((r) => !r.id && norm(r.name) === norm(e.name));
    if (byName.length === 1) match = byName[0];
  }
  if (!match) { added.push(e); continue; }
  match.id = e.id;
  if (match.rating !== e.rating || match.text.join('\n') !== e.text.join('\n')) {
    match.rating = e.rating;
    match.text = e.text;
    updated.push(e.name);
  }
}

const gone = google.filter((r) => r.id && !incoming.some((e) => e.id === r.id));
for (const r of gone) console.log(`::warning::"${r.name}" is no longer on Google. It is still on /reviews/; remove it from reviews.json if it should go.`);

if (added.length) {
  added.sort((a, b) => b.date.localeCompare(a.date));
  const at = data.findIndex((r) => r.source === 'google');
  data.splice(at === -1 ? data.length : at, 0, ...added);
}

await fs.writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
if (api.totalReviewCount) {
  await fs.writeFile(SUMMARY, JSON.stringify({ averageRating: api.averageRating, totalReviewCount: api.totalReviewCount }, null, 2) + '\n');
}
console.log(`Google reviews: ${incoming.length} with text, ${added.length} new${added.length ? ` (${added.map((a) => a.name).join(', ')})` : ''}, ${updated.length} edited.`);

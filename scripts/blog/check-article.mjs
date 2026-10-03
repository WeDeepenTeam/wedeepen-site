#!/usr/bin/env node
/**
 * check-article.mjs — quality gate for an in-house blog article.
 *
 * The daily pipeline runs this before committing. Any FAIL blocks publishing;
 * WARN is reported but does not block. See scripts/blog/EDITORIAL.md.
 *
 *   node scripts/blog/check-article.mjs <slug>            # structure, voice, facts
 *   node scripts/blog/check-article.mjs <slug> --links    # also fetch every external link
 *
 * Exit code 0 = pass, 1 = fail.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8').catch(() => '{"articles":[]}')).articles || [];

const slug = process.argv[2];
const checkLinks = process.argv.includes('--links');
if (!slug) { console.error('usage: check-article.mjs <slug> [--links]'); process.exit(1); }

const own = await read('blog/data/own-articles.json');
const blg = await read('blog/data/articles.json');
const legacy = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/blog/legacy-redirect-slugs.json'), 'utf8').catch(() => '[]'));
const a = own.find((x) => x.slug === slug);

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);
if (!a) { console.error(`FAIL: no article with slug "${slug}" in blog/data/own-articles.json`); process.exit(1); }

const html = String(a.content_html || '');
const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const lower = text.toLowerCase();
const words = text.split(' ').filter(Boolean).length;

// --- Fields and identity ------------------------------------------------------
for (const k of ['id', 'slug', 'title', 'excerpt', 'meta_description', 'hero_image_url', 'created_at', 'updated_at', 'keywords', 'content_html']) {
  if (!a[k] || (Array.isArray(a[k]) && !a[k].length)) fail(`missing field: ${k}`);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(`slug is not URL-safe: ${slug}`);
if (own.filter((x) => x.slug === slug).length > 1) fail('slug appears more than once in own-articles.json');
if (blg.some((x) => x.slug === slug)) fail('slug already used by a BabyLoveGrowth archive article');
if (legacy.includes(slug)) fail('slug collides with a legacy Cloudflare redirect (page would be unreachable)');
if (own.filter((x) => String(x.id) === String(a.id)).length > 1) fail('id is not unique');
if (Number.isNaN(Date.parse(a.created_at))) fail('created_at is not an ISO date');

// --- SEO ------------------------------------------------------------------------
const t = String(a.title || '');
if (t.length > 65) fail(`title is ${t.length} chars (max 65)`);
const md = String(a.meta_description || '');
if (md.length < 120 || md.length > 160) fail(`meta_description is ${md.length} chars (want 120–160)`);
if (/<h1\b/i.test(html)) fail('content_html contains an <h1>; the page template owns the only H1');
const h2s = (html.match(/<h2\b/gi) || []).length;
if (h2s < 5) fail(`only ${h2s} H2 sections (want 5+)`);
if (words < 1400) fail(`${words} words (min 1,400)`);
if (words > 2900) warn(`${words} words (target 1,600–2,400)`);
const kw = (Array.isArray(a.keywords) ? a.keywords : String(a.keywords).split(',')).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
if (kw[0] && !(t.toLowerCase().includes(kw[0]) || lower.slice(0, 1200).includes(kw[0]))) warn(`primary keyword "${kw[0]}" not in title or opening`);

const faq = html.match(/<h2[^>]*>\s*(?:FAQ|FAQs|Frequently asked questions)\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
const faqQs = faq ? (faq[1].match(/<h3\b/gi) || []).length : 0;
if (faqQs < 4) fail(`FAQ has ${faqQs} questions (want an <h2>FAQ</h2> with 4–6 <h3> questions)`);
const sources = html.match(/<h2[^>]*>\s*Sources\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
const sourceLinks = sources ? (sources[1].match(/href="https?:\/\//gi) || []).length : 0;
if (sourceLinks < 3) fail(`Sources section has ${sourceLinks} links (want 3+)`);

// --- Links ------------------------------------------------------------------------
const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
const internal = hrefs.filter((h) => /^https:\/\/(?:www\.)?wedeepen\.com|^\/(?!\/)/.test(h));
const external = [...new Set(hrefs.filter((h) => /^https?:\/\//.test(h) && !/wedeepen\.com/.test(h)))];
if (internal.length < 3) fail(`${internal.length} internal links (want 3+)`);
if (!hrefs.some((h) => /circle\.wedeepen\.com\/checkout|wedeepen\.com\/membership/.test(h))) fail('no link to the membership (Circle checkout or /membership/)');
const BANNED_HOSTS = /babylovegrowth|cheaterdetector|doublemymatches|organicufuel|mysafetherapy|alvaradotherapy|oracleinvestments|teneishaecoleman|mindshiftwellnesscenter|christinalweber\.com\/blog/i;
for (const h of hrefs) {
  if (BANNED_HOSTS.test(h)) fail(`link to a disallowed host: ${h}`);
  if (!/^(https?:\/\/|\/|#|mailto:)/.test(h)) fail(`malformed link: ${h}`);
}
for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/(?!(?:www\.)?wedeepen\.com|circle\.wedeepen\.com)[^"]*"[^>]*>/gi)) {
  if (!/rel="[^"]*noopener/.test(m[0])) warn(`external link without rel="noopener": ${m[0].slice(0, 90)}`);
}

// --- Voice (Christina Voice Guide) ---------------------------------------------
const SIGNATURE = [
  'your intimacy journey is your life story', 'love is a trainable skill', 'trainable skill', 'mastermind your love life',
  'study love', 'studying love', "how's your love life", 'how’s your love life', 'own your own experience',
  'all feelings are welcome', 'love is a practice', 'a place to practice love', 'expand your range', 'skilled love',
  'speak your truth', 'choose yourself', 'love is the next frontier', 'community is your third', 'spiraling up',
  'main character', 'unoffendable', 'sovereign being', 'armored', 'shrinking', 'four pillars', 'growth comes first',
];
const hits = SIGNATURE.filter((p) => lower.includes(p));
if (hits.length < 2) fail(`only ${hits.length} signature phrase(s) from the voice guide (want 2+): ${hits.join(', ') || 'none'}`);
if (!lower.includes('come play with us')) fail('missing the canonical invitation "Come play with us"');

const BANNED = [
  [/\bempower(?:ing|ment|ed|s)?\b/i, '"empower"'],
  [/unlock (?:your|the) (?:full )?potential/i, '"unlock your potential"'],
  [/\bjourney\b/i, '"journey" (only allowed inside "your intimacy journey is your life story")', (s) => s.replace(/intimacy journey is your life story/gi, '')],
  [/\bsingles\b/i, '"singles" as a label'],
  [/comfort zone/i, '"comfort zone" (say "expand your range")'],
  [/\b(?:guarantee[ds]?|guaranteed)\b/i, 'outcome guarantee'],
  [/(?:save|fix) your (?:marriage|relationship)/i, 'outcome promise ("save/fix your marriage")'],
  [/\b(?:lonely|loneliness)\b/i, 'loneliness framing'],
  [/\b(?:hurry|act now|last chance|only \d+ (?:hours|days) left|ends tonight)\b/i, 'urgency pressure'],
  [/\bsynchronistic\b[\s\S]*\bsynchronistic\b/i, '"synchronistic" more than once'],
];
for (const [re, label, pre] of BANNED) {
  const hay = pre ? pre(text) : text;
  if (re.test(hay)) fail(`banned language: ${label}`);
}
if (/\bas an ai\b|in today['’]s fast-paced world|delve into|in conclusion,/i.test(text)) fail('generic AI phrasing');
const listicleTitle = /^\d+\s|^(?:top|the \d+)\b/i.test(t);
if (listicleTitle) warn('title leads with a number — the guide prefers a framework or reframe title');

// --- Facts: prices must match the live offer list ------------------------------
const ALLOWED_PRICES = new Set(['99', '990', '9997', '2995', '295', '1200']);
for (const m of text.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)) {
  const n = m[1].replace(/,/g, '').replace(/\.00$/, '');
  if (!ALLOWED_PRICES.has(n)) fail(`price $${m[1]} is not on the offer list (99/mo, 990/yr, Love Club 9,997, Love Immersion 2,995, Mentorship 295, In-Person 99–1,200)`);
}

// --- Images ---------------------------------------------------------------------
const local = String(a.hero_image_url || '').match(/^https:\/\/wedeepen\.com\/(images\/blog\/.+)$/);
if (local) {
  await fs.access(path.join(ROOT, local[1])).catch(() => fail(`hero image file not found: ${local[1]}`));
} else if (a.hero_image_url) warn('hero image is not hosted on wedeepen.com');
for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (!/\salt="[^"]+"/.test(m[0])) fail('an <img> has no alt text');

// --- Optional: fetch every external link ---------------------------------------
if (checkLinks) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
  await Promise.all(external.map(async (u) => {
    try {
      const ctl = AbortSignal.timeout(20000);
      let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctl, headers: { 'User-Agent': UA } });
      if (r.status === 405 || r.status === 403 || r.status === 400) r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 410) fail(`dead link (${r.status}): ${u}`);
      else if (!r.ok) warn(`link returned ${r.status} (often bot-blocking; verify): ${u}`);
    } catch (e) {
      const code = e.cause?.code || e.name;
      if (/ENOTFOUND|EAI_AGAIN|ERR_INVALID_URL/.test(code)) fail(`unreachable link (${code}): ${u}`);
      else warn(`could not fetch (${code}): ${u}`);
    }
  }));
}

console.log(`check-article ${slug}: ${words} words, ${h2s} H2s, ${faqQs} FAQs, ${internal.length} internal / ${external.length} external links, voice phrases: ${hits.join(', ')}`);
for (const w of warns) console.log(`WARN: ${w}`);
for (const f of fails) console.log(`FAIL: ${f}`);
console.log(fails.length ? `RESULT: FAIL (${fails.length})` : 'RESULT: PASS');
process.exit(fails.length ? 1 : 0);

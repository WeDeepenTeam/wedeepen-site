#!/usr/bin/env node
/**
 * check-page.mjs — quality gate for a page in a standalone collection section
 * (e.g. /answers/). Voice rules and price list, but sized for answer-first pages rather than
 * long-form articles.
 *
 *   node scripts/standalone/check-page.mjs answers <slug>           # structure, voice, facts
 *   node scripts/standalone/check-page.mjs answers <slug> --links   # also fetch external links
 *   node scripts/standalone/check-page.mjs answers --all [--links]  # every page in the section
 *
 * Exit code 0 = pass, 1 = fail.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [secId, slugArg] = process.argv.slice(2);
const checkLinks = process.argv.includes('--links');
const { sections } = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/standalone/sections.json'), 'utf8'));
const sec = sections.find((s) => s.id === secId && s.kind === 'collection');
if (!sec || !slugArg) { console.error('usage: check-page.mjs <collection-section-id> <slug|--all> [--links]'); process.exit(1); }
const pages = JSON.parse(await fs.readFile(path.join(ROOT, sec.data), 'utf8')).pages || [];
const targets = slugArg === '--all' ? pages.map((p) => p.slug) : [slugArg];

const SIGNATURE = [
  'your intimacy journey is your life story', 'love is a trainable skill', 'trainable skill', 'mastermind your love life',
  'study love', 'studying love', "how's your love life", 'how’s your love life', 'own your own experience',
  'all feelings are welcome', 'love is a practice', 'a place to practice love', 'expand your range', 'skilled love',
  'speak your truth', 'choose yourself', 'love is the next frontier', 'community is your third', 'spiraling up',
  'main character', 'unoffendable', 'sovereign being', 'armored', 'shrinking', 'four pillars', 'growth comes first',
];
const BANNED = [
  [/\bempower(?:ing|ment|ed|s)?\b/i, '"empower"'],
  [/unlock (?:your|the) (?:full )?potential/i, '"unlock your potential"'],
  [/\bjourney\b/i, '"journey"', (s) => s.replace(/intimacy journey is your life story/gi, '')],
  [/\bsingles\b/i, '"singles" as a label'],
  [/comfort zone/i, '"comfort zone"'],
  [/\b(?:guarantee[ds]?|guaranteed)\b/i, 'outcome guarantee'],
  [/(?:save|fix) your (?:marriage|relationship)/i, 'outcome promise'],
  [/\b(?:lonely|loneliness)\b/i, 'loneliness framing'],
  [/\b(?:hurry|act now|last chance|only \d+ (?:hours|days) left|ends tonight)\b/i, 'urgency pressure'],
];
const ALLOWED_PRICES = new Set(['99', '990', '9997', '2995', '295', '1200']);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';

let anyFail = false;
for (const slug of targets) {
  const a = pages.find((x) => x.slug === slug);
  const fails = [];
  const warns = [];
  const fail = (m) => fails.push(m);
  const warn = (m) => warns.push(m);
  if (!a) { console.log(`FAIL: no page "${slug}" in ${sec.data}`); anyFail = true; continue; }

  for (const k of ['slug', 'title', 'short_answer', 'meta_description', 'created_at', 'keywords', 'content_html']) {
    if (!a[k] || (Array.isArray(a[k]) && !a[k].length)) fail(`missing field: ${k}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(`slug is not URL-safe: ${slug}`);
  if (pages.filter((x) => x.slug === slug).length > 1) fail('slug appears more than once');
  if (Number.isNaN(Date.parse(a.created_at))) fail('created_at is not an ISO date');

  const html = String(a.content_html || '');
  const text = (String(a.short_answer || '') + ' ' + html.replace(/<[^>]+>/g, ' ')).replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const words = text.split(' ').filter(Boolean).length;
  const t = String(a.title || '');
  if (t.length > 65) fail(`title is ${t.length} chars (max 65)`);
  const md = String(a.meta_description || '');
  if (md.length < 120 || md.length > 160) fail(`meta_description is ${md.length} chars (want 120–160)`);
  const sa = String(a.short_answer || '').split(/\s+/).filter(Boolean).length;
  if (sa < 30 || sa > 90) fail(`short_answer is ${sa} words (want 30–90: quotable, answer-first)`);
  if (/<h1\b/i.test(html)) fail('content_html contains an <h1>');
  const h2s = (html.match(/<h2\b/gi) || []).length;
  if (h2s < 4) fail(`only ${h2s} H2 sections (want 4+)`);
  if (words < 800) fail(`${words} words (min 800)`);
  if (words > 2400) warn(`${words} words (target 900–1,800)`);

  const faq = html.match(/<h2[^>]*>\s*(?:FAQ|FAQs|Frequently asked questions)\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  const faqQs = faq ? (faq[1].match(/<h3\b/gi) || []).length : 0;
  if (faqQs < 4) fail(`FAQ has ${faqQs} questions (want 4–6)`);
  const sources = html.match(/<h2[^>]*>\s*Sources\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  const sourceLinks = sources ? (sources[1].match(/href="https?:\/\//gi) || []).length : 0;
  if (sourceLinks < 3) fail(`Sources section has ${sourceLinks} links (want 3+)`);

  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
  const internal = hrefs.filter((h) => /^https:\/\/(?:www\.)?wedeepen\.com|^\/(?!\/)/.test(h));
  const external = [...new Set(hrefs.filter((h) => /^https?:\/\//.test(h) && !/(?:^|\.)wedeepen\.com/.test(new URL(h).hostname)))];
  if (internal.length < 3) fail(`${internal.length} links to the main site (want 3+)`);
  if (!hrefs.some((h) => /circle\.wedeepen\.com\/checkout|wedeepen\.com\/membership|^\/membership\//.test(h))) fail('no link to the membership (Circle checkout or /membership/)');
  for (const h of hrefs) if (!/^(https?:\/\/|\/|#|mailto:)/.test(h)) fail(`malformed link: ${h}`);

  const hits = SIGNATURE.filter((p) => lower.includes(p));
  if (hits.length < 2) fail(`only ${hits.length} signature phrase(s) (want 2+): ${hits.join(', ') || 'none'}`);
  if (!lower.includes('come play with us')) fail('missing the canonical invitation "Come play with us"');
  for (const [re, label, pre] of BANNED) if (re.test(pre ? pre(text) : text)) fail(`banned language: ${label}`);
  if (/\bas an ai\b|in today['’]s fast-paced world|delve into|in conclusion,/i.test(text)) fail('generic AI phrasing');
  for (const m of text.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)) {
    const n = m[1].replace(/,/g, '').replace(/\.00$/, '');
    if (!ALLOWED_PRICES.has(n)) fail(`price $${m[1]} is not on the WeDeepen offer list; don't quote other organizations' prices`);
  }

  if (checkLinks) {
    await Promise.all(external.map(async (u) => {
      try {
        let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA } });
        if ([400, 403, 405].includes(r.status)) r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA } });
        if (r.status === 404 || r.status === 410) fail(`dead link (${r.status}): ${u}`);
        else if (!r.ok) warn(`link returned ${r.status} (often bot-blocking; verify): ${u}`);
      } catch (e) {
        const code = e.cause?.code || e.name;
        if (/ENOTFOUND|EAI_AGAIN|ERR_INVALID_URL/.test(code)) fail(`unreachable link (${code}): ${u}`);
        else warn(`could not fetch (${code}): ${u}`);
      }
    }));
  }

  console.log(`check-page ${sec.id}/${slug}: ${words} words, ${h2s} H2s, ${faqQs} FAQs, ${internal.length} main-site / ${external.length} external links, voice: ${hits.join(', ')}`);
  for (const w of warns) console.log(`  WARN: ${w}`);
  for (const f of fails) console.log(`  FAIL: ${f}`);
  console.log(fails.length ? `  RESULT: FAIL (${fails.length})` : '  RESULT: PASS');
  if (fails.length) anyFail = true;
}
process.exit(anyFail ? 1 : 0);

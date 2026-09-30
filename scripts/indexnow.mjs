#!/usr/bin/env node
/**
 * indexnow.mjs — tell Bing (and every IndexNow engine) which pages changed.
 *
 * ChatGPT search and Copilot lean on Bing's index, so pinging IndexNow gets
 * new and edited pages picked up in hours instead of waiting for a recrawl.
 * The key is public by design: it's served at /00ff8f3e6dd569ed43ecfca151e7cfc5.txt to prove ownership.
 *
 * Usage: node scripts/indexnow.mjs <changed files...>
 *   Maps repo files (e.g. blog/foo/index.html) to URLs and submits them.
 *   Non-page files are ignored; with none left it does nothing.
 */
const KEY = '00ff8f3e6dd569ed43ecfca151e7cfc5';
const HOST = 'wedeepen.com';
const toUrl = (f) => {
  if (f === 'index.html') return `https://${HOST}/`;
  if (f.endsWith('/index.html')) return `https://${HOST}/${encodeURI(f.slice(0, -'index.html'.length))}`;
  if (/^(llms(-full)?\.txt|sitemap\.xml|blog\/feed\.xml)$/.test(f)) return `https://${HOST}/${f}`;
  return null;
};
// Skip noindex stubs and the 404 page; they shouldn't be submitted.
const SKIP = /^(404\.html|(bi|bl|eo|zoom|sms|text|ipo|bc26|invest-in-love|become-a-partner|inpersonoffer|membership)\/|love-immersion\/index\.html$)/;
const urls = [...new Set(process.argv.slice(2).filter((f) => !SKIP.test(f)).map(toUrl).filter(Boolean))].slice(0, 10000);
if (!urls.length) { console.log('indexnow: no page URLs to submit'); process.exit(0); }
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
// 200/202 = accepted; anything else is reported but never fails a deploy.
console.log(`indexnow: submitted ${urls.length} URL(s), HTTP ${res.status}`);
if (![200, 202].includes(res.status)) console.log(`::warning::IndexNow returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

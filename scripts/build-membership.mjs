#!/usr/bin/env node
/**
 * build-membership.mjs — /membership/ is a copy of the homepage.
 *
 * Ad traffic goes to /membership/ so it can be measured on its own, but the
 * page should say exactly what the homepage says. This rebuilds
 * membership/index.html from index.html, changing only what has to differ:
 *   - noindex (the homepage is the page that ranks; no duplicate in search)
 *   - canonical + og:url point at /membership/
 *   - title says Membership, so ad and analytics reports are easy to read
 *   - Meta ViewContent fires after PageView (membership-intent signal)
 *   - no JSON-LD (the homepage owns the Organization/FAQ structured data)
 *
 * Edit index.html, never membership/index.html. Then run
 * `node scripts/build-membership.mjs` and `npm run nav:sync` (it marks the
 * active menu item). The membership-mirror workflow does both on push.
 * Add --check to exit non-zero if membership/index.html is out of date.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'membership', 'index.html');
const URL = 'https://wedeepen.com/membership/';
const TITLE = 'WeDeepen Membership | Get better at love, one week at a time';

function replaceOnce(html, pattern, replacement, label) {
  const next = html.replace(pattern, replacement);
  if (next === html) throw new Error(`build-membership: couldn't find ${label} in index.html`);
  return next;
}

export function buildMembership(home) {
  let html = home;
  html = replaceOnce(html, /<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">', 'robots meta');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${URL}">`, 'canonical');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${URL}">`, 'og:url');
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${TITLE}</title>`, 'title');
  html = replaceOnce(html, /^([ \t]*)fbq\('track', 'PageView'\);\n/m,
    (m, indent) => `${m}${indent}fbq('track', 'ViewContent', { content_name: 'WeDeepen Membership', content_category: 'Membership' });\n`,
    'Meta PageView');
  html = html.replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n/g, '');
  html = replaceOnce(html, /<html([^>]*)>/,
    '<!-- Generated from index.html by scripts/build-membership.mjs. Edit index.html instead. -->\n<html$1>',
    '<html> tag');
  return html;
}

const CHECK = process.argv.includes('--check');
const next = buildMembership(fs.readFileSync(SRC, 'utf8'));
if (CHECK) {
  // nav:sync rewrites the menu block afterwards, so compare outside it.
  const strip = (s) => s.replace(/<!-- nav:links -->[\s\S]*?<!-- \/nav:links -->/g, '');
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (strip(current) !== strip(next)) { console.log('membership: out of date with index.html'); process.exit(1); }
  console.log('membership: in sync');
} else {
  fs.writeFileSync(OUT, next);
  console.log('membership: rebuilt from index.html');
}

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
 *   - membership-only conversion copy (hero subhead, price-card line,
 *     closing headline) and no Love Immersion spotlight; homepage unchanged
 *
 * It also writes membership/b/index.html: the same page, told apart only for
 * the A/B test (GA4 content_group 'Membership B', Meta ViewContent name,
 * utm_content=membership-b on checkout links, og:url). Canonical stays on
 * /membership/.
 *
 * Edit index.html, never membership/index.html or membership/b/index.html. Then run
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
const OUT_B = path.join(ROOT, 'membership', 'b', 'index.html');
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

  // ---- Membership-only copy (ad landing page). The homepage keeps its own copy. ----
  // Hero subhead echoes the ads ("love is a trainable skill").
  html = replaceOnce(html,
    /WeDeepen is where you go to master dating, intimacy, and relationships alongside leading experts and a community committed to practicing love\./,
    'Love is a skill. Most of us were never taught it. Here, we practice it out loud, with experts who&rsquo;ve spent their careers on it.',
    'hero subhead');
  // Price-card line: lead with value, not fear.
  html = replaceOnce(html,
    /\$99 a month is nothing next to what getting it wrong costs: years of your life, bad dates, divorce, starting over\./,
    'You&rsquo;ve spent years getting good at your work. This is 90 minutes a week for the thing that shapes everything else.',
    'price-card line');
  // Keep ad traffic on the $99 decision: drop the Love Immersion spotlight (FAQ still covers it).
  html = replaceOnce(html,
    /[ \t]*<!-- =+\s*SECTION 5: LOVE IMMERSION SPOTLIGHT[\s\S]*?(?=[ \t]*<!-- =+\s*SECTION 6: PHOTO GALLERY PREVIEW)/,
    '', 'Love Immersion spotlight');
  // Closing CTA in Christina's voice; single action.
  html = replaceOnce(html,
    /Make love a <span class="italic" style="color:#C9A277;">lifelong practice\.<\/span>/,
    'Come play <span class="italic" style="color:#C9A277;">with us.</span>',
    'closing headline');
  html = replaceOnce(html,
    /[ \t]*<a href="\/love-immersion\/[^"]*" class="btn-outline text-base">Attend Love Immersion<\/a>\n/,
    '', 'closing Love Immersion button');
  html = html.replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n/g, '');
  html = replaceOnce(html, /<html([^>]*)>/,
    '<!-- Generated from index.html by scripts/build-membership.mjs. Edit index.html instead. -->\n<html$1>',
    '<html> tag');
  return html;
}

// /membership/b/: the A/B test twin. Same page; only the measurement differs.
export function buildMembershipB(membership) {
  let html = membership;
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${URL}b/">`, 'og:url (B)');
  html = replaceOnce(html, /gtag\('config', 'G-LZ0EY5X593'\);/,
    "gtag('config', 'G-LZ0EY5X593', { content_group: 'Membership B', page_variant: 'B' });", 'GA4 config (B)');
  html = replaceOnce(html, /content_name: 'WeDeepen Membership'/, "content_name: 'WeDeepen Membership B'", 'ViewContent name (B)');
  html = replaceOnce(html, /(checkout\/wedeepen-club-membership\?price_id=\d+)"/g, '$1&amp;utm_content=membership-b"', 'checkout links (B)');
  html = replaceOnce(html, /Edit index\.html instead\. -->/, 'Edit index.html instead (B: see buildMembershipB). -->', 'generated note (B)');
  return html;
}

const CHECK = process.argv.includes('--check');
const next = buildMembership(fs.readFileSync(SRC, 'utf8'));
const outputs = [[OUT, next, 'membership'], [OUT_B, buildMembershipB(next), 'membership/b']];
// nav:sync rewrites the menu block afterwards, so compare outside it.
const strip = (s) => s.replace(/<!-- nav:links -->[\s\S]*?<!-- \/nav:links -->/g, '');
let stale = false;
for (const [file, html, label] of outputs) {
  if (CHECK) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (strip(current) !== strip(html)) { console.log(`${label}: out of date with index.html`); stale = true; }
    else console.log(`${label}: in sync`);
  } else {
    fs.writeFileSync(file, html);
    console.log(`${label}: rebuilt from index.html`);
  }
}
if (stale) process.exit(1);

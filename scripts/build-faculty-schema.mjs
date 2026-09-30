#!/usr/bin/env node
/**
 * build-faculty-schema.mjs — stamp /love-guides/ with CollectionPage + ItemList JSON-LD.
 *
 * Reads the faculty straight from the page (the featured STRATEGIST sections
 * and the full-council cards), so the markup can't drift from what visitors
 * see. Each teacher becomes a Person with name, specialty, bio, photo and the
 * links shown on their card. Couples ("A & B") are listed by name only.
 *
 * Run after editing love-guides/index.html:  node scripts/build-faculty-schema.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'love-guides/index.html');
const SITE = 'https://wedeepen.com';
const URL = `${SITE}/love-guides/`;
const START = '<!-- faculty:ld -->';
const END = '<!-- /faculty:ld -->';

const text = (s) => String(s || '').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&#8217;/g, '’').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
const abs = (u) => (u && u.startsWith('/') ? SITE + u : u);
const sameAs = (block) => [...block.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*target="_blank"/g)]
  .map((m) => m[1]).filter((u) => !/wedeepen\.com/.test(u));

function person({ name, jobTitle, description, image, links, id }) {
  // "Katie & Gay Hendricks" is two people; don't pretend it's one Person.
  if (/&/.test(name)) return { '@type': 'Thing', name };
  const p = { '@type': 'Person', name, jobTitle: jobTitle || undefined, description: description || undefined,
    image: abs(image) || undefined, sameAs: links.length ? links : undefined, memberOf: { '@id': `${SITE}/#organization` } };
  if (id) p['@id'] = id;
  return JSON.parse(JSON.stringify(p));
}

let html = await fs.readFile(PAGE, 'utf8');
const people = [];

// Featured faculty: one <section> per STRATEGIST comment.
for (const m of html.matchAll(/<!-- STRATEGIST \d+: [^>]*-->([\s\S]*?)<\/section>/g)) {
  const b = m[1];
  const name = text((b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1]);
  if (!name) continue;
  people.push(person({
    name,
    jobTitle: text((b.match(/class="specialty-tag[^"]*">([\s\S]*?)<\/span>/) || [])[1]),
    description: text((b.match(/<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [])[1]),
    image: (b.match(/<img src="([^"]+)"/) || [])[1],
    links: sameAs(b),
    id: /^Christina Weber$/.test(name) ? `${SITE}/about/#christina-weber` : undefined,
  }));
}

// Full council cards.
for (const m of html.matchAll(/<div class="council-card">([\s\S]*?)<div class="council-links">([\s\S]*?)<\/div>/g)) {
  const b = m[1];
  people.push(person({
    name: text((b.match(/class="council-name">([\s\S]*?)<\/h3>/) || [])[1]),
    jobTitle: text((b.match(/class="council-specialty">([\s\S]*?)<\/p>/) || [])[1]),
    description: text((b.match(/class="council-bio">([\s\S]*?)<\/p>/) || [])[1]),
    image: (b.match(/<img src="([^"]+)"/) || [])[1],
    links: sameAs(m[2]),
  }));
}
if (people.length < 10) throw new Error(`build-faculty-schema: only found ${people.length} faculty; the page layout changed.`);

const ld = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${URL}#webpage`,
  url: URL,
  name: 'WeDeepen Faculty',
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
  mainEntity: {
    '@type': 'ItemList',
    name: 'WeDeepen faculty',
    numberOfItems: people.length,
    itemListElement: people.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: p })),
  },
};
const block = `${START}\n  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2).replace(/</g, '\\u003c')}\n  </script>\n  ${END}`;
html = html.includes(START)
  ? html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length)
  : html.replace('</head>', `  ${block}\n</head>`);
await fs.writeFile(PAGE, html, 'utf8');
console.log(`Stamped ${people.length} faculty into love-guides/index.html`);

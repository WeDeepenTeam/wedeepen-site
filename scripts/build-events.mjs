#!/usr/bin/env node
/**
 * build-events.mjs — bake upcoming events into /events/ as static HTML.
 *
 * /events/ fills its grid in the browser from the circle-events function, so
 * crawlers that don't run JavaScript (GPTBot, PerplexityBot, ClaudeBot) saw
 * only "Loading events…". This writes the first page of upcoming events into
 * the grid, an ItemList of Event JSON-LD into <head>, and refreshes
 * events/events.json (the page's own fallback source). The page's script
 * still loads the live list on top for visitors.
 *
 * If the function fails or returns nothing, the page is left untouched, so
 * the last good build stays live.
 *
 * Run: node scripts/build-events.mjs   (daily from .github/workflows/events-sync.yml)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'events/index.html');
const JSON_OUT = path.join(ROOT, 'events/events.json');
const API = 'https://oycfonjaufdihuwjecxu.supabase.co/functions/v1/circle-events';
const SITE = 'https://wedeepen.com';
const ORG = `${SITE}/#organization`;
const CALENDAR = 'https://circle.wedeepen.com/c/member-s-calendar';
// Same as the page script: grid shows three rows before "Load more".
const PAGE_SIZE = 9;
// Keep the JSON-LD list to a sensible size; the recurring series repeat.
const LD_LIMIT = 30;

// Must match EVENT_URL_OVERRIDES in events/index.html.
const EVENT_URL_OVERRIDES = [
  { match: /wedeepen in-person/i, url: '/inperson/' },
  { match: /biohacking love/i, url: '/biohacking-love/' },
  { match: /kashf/i, url: '/kashf/' },
  { match: /love immersion/i, url: '/love-immersion/october-2026/' },
];
const resolveUrl = (e) => (EVENT_URL_OVERRIDES.find((o) => o.match.test(e.title || '')) || {}).url || e.url;
const absUrl = (u) => (u.startsWith('http') ? u : `${SITE}${u}`);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonForScript = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

function replaceBetween(html, start, end, content) {
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`build-events: markers ${start} .. ${end} not found in events/index.html`);
  return html.slice(0, a + start.length) + content + html.slice(b);
}

const formatDate = (iso) => new Date(iso + 'T00:00:00Z')
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// Mirrors renderEvents() in the page so the baked cards match the live ones.
function card(e) {
  const online = e.location_type === 'online';
  const locIcon = online
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const chips = [`<span class="chip">${locIcon}${online ? 'Online' : 'Austin'}</span>`];
  if (e.location_label && e.location_label !== (online ? 'Online' : 'Austin, TX') && e.location_label !== 'Online') chips.push(`<span class="chip">${esc(e.location_label)}</span>`);
  const t = e.topics || [];
  const access = t.includes('Open to Everyone') ? 'Open to Everyone'
    : t.includes('WeDeepen Members') ? 'Included with Membership'
    : t.includes('Love Club') && !t.includes('In-Person') ? 'Love Club' : '';
  if (access) chips.push(`<span class="chip">${access}</span>`);
  if (e.tag) chips.push(`<span class="chip">${esc(e.tag)}</span>`);
  if (e.recurring) chips.push('<span class="chip">Recurring</span>');
  const bg = e.image_url && e.image_url.startsWith('http')
    ? `background-image: url('${esc(e.image_url)}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #A01B4A 0%, #3a0818 100%);';
  const url = resolveUrl(e);
  return `
          <a href="${esc(url)}" class="event-card"${url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>
            <div class="event-card__image" style="${bg}"></div>
            <div class="event-card__body">
              <div class="event-card__chips">${chips.join('')}</div>
              <h3 class="event-card__title">${esc(e.title)}</h3>
              <div class="event-card__meta">
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><time datetime="${esc(e.starts_at_iso)}">${formatDate(e.date)}</time></span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${esc(e.time)} CT</span>
              </div>
              <p class="event-card__desc">${esc(e.description)}</p>
              <span class="event-card__cta">Learn more →</span>
            </div>
          </a>`;
}

function eventLd(e) {
  const online = e.location_type === 'online';
  const t = e.topics || [];
  const ld = {
    '@type': 'Event',
    name: e.title,
    description: e.description || undefined,
    startDate: e.starts_at_iso,
    endDate: e.ends_at_iso || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: online
      ? { '@type': 'VirtualLocation', url: CALENDAR }
      : { '@type': 'Place', name: e.location_label || 'Austin, TX', address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' } },
    image: e.image_url && e.image_url.startsWith('http') ? [e.image_url] : undefined,
    organizer: { '@id': ORG },
    url: absUrl(resolveUrl(e)),
  };
  // Member sessions are included in the $99/month Membership.
  if (t.includes('WeDeepen Members') && !t.includes('Open to Everyone') && !t.includes('In-Person')) {
    ld.offers = { '@type': 'Offer', price: '99.00', priceCurrency: 'USD', url: `${SITE}/`, availability: 'https://schema.org/InStock', description: 'Included with WeDeepen Membership' };
  }
  return JSON.parse(JSON.stringify(ld)); // drop undefined fields
}

let data;
try {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
} catch (err) {
  console.warn(`::warning::build-events: circle-events fetch failed (${err.message}); keeping the last good build.`);
  process.exit(0);
}

const now = Date.now();
const events = (data.events || [])
  .filter((e) => e.title && e.starts_at_iso && new Date(e.ends_at_iso || e.starts_at_iso).getTime() >= now)
  .sort((a, b) => a.starts_at_iso.localeCompare(b.starts_at_iso));
if (!events.length) {
  console.warn('::warning::build-events: no upcoming events returned; keeping the last good build.');
  process.exit(0);
}

let html = await fs.readFile(PAGE, 'utf8');
html = replaceBetween(html, '<!-- events:static -->', '<!-- /events:static -->',
  events.slice(0, PAGE_SIZE).map(card).join('') + '\n          ');
html = replaceBetween(html, '<!-- events:count -->', '<!-- /events:count -->',
  events.length > PAGE_SIZE ? `Showing ${PAGE_SIZE} of ${events.length} events` : `${events.length} event${events.length === 1 ? '' : 's'}`);
html = replaceBetween(html, '<!-- events:ld -->', '<!-- /events:ld -->', `
  <script type="application/ld+json">
${jsonForScript({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Upcoming WeDeepen events',
  itemListElement: events.slice(0, LD_LIMIT).map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: eventLd(e) })),
})}
  </script>
  `);
await fs.writeFile(PAGE, html, 'utf8');
// The function stamps last_updated on every call; only rewrite the fallback
// when the events themselves change, so the job doesn't commit every run.
let previous = null;
try { previous = JSON.parse(await fs.readFile(JSON_OUT, 'utf8')); } catch {}
if (JSON.stringify(previous?.events) !== JSON.stringify(data.events)) {
  await fs.writeFile(JSON_OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
console.log(`Baked ${Math.min(events.length, PAGE_SIZE)} event cards and ${Math.min(events.length, LD_LIMIT)} Event JSON-LD items (${events.length} upcoming)`);

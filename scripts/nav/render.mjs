/**
 * Renders the site nav links from scripts/nav/links.json.
 * Shared by build-nav.mjs (stamps every page) and the gallery page shell
 * (generates new pages), so both always agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NAV_LINKS = JSON.parse(fs.readFileSync(path.join(HERE, 'links.json'), 'utf8')).links;

export const START = '<!-- nav:links -->';
export const END = '<!-- /nav:links -->';

// Classes match the hand-written nav on index.html. The active page gets
// full-white text on desktop; mobile links are already full white.
const DESKTOP = 'text-white/80 hover:text-white transition';
const DESKTOP_ACTIVE = 'text-white hover:text-white transition';
const MOBILE = 'text-white hover:text-gold transition';

function isActive(link, pagePath) {
  const prefix = link.activePrefix || link.href;
  return pagePath !== '/' && pagePath.startsWith(prefix);
}

/**
 * @param {'desktop'|'mobile'} variant
 * @param {string} pagePath  URL path of the page being rendered, e.g. "/events/"
 * @param {string} indent    leading whitespace for each line
 */
export function renderNavLinks(variant, pagePath = '/', indent = '') {
  const lines = NAV_LINKS.map((l) => {
    const cls = variant === 'mobile' ? MOBILE : isActive(l, pagePath) ? DESKTOP_ACTIVE : DESKTOP;
    return `${indent}<a href="${l.href}" class="${cls}">${l.label}</a>`;
  });
  return [`${indent}${START}`, ...lines, `${indent}${END}`].join('\n');
}

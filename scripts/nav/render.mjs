/**
 * Renders the site nav links from scripts/nav/links.json.
 * Shared by build-nav.mjs (stamps every page) and the gallery page shell
 * (generates new pages), so both always agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'links.json'), 'utf8'));
export const NAV_LINKS = CONFIG.links;
export const NAV_CTA = CONFIG.cta || [];

export const START = '<!-- nav:links -->';
export const END = '<!-- /nav:links -->';
export const CTA_START = '<!-- nav:cta -->';
export const CTA_END = '<!-- /nav:cta -->';

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

// Header call-to-action pair (Log In / Join). Desktop sits right of the menu;
// mobile stacks at the bottom of the slide-out menu.
const CTA_DESKTOP = {
  primary: 'btn-rose text-sm !py-2.5 !px-6 whitespace-nowrap hidden sm:inline-block',
  quiet: 'text-white/80 hover:text-white transition text-sm font-medium whitespace-nowrap hidden sm:inline-block',
};
const CTA_MOBILE = {
  primary: 'btn-rose text-center mt-4',
  quiet: 'text-white/70 hover:text-white transition text-center',
};

export function renderNavCta(variant, indent = '') {
  const classes = variant === 'mobile' ? CTA_MOBILE : CTA_DESKTOP;
  // Mobile: filled button first, quiet link under it. Desktop: quiet, then filled.
  const items = variant === 'mobile' ? [...NAV_CTA].sort((a) => (a.style === 'primary' ? -1 : 1)) : NAV_CTA;
  const lines = items.map((c) => `${indent}<a href="${c.href}" class="${classes[c.style] || classes.quiet}">${c.label}</a>`);
  return [`${indent}${CTA_START}`, ...lines, `${indent}${CTA_END}`].join('\n');
}

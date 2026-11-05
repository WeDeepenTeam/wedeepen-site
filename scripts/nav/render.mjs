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
export const FOOTER_LINKS = CONFIG.footer || [];

export const START = '<!-- nav:links -->';
export const END = '<!-- /nav:links -->';
export const CTA_START = '<!-- nav:cta -->';
export const CTA_END = '<!-- /nav:cta -->';
export const FOOTER_START = '<!-- footer:learn -->';
export const FOOTER_END = '<!-- /footer:learn -->';

// Classes match the hand-written nav on index.html. The active page gets
// full-white text on desktop; mobile links are already full white.
const DESKTOP = 'text-white/80 hover:text-white transition';
const DESKTOP_ACTIVE = 'text-white hover:text-white transition';
const MOBILE = 'text-white hover:text-gold transition';

function isActive(link, pagePath) {
  // activePrefix may be one path or a list (a menu is active on any of its pages).
  const prefixes = [].concat(link.activePrefix || link.href);
  return prefixes.some((prefix) => {
    // A link to the homepage is active only on the homepage; "/" is a prefix
    // of every path, so it can't use the startsWith rule.
    if (prefix === '/') return pagePath === '/';
    return pagePath !== '/' && pagePath.startsWith(prefix);
  });
}

// A link with `children` is a menu. Desktop: the label still links to its own
// href, and the panel opens on hover or keyboard focus (focus also covers a
// tap on tablets). Mobile: the label becomes a small heading over the items.
const BADGE = 'ml-2 inline-block align-middle rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gold text-ink';
const label = (c) => c.badge ? `${c.label}<span class="${BADGE}">${c.badge}</span>` : c.label;
const CHEVRON = '<svg class="w-3 h-3 opacity-70 transition group-hover:rotate-180 group-focus-within:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';

function renderMenu(variant, l, pagePath, indent) {
  if (variant === 'mobile') {
    return [
      `${indent}<div class="flex flex-col gap-3">`,
      `${indent}  <span class="text-white/45 text-xs uppercase tracking-[0.2em]">${l.label}</span>`,
      ...l.children.map((c) => `${indent}  <a href="${c.href}" class="${MOBILE} pl-4">${label(c)}</a>`),
      `${indent}</div>`,
    ].join('\n');
  }
  const cls = isActive(l, pagePath) ? DESKTOP_ACTIVE : DESKTOP;
  return [
    `${indent}<div class="relative group">`,
    `${indent}  <a href="${l.href}" class="${cls} inline-flex items-center gap-1" aria-haspopup="true">${l.label}${CHEVRON}</a>`,
    `${indent}  <div class="absolute left-1/2 -translate-x-1/2 top-full pt-4 hidden group-hover:block group-focus-within:block z-50">`,
    `${indent}    <div class="min-w-[230px] rounded-xl border border-white/10 bg-ink shadow-2xl py-2">`,
    ...l.children.map((c) => `${indent}      <a href="${c.href}" class="flex items-center px-5 py-2.5 whitespace-nowrap ${isActive(c, pagePath) ? 'text-white' : 'text-white/75'} hover:text-white hover:bg-white/5 transition">${label(c)}</a>`),
    `${indent}    </div>`,
    `${indent}  </div>`,
    `${indent}</div>`,
  ].join('\n');
}

/**
 * @param {'desktop'|'mobile'} variant
 * @param {string} pagePath  URL path of the page being rendered, e.g. "/events/"
 * @param {string} indent    leading whitespace for each line
 */
export function renderNavLinks(variant, pagePath = '/', indent = '') {
  const lines = NAV_LINKS.map((l) => {
    if (l.children) return renderMenu(variant, l, pagePath, indent);
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

// "Learn" row at the top of the footer: the reading pages that aren't in the
// menu, so every page links to them.
export function renderFooterLearn(indent = '') {
  const links = FOOTER_LINKS.map((l) => `${indent}  <a href="${l.href}" class="hover:text-gold transition">${l.label}</a>`);
  return [
    `${indent}${FOOTER_START}`,
    `${indent}<nav aria-label="Learn" class="max-w-site mx-auto px-6 mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/50 text-xs">`,
    `${indent}  <span class="uppercase tracking-widest text-white/55">Learn</span>`,
    ...links,
    `${indent}</nav>`,
    `${indent}${FOOTER_END}`,
  ].join('\n');
}

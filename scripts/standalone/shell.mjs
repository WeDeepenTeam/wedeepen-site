/**
 * shell.mjs — shared page shell for the standalone sections.
 *
 * A "standalone section" works exactly like /blog/: it is generated from a
 * data file, it carries the normal site header and footer (so every page
 * links out to the main site), but nothing on the main site links in. Search
 * engines and AI tools find it through sitemap.xml, llms.txt, llms-full.txt
 * and IndexNow instead of through the nav.
 *
 * The shell is borrowed from podcast/index.html at build time, the same way
 * scripts/build-blog.mjs does it, so header/footer changes flow through and
 * can't drift. The helpers are copied from build-blog.mjs rather than
 * imported because that script runs its build on import.
 */
import { renderNavLinks, renderNavCta, START, END, CTA_START, CTA_END } from '../nav/render.mjs';

export const SITE = 'https://wedeepen.com';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// JSON inside <script> must not be able to close the tag.
export const jsonForScript = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

export const safeSlug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

export const prettyDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

// FAQPage markup built from the FAQ the reader actually sees (<h2>FAQ</h2>
// followed by <h3> questions), so the schema can't drift from the page.
export function faqFromHtml(html) {
  const m = String(html || '').match(/<h2[^>]*>\s*(?:FAQ|FAQs|Frequently asked questions)\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  if (!m) return null;
  const items = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi;
  let q;
  while ((q = re.exec(m[1]))) {
    const name = stripTags(q[1]);
    const text = stripTags(q[2]);
    if (name && text) items.push({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } });
  }
  return items.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items } : null;
}

function slice(src, startMarker, endMarker, from = 0) {
  const a = src.indexOf(startMarker, from);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a === -1 || b === -1) {
    throw new Error(`standalone shell: could not find ${JSON.stringify(startMarker)} .. ${JSON.stringify(endMarker)} in podcast/index.html. The donor shell changed; update scripts/standalone/shell.mjs.`);
  }
  return src.slice(a, b);
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Restamp the borrowed nav for this section, exactly as build-nav.mjs would.
function stampNav(html, urlPath) {
  let n = 0;
  html = html.replace(new RegExp(`^([ \\t]*)${reEsc(START)}[\\s\\S]*?${reEsc(END)}`, 'gm'),
    (_, indent) => renderNavLinks(n++ === 0 ? 'desktop' : 'mobile', urlPath, indent));
  let c = 0;
  return html.replace(new RegExp(`^([ \\t]*)${reEsc(CTA_START)}[\\s\\S]*?${reEsc(CTA_END)}`, 'gm'),
    (_, indent) => renderNavCta(c++ === 0 ? 'desktop' : 'mobile', indent));
}

export function borrowShell(donor, urlPath) {
  const head = donor.slice(donor.indexOf('<head>') + '<head>'.length, donor.indexOf('</head>'))
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
    .replace('<script src="https://cdn.tailwindcss.com"></script>', '<script src="https://cdn.tailwindcss.com?plugins=typography"></script>');
  if (!head.includes('plugins=typography')) {
    throw new Error('standalone shell: could not enable the Tailwind typography plugin; the donor\'s Tailwind <script> tag changed.');
  }
  let top = slice(donor, '<body class="bg-ink text-white">', '\n  <section');
  top = stampNav(top.replace(/\s*<!--(?:(?!-->)[\s\S])*-->\s*$/, '\n'), urlPath);
  for (const needle of ['id="wd-header"', 'id="mobile-nav"', 'id="mobile-toggle"']) {
    if (!top.includes(needle)) throw new Error(`standalone shell: borrowed shell is missing ${needle}. The donor layout changed.`);
  }
  const footer = slice(donor, '  <footer class="bg-ink border-t', '  <script>');
  return { head, top, footer };
}

// Swap the donor's page-identity tags for this page's.
export function identify(head, { title, description, url, image, type, keywords }) {
  head = head
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[\s\S]*?">/, `<meta name="description" content="${esc(description)}">`)
    .replace(/<meta name="keywords" content="[\s\S]*?">/, keywords ? `<meta name="keywords" content="${esc(keywords)}">` : '')
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${type}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`);
  if (image) {
    head = head
      .replace(/\s*<meta property="og:image:(?:width|height|type|alt)" content="[^"]*">/g, '')
      .replace(/\s*<meta name="twitter:image:alt" content="[^"]*">/g, '')
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`)
      .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(image)}">`);
  }
  return head;
}

const tail = `  <script>
    const header = document.getElementById('wd-header');
    window.addEventListener('scroll', () => { header.classList.toggle('scrolled', window.scrollY > 50); });
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileClose = document.getElementById('mobile-close');
    const mobileNav = document.getElementById('mobile-nav');
    mobileToggle.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    mobileNav.querySelectorAll('a').forEach(l => l.addEventListener('click', () => mobileNav.classList.remove('open')));
  </script>
  <script src="/js/lead-capture.js?v=47" defer></script>
  <script src="/js/mobile-site.js?v=1" defer></script>
</body>
</html>
`;

export const page = (shell, meta, jsonLds, body) => `<!DOCTYPE html>
<html lang="en">
<head>
${identify(shell.head, meta).trim()}
${jsonLds.filter(Boolean).map((j) => `
  <script type="application/ld+json">
${jsonForScript(j)}
  </script>`).join('')}
</head>
${shell.top}
${body}

${shell.footer}${tail}`;

// Replace this section's sitemap entries in place (same approach as the blog:
// a full build-sitemap.mjs run would churn every lastmod from CI mtimes).
export function sitemapWithSection(xml, urlPath, entries) {
  const re = new RegExp(`\\s*<url>\\s*<loc>${reEsc(SITE + urlPath)}[\\s\\S]*?<\\/url>`, 'g');
  const kept = xml.replace(re, '');
  const block = entries.map((u) => `
  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');
  return kept.replace(/\s*<\/urlset>\s*$/, `${block}\n</urlset>\n`);
}

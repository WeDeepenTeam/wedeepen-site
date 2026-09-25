#!/usr/bin/env node
/**
 * build-blog.mjs — generate /blog/ from BabyLoveGrowth articles.
 *
 * BabyLoveGrowth writes SEO articles for us. Rather than let it host them on
 * its own subdomain (with its own design and footer we can't control), we pull
 * them over its API and render them as real pages of wedeepen.com:
 *
 *   /blog/                 index of every article, newest first
 *   /blog/<slug>/          one page per article
 *
 * Two stages:
 *   1. Sync (only when BLG_API_KEY is set): fetch every article over the API
 *      and write blog/data/articles.json. The API is rate-limited and asks
 *      callers to sync into their own storage, never to call it per page view.
 *   2. Render: build the pages from blog/data/articles.json. Runs without a
 *      key, so the pages can be rebuilt offline from the committed data.
 *
 * The blog is deliberately not in the site nav (scripts/nav/links.json). It is
 * reachable through the sitemap and from the articles themselves.
 *
 * The page shell (head, header, mobile nav, footer) is borrowed from
 * podcast/index.html at build time, the same way build-podcast-archive.mjs
 * does it, so shell changes flow through here and can't drift.
 *
 * Run: node scripts/build-blog.mjs          (render from committed data)
 *      BLG_API_KEY=... node scripts/build-blog.mjs   (sync, then render)
 * In CI this runs daily from .github/workflows/blog-sync.yml.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNavLinks, renderNavCta, START, END, CTA_START, CTA_END } from './nav/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DONOR = path.join(ROOT, 'podcast/index.html');
const BLOG_DIR = path.join(ROOT, 'blog');
const DATA = path.join(BLOG_DIR, 'data/articles.json');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://wedeepen.com';
const URL_PATH = '/blog/';
// BLG_API_BASE points the sync at a local mock server for testing.
const API = process.env.BLG_API_BASE || 'https://api.babylovegrowth.ai/api/integrations/v1';
// Where BabyLoveGrowth hosted the blog before. Its articles link to each
// other through this host; those links are rewritten to our /blog/ pages.
const OLD_HOSTS = ['blog.wedeepen.com'];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// JSON inside <script> must not be able to close the tag.
const jsonForScript = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

// Slugs become directory names, so allow only URL-safe characters.
const safeSlug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// --- 1. Sync ----------------------------------------------------------------

async function api(pathAndQuery, attempt = 0) {
  const res = await fetch(`${API}${pathAndQuery}`, {
    headers: { 'X-API-Key': process.env.BLG_API_KEY, 'Content-Type': 'application/json' },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = 2 ** attempt * 1000;
    console.warn(`  ${res.status} on ${pathAndQuery}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return api(pathAndQuery, attempt + 1);
  }
  if (!res.ok) throw new Error(`build-blog: ${res.status} ${res.statusText} on GET ${pathAndQuery}`);
  return res.json();
}

// The docs don't pin the envelope; accept a bare array or a wrapped one.
const listOf = (body) => (Array.isArray(body) ? body : body.articles || body.data || body.items || []);
const itemOf = (body) => body.article || body.data || body;

async function sync() {
  const LIMIT = 50;
  const summaries = [];
  for (let offset = 0; ; offset += LIMIT) {
    const page = listOf(await api(`/articles?limit=${LIMIT}&offset=${offset}`));
    summaries.push(...page);
    if (page.length < LIMIT) break;
  }

  // Full content only comes from the single-article endpoint. Reuse what we
  // already have for articles that provably haven't changed, to stay under the
  // rate limit. BabyLoveGrowth's "Improvements" feature edits live articles,
  // so without an updated_at to compare, always refetch.
  const previous = new Map((await readData()).map((a) => [String(a.id), a]));
  const articles = [];
  for (const s of summaries) {
    const prev = previous.get(String(s.id));
    const unchanged = prev && prev.content_html && s.updated_at && s.updated_at === prev.updated_at;
    articles.push(unchanged ? prev : pick(itemOf(await api(`/articles/${encodeURIComponent(s.id)}`))));
  }

  await fs.mkdir(path.dirname(DATA), { recursive: true });
  await fs.writeFile(DATA, JSON.stringify({ articles }, null, 2) + '\n', 'utf8');
  console.log(`Synced ${articles.length} article${articles.length === 1 ? '' : 's'} from BabyLoveGrowth`);
}

// Keep only the fields we render, so the committed data stays small and
// stable when the API adds fields we don't use.
const pick = (a) => ({
  id: a.id,
  slug: a.slug,
  title: a.title,
  excerpt: a.excerpt,
  meta_description: a.meta_description,
  hero_image_url: a.hero_image_url,
  created_at: a.created_at,
  updated_at: a.updated_at,
  languageCode: a.languageCode,
  keywords: a.keywords,
  content_html: a.content_html,
  jsonLd: a.jsonLd,
  faqJsonLd: a.faqJsonLd,
});

async function readData() {
  try { return JSON.parse(await fs.readFile(DATA, 'utf8')).articles || []; }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

// --- 2. Render --------------------------------------------------------------

function slice(src, startMarker, endMarker, from = 0) {
  const a = src.indexOf(startMarker, from);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a === -1 || b === -1) {
    throw new Error(`build-blog: could not find ${JSON.stringify(startMarker)} .. ${JSON.stringify(endMarker)} in podcast/index.html. The donor shell changed; update this script.`);
  }
  return src.slice(a, b);
}

// Restamp the borrowed nav for /blog/, exactly as build-nav.mjs would, so
// `npm run nav:check` stays clean without a separate nav:sync pass.
function stampNav(html) {
  let n = 0;
  html = html.replace(new RegExp(`^([ \\t]*)${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm'),
    (_, indent) => renderNavLinks(n++ === 0 ? 'desktop' : 'mobile', URL_PATH, indent));
  let c = 0;
  return html.replace(new RegExp(`^([ \\t]*)${CTA_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${CTA_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm'),
    (_, indent) => renderNavCta(c++ === 0 ? 'desktop' : 'mobile', indent));
}

function borrowShell(donor) {
  const head = donor.slice(donor.indexOf('<head>') + '<head>'.length, donor.indexOf('</head>'))
    // The donor's JSON-LD describes the podcast; each page gets its own.
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
    // Articles are styled with the typography plugin's `prose` classes.
    .replace('<script src="https://cdn.tailwindcss.com"></script>', '<script src="https://cdn.tailwindcss.com?plugins=typography"></script>');
  if (!head.includes('plugins=typography')) {
    throw new Error('build-blog: could not enable the Tailwind typography plugin; the donor\'s Tailwind <script> tag changed.');
  }
  let top = slice(donor, '<body class="bg-ink text-white">', '\n  <section');
  top = stampNav(top.replace(/\s*<!--(?:(?!-->)[\s\S])*-->\s*$/, '\n'));
  for (const needle of ['id="wd-header"', 'id="mobile-nav"', 'id="mobile-toggle"']) {
    if (!top.includes(needle)) throw new Error(`build-blog: borrowed shell is missing ${needle}. The donor layout changed; update the split markers.`);
  }
  const footer = slice(donor, '  <footer class="bg-ink border-t', '  <script>');
  return { head, top, footer };
}

// Swap the donor's page-identity tags for this page's.
function identify(head, { title, description, url, image, type }) {
  head = head
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[\s\S]*?">/, `<meta name="description" content="${esc(description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${type}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`);
  if (image) {
    // The donor's image dimensions and alt text describe its square cover art.
    head = head
      .replace(/\s*<meta property="og:image:(?:width|height|type|alt)" content="[^"]*">/g, '')
      .replace(/\s*<meta name="twitter:image:alt" content="[^"]*">/g, '')
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`)
      .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(image)}">`);
  }
  return head;
}

// Article HTML comes from a third party. Strip anything that can run code,
// allow only YouTube embeds, and point old-host links at our own pages.
function cleanHtml(html, slugs) {
  html = String(html || '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<(style|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(link|meta|base)\b[^>]*>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, (m) =>
      /\ssrc="https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\//i.test(m) ? m : '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data):[^"']*\2/gi, '$1="#"');
  for (const host of OLD_HOSTS) {
    const re = new RegExp(`href="https?://${host.replace(/\./g, '\\.')}(?:/blog)?/([a-z0-9-]+)/?"`, 'gi');
    html = html.replace(re, (m, slug) => (slugs.has(slug) ? `href="${URL_PATH}${slug}/"` : m));
    html = html.replace(new RegExp(`href="https?://${host.replace(/\./g, '\\.')}/?"`, 'gi'), `href="${URL_PATH}"`);
  }
  return html;
}

const dateOf = (a) => (a.created_at || '').slice(0, 10);
const prettyDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

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
  <script src="/js/lead-capture.js?v=20" defer></script>
</body>
</html>
`;

const page = (shell, meta, jsonLds, body) => `<!DOCTYPE html>
<html lang="${esc(meta.lang || 'en')}">
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

function articlePage(shell, a, slugs) {
  const url = `${SITE}${URL_PATH}${a.slug}/`;
  const description = a.meta_description || a.excerpt || '';
  // Our URL is canonical, whatever the article's own schema says.
  const articleLd = a.jsonLd && typeof a.jsonLd === 'object'
    ? { ...a.jsonLd, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url } }
    : {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: a.title,
      description,
      image: a.hero_image_url || undefined,
      datePublished: a.created_at,
      dateModified: a.updated_at || a.created_at,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      publisher: { '@type': 'Organization', name: 'WeDeepen', url: SITE },
    };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE}${URL_PATH}` },
      { '@type': 'ListItem', position: 2, name: a.title, item: url },
    ],
  };
  const faqLd = a.faqJsonLd && typeof a.faqJsonLd === 'object' ? a.faqJsonLd : null;

  const body = `  <!-- ============================
       ARTICLE
       ============================ -->
  <section class="pt-32 md:pt-40 pb-10 px-6">
    <div class="max-w-3xl mx-auto">
      <a href="${URL_PATH}" class="text-gold text-sm hover:underline inline-flex items-center gap-2 mb-6">&larr; All articles</a>
      <p class="text-white/40 text-xs tracking-[0.25em] uppercase font-semibold mb-3"><time datetime="${esc(a.created_at)}">${esc(prettyDate(a.created_at))}</time></p>
      <h1 class="font-heading text-4xl md:text-5xl font-normal leading-[1.1] tracking-tight">${esc(a.title)}</h1>
    </div>
  </section>

  <section class="pb-20 md:pb-28 px-4 sm:px-6">
    <div class="max-w-3xl mx-auto bg-white rounded-2xl px-5 py-8 sm:px-10 sm:py-12">
${a.hero_image_url ? `      <img src="${esc(a.hero_image_url)}" alt="${esc(a.title)}" class="w-full rounded-xl mb-10" loading="eager">\n` : ''}      <article class="prose prose-gray prose-img:mx-auto prose-img:max-h-[400px] prose-img:object-contain prose-table:my-8 prose-a:text-[#A01B4A] max-w-none">
${cleanHtml(a.content_html, slugs)}
      </article>
    </div>
  </section>`;

  return page(shell, { title: `${a.title} | WeDeepen`, description, url, image: a.hero_image_url, type: 'article', lang: a.languageCode },
    [articleLd, faqLd, breadcrumb], body);
}

function indexPage(shell, articles) {
  const url = `${SITE}${URL_PATH}`;
  const TITLE = 'The WeDeepen Blog | Relationships, Intimacy & Connection';
  const DESC = 'Research-backed articles from WeDeepen on relationships, intimacy, communication, and building deeper connection.';
  const cards = articles.map((a) => `        <a href="${URL_PATH}${a.slug}/" class="group block rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-gold/40 transition">
${a.hero_image_url ? `          <img src="${esc(a.hero_image_url)}" alt="" class="w-full aspect-[16/9] object-cover" loading="lazy">\n` : ''}          <div class="p-6">
            <p class="text-white/40 text-xs mb-2"><time datetime="${esc(a.created_at)}">${esc(prettyDate(a.created_at))}</time></p>
            <h2 class="font-heading text-xl font-semibold leading-snug group-hover:text-gold transition mb-2">${esc(a.title)}</h2>
            <p class="text-white/60 text-sm leading-relaxed">${esc(a.excerpt || a.meta_description || '')}</p>
          </div>
        </a>`).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: TITLE,
    description: DESC,
    url,
    publisher: { '@type': 'Organization', name: 'WeDeepen', url: SITE },
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `${SITE}${URL_PATH}${a.slug}/`,
      datePublished: a.created_at,
    })),
  };

  const body = `  <!-- ============================
       BLOG INDEX
       ============================ -->
  <section class="pt-32 md:pt-40 pb-12 px-6">
    <div class="max-w-5xl mx-auto">
      <p class="text-gold text-xs tracking-[0.25em] uppercase font-semibold mb-3">The Blog</p>
      <h1 class="font-heading text-4xl md:text-5xl font-normal leading-[1.1] tracking-tight mb-5">Articles on love and connection</h1>
      <p class="text-white/60 leading-relaxed max-w-2xl">${esc(DESC)}</p>
    </div>
  </section>

  <section class="pb-24 md:pb-32 px-6">
    <div class="max-w-5xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
${cards || '        <p class="text-white/50">New articles are on the way.</p>'}
    </div>
  </section>`;

  return page(shell, { title: TITLE, description: DESC, url, image: null, type: 'website' }, [jsonLd], body);
}

// Replace the sitemap's /blog/ entries in place. build-sitemap.mjs dates every
// URL by file mtime, which a CI checkout resets, so a full rebuild from the
// daily job would churn every lastmod in the file.
async function updateSitemap(articles) {
  const xml = await fs.readFile(SITEMAP, 'utf8');
  const kept = xml.replace(/\s*<url>\s*<loc>https:\/\/wedeepen\.com\/blog\/[\s\S]*?<\/url>/g, '');
  const newest = articles.reduce((m, a) => (a.updated_at || a.created_at || '') > m ? (a.updated_at || a.created_at) : m, '');
  const entries = [
    { loc: `${SITE}${URL_PATH}`, lastmod: newest.slice(0, 10), changefreq: 'weekly', priority: '0.8' },
    ...articles.map((a) => ({ loc: `${SITE}${URL_PATH}${a.slug}/`, lastmod: (a.updated_at || a.created_at || '').slice(0, 10), changefreq: 'monthly', priority: '0.6' })),
  ].map((u) => `
  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');
  const out = kept.replace(/\s*<\/urlset>\s*$/, `${entries}\n</urlset>\n`);
  if (out !== xml) await fs.writeFile(SITEMAP, out, 'utf8');
}

async function render() {
  const shell = borrowShell(await fs.readFile(DONOR, 'utf8'));
  const articles = (await readData())
    .map((a) => ({ ...a, slug: safeSlug(a.slug || a.title) }))
    .filter((a) => a.slug && a.title && a.content_html && a.slug !== 'data')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const slugs = new Set(articles.map((a) => a.slug));

  // Remove pages for articles that no longer exist upstream.
  for (const entry of await fs.readdir(BLOG_DIR, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && entry.name !== 'data' && !slugs.has(entry.name)) {
      await fs.rm(path.join(BLOG_DIR, entry.name), { recursive: true });
      console.log(`  removed blog/${entry.name}/`);
    }
  }

  await fs.mkdir(BLOG_DIR, { recursive: true });
  await fs.writeFile(path.join(BLOG_DIR, 'index.html'), indexPage(shell, articles), 'utf8');
  for (const a of articles) {
    await fs.mkdir(path.join(BLOG_DIR, a.slug), { recursive: true });
    await fs.writeFile(path.join(BLOG_DIR, a.slug, 'index.html'), articlePage(shell, a, slugs), 'utf8');
  }
  await updateSitemap(articles);
  console.log(`Wrote blog/index.html and ${articles.length} article page${articles.length === 1 ? '' : 's'}`);
}

if (process.env.BLG_API_KEY) await sync();
await render();

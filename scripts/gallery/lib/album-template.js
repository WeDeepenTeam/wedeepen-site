import { escapeHtml } from './escape-html.js';
import { pageHead, pageNav, pageFooter, pageScripts } from './page-shell.js';

const SITE = 'https://wedeepen.com';
const PAGE_SIZE = 100;

export function renderAlbumPage(album, photos) {
  const cover = album.cover_full_url || photos[0]?.full_url || `${SITE}/images/og-image.jpg`;
  // WhatsApp-safe og:image: JPEG, <150KB. Falls back to the WebP cover if no
  // generated JPEG exists yet (run `node scripts/gallery/generate-og-jpegs.js`).
  const ogImage = `${SITE}/images/og/gallery-${album.slug}.jpg`;
  const description = albumDescription(album, photos.length);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: album.title,
    description,
    url: `${SITE}/gallery/${album.slug}/`,
    image: photos.slice(0, 30).map((p, i) => ({
      '@type': 'ImageObject',
      contentUrl: p.full_url,
      thumbnailUrl: p.thumb_url,
      width: p.width,
      height: p.height,
      caption: photoAlt(p, i, album),
    })),
    publisher: {
      '@type': 'Organization',
      name: 'WeDeepen',
      url: SITE,
    },
    ...(album.event_date ? { dateCreated: album.event_date } : {}),
    ...(album.location ? { contentLocation: { '@type': 'Place', name: album.location } } : {}),
  });

  const initialPhotos = photos.slice(0, PAGE_SIZE);
  const remainingPhotos = photos.slice(PAGE_SIZE);

  return `${pageHead({
    title: `${album.title} Photos | WeDeepen`,
    description,
    canonical: `${SITE}/gallery/${album.slug}/`,
    ogImage,
    jsonLd,
  })}
<body class="bg-ink text-white">
${pageNav()}

  <main id="main">
    <!-- Hero -->
    <section class="relative pt-32 md:pt-40 pb-12 md:pb-16 px-6">
      <div class="max-w-site mx-auto reveal">
        <a href="/gallery/" class="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          All galleries
        </a>
        <p class="text-[11px] md:text-xs uppercase tracking-[0.35em] text-white/50 font-medium mb-4">WeDeepen &middot; Gallery</p>
        <h1 class="font-heading text-[2.2rem] md:text-[3rem] lg:text-[3.6rem] font-normal leading-[1.15] mb-5 max-w-4xl">
          ${escapeHtml(album.title)}
        </h1>
        <div class="flex flex-wrap items-center gap-3 text-white/55 text-sm mb-6">
          ${album.location ? `<span>${escapeHtml(album.location)}</span><span class="w-1 h-1 rounded-full bg-white/30"></span>` : ''}
          <span>${photos.length} photo${photos.length === 1 ? '' : 's'}</span>
          ${album.photographer ? `<span class="w-1 h-1 rounded-full bg-white/30"></span><span>Photos by ${escapeHtml(album.photographer)}</span>` : ''}
        </div>
        ${album.description ? `<p class="text-white/70 text-base md:text-lg leading-relaxed font-light max-w-3xl">${escapeHtml(album.description)}</p>` : ''}
      </div>
    </section>

    ${album.youtube_ids?.length ? renderVideos(album.youtube_ids) : ''}
${album.cta_href ? `
    <!-- Top CTA -->
    <section class="px-6 pb-12">
      <div class="max-w-site mx-auto reveal">
        <div class="rounded-2xl p-7 md:p-9" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
          ${album.cta_eyebrow ? `<p class="text-gold text-xs tracking-[0.2em] uppercase font-medium mb-4">${escapeHtml(album.cta_eyebrow)}</p>` : ''}
          ${album.cta_heading ? `<h2 class="font-heading text-2xl md:text-3xl lg:text-4xl text-white font-normal leading-snug mb-4 max-w-3xl">${escapeHtml(album.cta_heading)}</h2>` : ''}
          ${album.cta_body ? `<p class="text-white/60 text-base md:text-lg leading-relaxed font-light mb-7 max-w-3xl">${escapeHtml(album.cta_body)}</p>` : ''}
          <div class="flex flex-col sm:flex-row items-center gap-4">
            <a href="${escapeHtml(album.cta_href)}" class="btn-rose">${escapeHtml(album.cta_label || 'View Upcoming Events')} &rarr;</a>
            <a href="/gallery/" class="text-white/70 hover:text-white transition font-medium">All Galleries &rarr;</a>
          </div>
        </div>
      </div>
    </section>
` : ''}
    <!-- Photo grid -->
    <section class="px-4 md:px-6 pb-12">
      <div class="max-w-site mx-auto">
        <div id="photo-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
          ${initialPhotos.map((p, i) => renderTile(p, i, album)).join('\n          ')}
        </div>
        ${remainingPhotos.length ? `
        <div id="more-container" class="text-center mt-10">
          <button id="load-more" class="btn-outline" data-remaining="${remainingPhotos.length}">
            Load more &middot; <span id="remaining-count">${remainingPhotos.length}</span> more
          </button>
        </div>
        <template id="more-photos">${remainingPhotos.map((p, i) => renderTile(p, PAGE_SIZE + i, album)).join('')}</template>
        ` : ''}
      </div>
    </section>

    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button class="lightbox-btn lightbox-close" aria-label="Close">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button class="lightbox-btn lightbox-prev" aria-label="Previous photo">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button class="lightbox-btn lightbox-next" aria-label="Next photo">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <img class="lightbox-img" alt="" id="lightbox-img">
      <div class="lightbox-counter" id="lightbox-counter"></div>
    </div>

    <!-- Bottom CTA -->
    <section class="bg-cream text-charcoal py-20 md:py-24 px-6 mt-12">
      <div class="max-w-3xl mx-auto text-center reveal">${album.cta_image && album.cta_href ? `
        <a href="${escapeHtml(album.cta_href)}" class="block mb-9 rounded-xl overflow-hidden" style="box-shadow: 0 12px 40px rgba(0,0,0,0.25);">
          <img src="${escapeHtml(album.cta_image)}" alt="${escapeHtml(album.cta_image_alt || album.cta_label || 'The next event')}" class="w-full h-auto" loading="lazy" width="1600" height="800">
        </a>` : ''}
        <h2 class="font-heading text-3xl md:text-4xl font-normal mb-5">Want to be at the next one?</h2>
        <p class="text-charcoal/70 text-lg leading-relaxed mb-8 font-light">
          ${album.cta_tagline ? escapeHtml(album.cta_tagline) : `${escapeHtml(album.title)} happened. The next gathering is forming.`}
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="${escapeHtml(album.cta_href || '/events/')}" class="btn-rose">${escapeHtml(album.cta_label || 'View Upcoming Events')} &rarr;</a>
          <a href="/gallery/" class="text-charcoal/70 hover:text-charcoal transition font-medium">All Galleries &rarr;</a>
        </div>
      </div>
    </section>
  </main>

${pageFooter()}
${pageScripts()}

<script>
  // Lightbox + Load more
  (function() {
    const grid = document.getElementById('photo-grid');
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbCounter = document.getElementById('lightbox-counter');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    let currentIndex = 0;

    function tiles() { return Array.from(grid.querySelectorAll('.photo-tile')); }

    // Retry thumbnails that fail to load. Supabase Storage rate-limits (429) when a big
    // album fires hundreds of requests at once, and the limit can last several seconds.
    // Up to 8 attempts with exponential backoff + jitter, and at most 4 retries in flight
    // so the retries themselves don't trip the limit again. Retries reuse the plain URL:
    // the CDN caches it after one success, while a cache-busting param would send every
    // retry back to Supabase.
    const MAX_TRIES = 8, MAX_INFLIGHT = 4;
    const retryQueue = [];
    let inflight = 0;
    function pump() {
      while (inflight < MAX_INFLIGHT && retryQueue.length) {
        const img = retryQueue.shift();
        inflight++;
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          inflight--;
          pump();
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        img.src = img.src.split('?')[0];
      }
    }
    grid.addEventListener('error', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const tries = Number(img.dataset.retry || 0);
      if (tries >= MAX_TRIES) return;
      img.dataset.retry = String(tries + 1);
      const delay = Math.min(20000, 1000 * 2 ** tries) + Math.random() * 1000;
      setTimeout(() => { retryQueue.push(img); pump(); }, delay);
    }, true);

    // Same retry for the full-size photo in the lightbox.
    lbImg.addEventListener('error', () => {
      const src = lbImg.getAttribute('src');
      if (!src) return;
      const tries = Number(lbImg.dataset.retry || 0);
      if (tries >= MAX_TRIES) return;
      lbImg.dataset.retry = String(tries + 1);
      const delay = Math.min(20000, 1000 * 2 ** tries) + Math.random() * 1000;
      setTimeout(() => { if (lbImg.getAttribute('src') === src) lbImg.src = src; }, delay);
    });

    function open(index) {
      const all = tiles();
      currentIndex = Math.max(0, Math.min(index, all.length - 1));
      const t = all[currentIndex];
      lbImg.dataset.retry = '0';
      lbImg.src = t.dataset.full;
      lbImg.alt = t.dataset.alt || '';
      lbCounter.textContent = (currentIndex + 1) + ' / ' + all.length;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function close() {
      lightbox.classList.remove('open');
      lbImg.src = '';
      document.body.style.overflow = '';
    }
    function next() { open(currentIndex + 1 < tiles().length ? currentIndex + 1 : 0); }
    function prev() { open(currentIndex - 1 >= 0 ? currentIndex - 1 : tiles().length - 1); }

    grid.addEventListener('click', (e) => {
      const tile = e.target.closest('.photo-tile');
      if (!tile) return;
      e.preventDefault();
      const all = tiles();
      open(all.indexOf(tile));
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tile = e.target.closest('.photo-tile');
        if (!tile) return;
        e.preventDefault();
        const all = tiles();
        open(all.indexOf(tile));
      }
    });
    closeBtn.addEventListener('click', close);
    nextBtn.addEventListener('click', next);
    prevBtn.addEventListener('click', prev);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    });

    // Load more
    const loadMore = document.getElementById('load-more');
    if (loadMore) {
      loadMore.addEventListener('click', () => {
        const tpl = document.getElementById('more-photos');
        if (tpl) {
          grid.insertAdjacentHTML('beforeend', tpl.innerHTML);
          tpl.remove();
        }
        document.getElementById('more-container').remove();
      });
    }
  })();
</script>
<script>
  // Download mode (?download=1, for the WeDeepen team): dragging a photo to the desktop,
  // or the lightbox "Save JPEG" button, saves a JPEG instead of the WebP the page shows.
  // The file name and the embedded EXIF copyright mark it as WeDeepen's.
  (function() {
    if (new URLSearchParams(location.search).get('download') !== '1') return;
    const grid = document.getElementById('photo-grid');
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbCounter = document.getElementById('lightbox-counter');
    if (!grid || !lightbox) return;

    const albumName = (document.querySelector('h1') || {}).textContent || 'WeDeepen';
    const base = albumName.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const year = new Date().getFullYear();
    const COPYRIGHT = 'Copyright ' + year + ' WeDeepen. All rights reserved. Not for resale. wedeepen.com';

    function fileName(n) {
      return base + '-' + String(n).padStart(3, '0') + '-Copyright-WeDeepen-All-Rights-Reserved.jpg';
    }

    // EXIF APP1 segment with ImageDescription, Artist and Copyright (ASCII, little-endian TIFF).
    function exifSegment(description) {
      const ascii = (s) => { const b = new Uint8Array(s.length + 1); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0x7f; return b; };
      const fields = [[0x010e, ascii(description)], [0x013b, ascii('WeDeepen')], [0x8298, ascii(COPYRIGHT)]];
      let dataOff = 8 + 2 + fields.length * 12 + 4;
      const size = dataOff + fields.reduce((a, f) => a + (f[1].length > 4 ? f[1].length : 0), 0);
      const tiff = new Uint8Array(size);
      const dv = new DataView(tiff.buffer);
      tiff.set([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
      dv.setUint16(8, fields.length, true);
      fields.forEach((f, i) => {
        const o = 10 + i * 12;
        dv.setUint16(o, f[0], true);
        dv.setUint16(o + 2, 2, true);
        dv.setUint32(o + 4, f[1].length, true);
        if (f[1].length <= 4) tiff.set(f[1], o + 8);
        else { dv.setUint32(o + 8, dataOff, true); tiff.set(f[1], dataOff); dataOff += f[1].length; }
      });
      const header = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif" + two NULs
      const len = 2 + header.length + tiff.length;
      const seg = new Uint8Array(2 + len);
      seg.set([0xff, 0xe1, len >> 8, len & 0xff]);
      seg.set(header, 4);
      seg.set(tiff, 4 + header.length);
      return seg;
    }

    async function fetchWithRetry(url) {
      for (let t = 0; ; t++) {
        const res = await fetch(url);
        if (res.ok) return res.blob();
        if (t >= 5) throw new Error('HTTP ' + res.status);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** t));
      }
    }

    // full-size URL -> Promise<blob: URL of the JPEG>; ready holds finished ones for dragstart.
    const pending = new Map();
    const ready = new Map();
    function jpegFor(url, n) {
      if (!pending.has(url)) {
        pending.set(url, (async () => {
          const bmp = await createImageBitmap(await fetchWithRetry(url));
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          canvas.getContext('2d').drawImage(bmp, 0, 0);
          const jpg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer());
          const exif = exifSegment(albumName.trim() + ', photo ' + n + '. ' + COPYRIGHT);
          const blobUrl = URL.createObjectURL(new Blob([jpg.subarray(0, 2), exif, jpg.subarray(2)], { type: 'image/jpeg' }));
          ready.set(url, blobUrl);
          return blobUrl;
        })().catch((err) => { pending.delete(url); throw err; }));
      }
      return pending.get(url);
    }

    function tiles() { return Array.from(grid.querySelectorAll('.photo-tile')); }
    function tileInfo(tile) { return { url: tile.dataset.full, n: tiles().indexOf(tile) + 1 }; }
    function lightboxInfo() {
      const n = parseInt(lbCounter.textContent, 10);
      return { url: lbImg.getAttribute('src'), n: n };
    }

    // Convert ahead of time (on hover / when the lightbox shows a photo) so the
    // JPEG is ready by the time the drag starts; dragstart can't wait for it.
    grid.addEventListener('pointerover', (e) => {
      const tile = e.target.closest('.photo-tile');
      if (tile) { const t = tileInfo(tile); jpegFor(t.url, t.n).catch(() => {}); }
    });
    function setDownload(e, info) {
      const blobUrl = ready.get(info.url);
      if (!blobUrl) { jpegFor(info.url, info.n).catch(() => {}); return; }
      e.dataTransfer.setData('DownloadURL', 'image/jpeg:' + fileName(info.n) + ':' + blobUrl);
    }
    grid.addEventListener('dragstart', (e) => {
      const tile = e.target.closest('.photo-tile');
      if (tile) setDownload(e, tileInfo(tile));
    });
    lbImg.setAttribute('draggable', 'true');
    lbImg.addEventListener('dragstart', (e) => setDownload(e, lightboxInfo()));
    lbImg.addEventListener('load', () => { const i = lightboxInfo(); if (i.url) jpegFor(i.url, i.n).catch(() => {}); });

    // Click fallback (works in any browser).
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'lightbox-btn';
    save.textContent = 'Save JPEG';
    save.style.cssText = 'top:20px;left:20px;width:auto;padding:0 18px;border-radius:999px;font-size:14px;';
    save.addEventListener('click', async (e) => {
      e.stopPropagation();
      const info = lightboxInfo();
      save.textContent = 'Preparing...';
      try {
        const a = document.createElement('a');
        a.href = await jpegFor(info.url, info.n);
        a.download = fileName(info.n);
        a.click();
        save.textContent = 'Save JPEG';
      } catch (err) {
        save.textContent = 'Try again';
      }
    });
    lightbox.appendChild(save);

    const note = document.createElement('div');
    note.textContent = 'Download mode: drag any photo to your desktop to save it as a JPEG.';
    note.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:60;background:#c2185b;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);';
    document.body.appendChild(note);
  })();
</script>
</body>
</html>`;
}

// Uploads often keep the camera or export filename as alt text
// ("WeDeepen_Love Immersion I_Allison Powers_002"). Describe those by album
// instead; real captions are kept as written.
const FILENAME_ALT = /_|\.(jpe?g|png|webp|heic)$|^(img|dsc|pxl)[\s_-]?\d|\d{3,}$/i;
export function photoAlt(p, i, album) {
  const alt = String(p.alt_text || '').trim();
  if (alt && !FILENAME_ALT.test(alt)) return alt;
  return `${album.title}, photo ${i + 1}${album.photographer ? ` by ${album.photographer}` : ''}`;
}

function renderTile(p, i, album) {
  const alt = photoAlt(p, i, album);
  return `<a href="${escapeHtml(p.full_url)}" class="photo-tile block aspect-square overflow-hidden rounded-md bg-charcoal/40" data-full="${escapeHtml(p.full_url)}" data-alt="${escapeHtml(alt)}" aria-label="${escapeHtml(alt)} (open photo ${i + 1})">
            <img src="${escapeHtml(p.thumb_url)}" alt="${escapeHtml(alt)}" class="w-full h-full object-cover" loading="lazy" width="400" height="400">
          </a>`;
}

function renderVideos(youtubeIds) {
  return `<section class="px-6 pb-10">
      <div class="max-w-site mx-auto">
        <h2 class="font-heading text-2xl md:text-3xl text-white mb-6">Watch</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${youtubeIds.map(id => `<div class="aspect-video rounded-lg overflow-hidden bg-black">
            <iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}" title="WeDeepen video" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
          </div>`).join('\n          ')}
        </div>
      </div>
    </section>`;
}

// Album description for search results. Short custom descriptions ("Heart
// Flow practice sessions.") are kept and topped up with what the page knows:
// photo count, photographer, and place/date when the text doesn't say them.
export function albumDescription(album, count) {
  const custom = String(album.description || '').trim();
  if (custom.length >= 70) return custom;
  const photos = `${count ? `${count} photos` : 'Photos'}${album.photographer ? ` by ${album.photographer}` : ''}`;
  // No date here: some albums carry a placeholder date (Jan 1 for "2025").
  const when = '';
  const where = album.location && !custom.includes(album.location) ? ` in ${album.location}` : '';
  if (!custom) return `${photos} from ${album.title}, a WeDeepen event${when}${where}.`;
  const lead = /[.!?]$/.test(custom) ? custom : `${custom}.`;
  return `${lead} ${photos}${when || where ? `, from WeDeepen${where}${when}` : ''}.`;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Dates are stored as YYYY-MM-DD (UTC midnight); format in UTC so a
  // US-timezone build doesn't print the day before.
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

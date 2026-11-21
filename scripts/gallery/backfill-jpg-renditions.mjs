#!/usr/bin/env node
/**
 * backfill-jpg-renditions.mjs — creates a .jpg sibling for every gallery
 * full rendition (<slug>/full/<hash>.webp -> <slug>/full/<hash>.jpg) so the
 * lightbox Download button can serve a JPEG instead of WebP.
 *
 * Idempotent: an existing .jpg is skipped (public HEAD check).
 * New uploads get the .jpg automatically from process-and-upload.js; this
 * script exists to convert albums uploaded before Nov 2026.
 *
 * Usage (from scripts/gallery, needs .env):
 *   node backfill-jpg-renditions.mjs            # all albums
 *   node backfill-jpg-renditions.mjs --album love-immersion-viii
 */
import sharp from 'sharp';
import { supabase } from './lib/supabase-admin.js';
import { putObject, objectExists, keyFromUrl } from './lib/r2.js';

const PARALLEL = 8;
const argIdx = process.argv.indexOf('--album');
const onlyAlbum = argIdx === -1 ? null : process.argv[argIdx + 1];

async function fetchAllMedia() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('gallery_media')
      .select('id, full_url, gallery_albums!gallery_media_album_id_fkey(slug)')
      .order('id', { ascending: true })
      .range(from, from + 999);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return onlyAlbum ? rows.filter(r => r.gallery_albums?.slug === onlyAlbum) : rows;
}

async function convertOne(row, stats) {
  const objPath = keyFromUrl(row.full_url);
  if (!objPath.endsWith('.webp')) { stats.nonwebp.push(objPath || row.full_url); return; }
  const jpgPath = objPath.replace(/\.webp$/, '.jpg');

  if (await objectExists(jpgPath)) { stats.skipped++; return; }

  const res = await fetch(row.full_url);
  if (!res.ok) { stats.failed.push(`${objPath} (fetch ${res.status})`); return; }
  const webpBuf = Buffer.from(await res.arrayBuffer());
  const jpgBuf = await sharp(webpBuf).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  try { await putObject(jpgPath, jpgBuf, 'image/jpeg'); }
  catch (e) { stats.failed.push(`${objPath} (upload: ${e.message})`); return; }
  stats.converted++;
}

const rows = await fetchAllMedia();
console.log(`${rows.length} photos${onlyAlbum ? ` in ${onlyAlbum}` : ''}`);
const stats = { converted: 0, skipped: 0, failed: [], nonwebp: [] };
let done = 0;
for (let i = 0; i < rows.length; i += PARALLEL) {
  await Promise.all(rows.slice(i, i + PARALLEL).map(r =>
    convertOne(r, stats).catch(e => stats.failed.push(`${r.full_url} (${e.message})`))
  ));
  done = Math.min(i + PARALLEL, rows.length);
  if (done % 400 < PARALLEL || done === rows.length) console.log(`progress: ${done}/${rows.length}`);
}
console.log(`DONE converted=${stats.converted} already-had-jpg=${stats.skipped} failed=${stats.failed.length} nonwebp=${stats.nonwebp.length}`);
if (stats.failed.length) console.log('FAILED:\n' + stats.failed.join('\n'));
if (stats.nonwebp.length) console.log('NON-WEBP (left as-is):\n' + stats.nonwebp.join('\n'));
process.exit(stats.failed.length ? 1 : 0);

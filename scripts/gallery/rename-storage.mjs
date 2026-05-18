#!/usr/bin/env node
/**
 * rename-storage.mjs — rename every gallery photo's storage objects + DB URLs
 * so the URL filename matches the desired download name (alt_text-derived).
 *
 * For each gallery_media row:
 *   - Compute new filename: safe(alt_text) + .webp
 *   - storage.move love-immersion-iv/full/<hash>.webp → love-immersion-iv/full/<new>.webp
 *   - storage.move love-immersion-iv/thumb/<hash>.webp → love-immersion-iv/thumb/<new>.webp
 *   - UPDATE gallery_media SET storage_path, full_url, thumb_url
 *
 * Idempotent: if a row's storage_path already matches the desired new name, skip.
 * Robust: each photo wrapped in try/catch; failures logged + skipped.
 * Concurrency: PARALLELISM=6 across moves.
 */
import { supabase, STORAGE_BUCKET, SUPABASE_URL } from './lib/supabase-admin.js';

const PARALLELISM = 6;

// Make a URL/filesystem-safe filename out of alt_text
function safeFilename(altText) {
  return altText
    // Strip diacritics (ĀTMA → ATMA, café → cafe)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // Drop apostrophes
    .replace(/['']/g, '')
    // Em/en dash → underscore (but collapse with surrounding spaces)
    .replace(/\s*[—–-]\s*/g, '_')
    // Spaces → underscore
    .replace(/\s+/g, '_')
    // Strip anything else that's not safe: keep alnum, underscore, hyphen, dot
    .replace(/[^A-Za-z0-9_.-]/g, '')
    // Collapse repeats
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function fetchAllPhotos() {
  // Pull in pages to dodge any default 1000-row cap
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('gallery_media')
      .select('id, album_id, source_filename, alt_text, content_hash, storage_path, full_url, thumb_url, gallery_albums(slug)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function processOne(row) {
  const slug = row.gallery_albums.slug;
  const newName = safeFilename(row.alt_text) + '.webp';
  const newFullPath = `${slug}/full/${newName}`;
  const newThumbPath = `${slug}/thumb/${newName}`;

  if (row.storage_path === newFullPath) {
    return { skipped: true };
  }

  const oldFullPath = row.storage_path;
  const oldThumbPath = row.storage_path.replace('/full/', '/thumb/');

  // Move full
  const m1 = await supabase.storage.from(STORAGE_BUCKET).move(oldFullPath, newFullPath);
  if (m1.error && !/already exists/i.test(m1.error.message || '')) throw new Error(`full move: ${m1.error.message}`);
  // Move thumb
  const m2 = await supabase.storage.from(STORAGE_BUCKET).move(oldThumbPath, newThumbPath);
  if (m2.error && !/already exists/i.test(m2.error.message || '')) throw new Error(`thumb move: ${m2.error.message}`);

  const newFullUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${newFullPath}`;
  const newThumbUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${newThumbPath}`;

  const upd = await supabase.from('gallery_media').update({
    storage_path: newFullPath,
    full_url: newFullUrl,
    thumb_url: newThumbUrl,
  }).eq('id', row.id);
  if (upd.error) throw new Error(`db update: ${upd.error.message}`);

  return { renamed: true, newName };
}

async function main() {
  console.log('Fetching all photos…');
  const rows = await fetchAllPhotos();
  console.log(`${rows.length} photos to process.`);

  let renamed = 0, skipped = 0, failed = 0;
  const startedAt = Date.now();

  for (let i = 0; i < rows.length; i += PARALLELISM) {
    const chunk = rows.slice(i, i + PARALLELISM);
    const results = await Promise.allSettled(chunk.map(processOne));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'rejected') {
        failed++;
        console.error(`  ✗ ${chunk[j].id} (${chunk[j].alt_text}): ${r.reason?.message || r.reason}`);
      } else if (r.value.skipped) {
        skipped++;
      } else {
        renamed++;
      }
    }
    if ((i + PARALLELISM) % 200 < PARALLELISM) {
      const pct = Math.round(((i + PARALLELISM) / rows.length) * 100);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.log(`  … ${i + PARALLELISM}/${rows.length} (${pct}%) ${elapsed}s elapsed | renamed=${renamed} skipped=${skipped} failed=${failed}`);
    }
  }

  console.log('');
  console.log(`Done. renamed=${renamed}  skipped=${skipped}  failed=${failed}  total=${rows.length}`);
  console.log(`Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });

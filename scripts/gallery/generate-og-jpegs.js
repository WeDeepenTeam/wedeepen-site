#!/usr/bin/env node
/**
 * generate-og-jpegs.js — for every published album, generate a WhatsApp-safe
 * JPEG og:image (1200x630, q=82, <100KB) and save to /images/og/gallery-<slug>.jpg.
 *
 * Source: each album's cover (or first) photo full-size WebP from Supabase.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { supabase } from './lib/supabase-admin.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OG_DIR = path.join(ROOT, 'images', 'og');

async function main() {
  const { data: albums, error } = await supabase
    .from('gallery_albums')
    .select('slug, cover:cover_media_id(full_url)')
    .eq('is_published', true)
    .eq('is_archived', false);
  if (error) throw error;

  for (const album of albums) {
    let coverUrl = album.cover?.full_url;
    if (!coverUrl) {
      const { data: first } = await supabase
        .from('gallery_media')
        .select('full_url')
        .eq('album_id', (await supabase.from('gallery_albums').select('id').eq('slug', album.slug).single()).data.id)
        .order('display_order', { ascending: true })
        .limit(1)
        .single();
      coverUrl = first?.full_url;
    }
    if (!coverUrl) { console.log(`  ⊘ ${album.slug}: no cover`); continue; }

    const res = await fetch(coverUrl);
    if (!res.ok) { console.log(`  ✗ ${album.slug}: fetch ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());

    const dst = path.join(OG_DIR, `gallery-${album.slug}.jpg`);
    await sharp(buf)
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(dst);
    const { size } = await fs.stat(dst);
    console.log(`  ✓ ${album.slug}: ${(size / 1024).toFixed(0)} KB → gallery-${album.slug}.jpg`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

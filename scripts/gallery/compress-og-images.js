#!/usr/bin/env node
/**
 * compress-og-images.js — generate WhatsApp-friendly JPEG versions of every
 * PNG in /images/og/ at the same dimensions, targeting <300 KB each.
 *
 * Output: alongside each og-*.png, write og-*.jpg.
 * Strategy: 1200×630 (standard OG dimensions), JPEG q=82, mozjpeg encoder.
 *
 * Usage:
 *   cd scripts/gallery && node compress-og-images.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OG_DIR = path.join(ROOT, 'images', 'og');

async function main() {
  const entries = await fs.readdir(OG_DIR);
  const pngs = entries.filter(f => f.endsWith('.png'));
  console.log(`Compressing ${pngs.length} OG PNGs → JPEG in ${OG_DIR}`);

  for (const png of pngs) {
    const src = path.join(OG_DIR, png);
    const dst = path.join(OG_DIR, png.replace(/\.png$/, '.jpg'));
    const meta = await sharp(src).metadata();
    await sharp(src)
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(dst);
    const { size } = await fs.stat(dst);
    const kb = (size / 1024).toFixed(0);
    const flag = size > 307200 ? '⚠️ over 300KB' : '✓';
    console.log(`  ${flag} ${png} (${meta.width}×${meta.height}) → ${path.basename(dst)} (${kb} KB)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

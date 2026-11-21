// Gallery photo storage: Cloudflare R2 bucket `wedeepen-gallery`, served at
// https://photos.wedeepen.com (R2 custom domain). Moved off Supabase Storage
// in Nov 2026 because the free plan's storage/egress quota was exceeded.
// Gallery metadata (albums, gallery_media rows) still lives in Supabase.
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

export const PUBLIC_BASE = (process.env.GALLERY_PUBLIC_BASE || 'https://photos.wedeepen.com').replace(/\/$/, '');
export const R2_BUCKET = process.env.R2_BUCKET || 'wedeepen-gallery';

/** Public URL for an object key like "<slug>/full/<name>.webp". */
export const publicUrl = (key) => `${PUBLIC_BASE}/${key}`;

/** Object key from a public URL (accepts the old Supabase URLs too). */
export function keyFromUrl(url) {
  const m = /\/(?:storage\/v1\/object\/public\/gallery\/)?([a-z0-9-]+\/(?:full|thumb)\/[^?#]+)$/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : '';
}

let client;
function r2() {
  if (client) return client;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in scripts/gallery/.env');
    console.error('Create a token: Cloudflare dashboard → R2 → Manage API tokens → Object Read & Write, bucket wedeepen-gallery only.');
    process.exit(2);
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return client;
}

/** Upload (overwrite) one object and return its public URL. */
export async function putObject(key, body, contentType) {
  await r2().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return publicUrl(key);
}

/** True if the object already exists in the bucket. */
export async function objectExists(key) {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false;
    throw e;
  }
}

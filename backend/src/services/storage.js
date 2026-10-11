// Storage driver: local disk by default; S3-compatible (AWS S3, Cloudflare R2, MinIO) when S3_BUCKET is set.
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

export const UPLOAD_DIR = path.resolve('uploads');
await fs.mkdir(UPLOAD_DIR, { recursive: true });

const bucket = process.env.S3_BUCKET;
const base = () => (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
let s3, sdk;
async function client() {
  if (!s3) {
    sdk = await import('@aws-sdk/client-s3');
    s3 = new sdk.S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
  }
  return s3;
}

// Returns the URL to store in the DB. Local: "/uploads/<path>". S3: absolute public URL.
export async function saveFile(localPath, key, contentType) {
  if (!bucket) return `/uploads/${path.relative(UPLOAD_DIR, localPath).split(path.sep).join('/')}`;
  const c = await client();
  await c.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(localPath), ContentType: contentType }));
  await fs.unlink(localPath).catch(() => {});
  return `${base()}/${key}`;
}
export async function removeFile(url) {
  if (!/^https?:/.test(url)) return fs.unlink(path.join(UPLOAD_DIR, path.basename(url)));
  const c = await client();
  await c.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: url.slice(base().length + 1) }));
}

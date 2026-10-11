import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../utils/prisma.js';
import { UPLOAD_DIR, saveFile } from '../../services/storage.js';
import { buildArgs } from './ffmpeg.build.js';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const EXPORT_DIR = path.join(UPLOAD_DIR, 'exports');
await fs.mkdir(EXPORT_DIR, { recursive: true });
const resolveFile = (m) => (/^https?:/.test(m.url) ? m.url : path.join(UPLOAD_DIR, path.basename(m.url)));

let running = 0; const queue = [];
export function enqueue(task) { queue.push(task); pump(); }
async function pump() {
  if (running >= 1 || !queue.length) return;
  running++;
  try { await queue.shift()(); } catch (e) { console.error(e); } finally { running--; pump(); }
}

export async function runExport({ jobId, userId, clips, settings, free }) {
  let tmp = [];
  try {
    const media = await prisma.projectMedia.findMany({ where: { id: { in: clips.map((c) => c.mediaId).filter(Boolean) }, userId } });
    const out = path.join(EXPORT_DIR, `${jobId}.${settings.format}`);
    const b = await buildArgs({ clips, media, resolveFile, settings, free, out });
    tmp = b.tmp;
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'PROCESSING', warnings: b.warnings } });
    await new Promise((ok, bad) => {
      const p = spawn(FFMPEG, b.args); let err = '', lastWrite = 0;
      p.stderr.on('data', (d) => { err = (err + d).slice(-600); });
      p.stdout.on('data', (d) => {
        const m = String(d).match(/out_time_ms=(\d+)/g);
        if (!m || Date.now() - lastWrite < 1000) return;
        lastWrite = Date.now();
        const sec = Number(m[m.length - 1].split('=')[1]) / 1e6;
        prisma.exportJob.update({ where: { id: jobId }, data: { progress: Math.min(99, Math.round((sec / b.D) * 100)) } }).catch(() => {});
      });
      p.on('error', () => bad(new Error('FFmpeg is not installed on the server.')));
      p.on('close', (code) => (code === 0 ? ok() : bad(new Error(`FFmpeg failed: ${err.trim().split('\n').slice(-2).join(' ')}`))));
    });
    const url = await saveFile(out, `exports/${jobId}.${settings.format}`, settings.format === 'mp4' ? 'video/mp4' : 'video/webm');
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'DONE', progress: 100, outputUrl: url } });
  } catch (e) {
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: String(e.message).slice(0, 500) } }).catch(() => {});
  } finally {
    await Promise.all(tmp.map((t) => fs.unlink(t).catch(() => {})));
  }
}

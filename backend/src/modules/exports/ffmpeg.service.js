import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../utils/prisma.js';
import { UPLOAD_DIR, saveFile } from '../../services/storage.js';
import { buildArgs } from './ffmpeg.build.js';
import { runFfmpeg, validateOutput } from './ffmpeg.runner.js';

const EXPORT_DIR = path.join(UPLOAD_DIR, 'exports');
await fs.mkdir(EXPORT_DIR, { recursive: true });
const resolveFile = (m) => {
  if (/^https?:/.test(m.url)) return m.url;
  if (m.url.startsWith('/library/')) return path.join(path.resolve('library'), path.basename(m.url)); // built-in music
  return path.join(UPLOAD_DIR, path.basename(m.url));
};
export const CANCELLED = 'Cancelled by user';

// one export at a time; queued jobs can be removed, a running one is stopped
let running = 0; const queue = [], active = new Map();
export function enqueue(jobId, task) { queue.push({ jobId, task }); pump(); }
async function pump() {
  if (running >= 1 || !queue.length) return;
  running++; const { task } = queue.shift();
  try { await task(); } catch (e) { console.error(e); } finally { running--; pump(); }
}
export async function cancelExport(jobId) {
  const i = queue.findIndex((q) => q.jobId === jobId);
  if (i >= 0) { queue.splice(i, 1); await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: CANCELLED } }); return true; }
  if (active.has(jobId)) { active.get(jobId).abort(); return true; }
  return false;
}

export async function runExport({ jobId, userId, clips, settings, free }) {
  let tmp = [], out = null; const ctl = new AbortController(); active.set(jobId, ctl);
  try {
    const media = await prisma.projectMedia.findMany({ where: { id: { in: clips.map((c) => c.mediaId).filter(Boolean) }, userId } });
    out = path.join(EXPORT_DIR, `${jobId}.${settings.format}`);
    const b = await buildArgs({ clips, media, resolveFile, settings, free, out });
    tmp = b.tmp;
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'PROCESSING', warnings: b.warnings } });
    await runFfmpeg({ args: b.args, duration: b.D, signal: ctl.signal, onProgress: (pct) => prisma.exportJob.update({ where: { id: jobId }, data: { progress: pct } }).catch(() => {}) });
    await validateOutput(out, { duration: b.D, expectAudio: b.hasAudio });          // never report success for a broken file
    const url = await saveFile(out, `exports/${jobId}.${settings.format}`, settings.format === 'mp4' ? 'video/mp4' : 'video/webm');
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'DONE', progress: 100, outputUrl: url } });
  } catch (e) {
    if (out) await fs.unlink(out).catch(() => {});                                  // no half-written files left behind
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: e.cancelled ? CANCELLED : String(e.message).slice(0, 500) } }).catch(() => {});
  } finally {
    active.delete(jobId);
    await Promise.all(tmp.map((t) => fs.unlink(t).catch(() => {})));
  }
}

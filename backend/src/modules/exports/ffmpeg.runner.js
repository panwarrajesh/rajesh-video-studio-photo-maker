import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';

const FFMPEG = () => process.env.FFMPEG_PATH || 'ffmpeg', FFPROBE = () => process.env.FFPROBE_PATH || 'ffprobe';
const friendly = (err) => {
  const tail = err.trim().split('\n').slice(-2).join(' ');
  if (/Invalid data found|moov atom not found|could not find codec/i.test(err)) return 'A media file in your project is damaged or in a format the server cannot read.';
  if (/No such file or directory/i.test(err)) return 'A media file of your project is missing on the server. Re-upload it.';
  return `FFmpeg failed: ${tail}`;
};

// Runs FFmpeg. `signal` (AbortController) cancels it. Rejects with { cancelled: true } when cancelled.
export function runFfmpeg({ args, duration, onProgress, signal }) {
  return new Promise((ok, bad) => {
    const p = spawn(FFMPEG(), args); let err = '', last = 0, killed = false;
    const abort = () => { killed = true; p.kill('SIGKILL'); };
    if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
    p.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    p.stdout.on('data', (d) => {
      const m = String(d).match(/out_time_ms=(\d+)/g);
      if (!m || Date.now() - last < 1000) return;
      last = Date.now(); onProgress?.(Math.min(99, Math.round((Number(m[m.length - 1].split('=')[1]) / 1e6 / duration) * 100)));
    });
    p.on('error', () => bad(new Error('FFmpeg is not installed on the server.')));
    p.on('close', (code) => {
      signal?.removeEventListener?.('abort', abort);
      if (killed) return bad(Object.assign(new Error('Cancelled by user'), { cancelled: true }));
      code === 0 ? ok() : bad(new Error(friendly(err)));
    });
  });
}

// "Success" is only reported after the file really exists and looks right: it has a video stream, the audio we expect, and about the right length.
export async function validateOutput(file, { duration, expectAudio, tolerance = 1.2 }) {
  const st = await fs.stat(file).catch(() => null);
  if (!st || st.size < 1024) throw new Error('The export finished but no valid file was created.');
  const r = spawnSync(FFPROBE(), ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  let info; try { info = JSON.parse(r.stdout); } catch { info = null; }
  if (!info?.streams?.length) throw new Error('The exported file is damaged (it cannot be read).');
  const has = (t) => info.streams.some((s) => s.codec_type === t), len = Number(info.format?.duration);
  if (!has('video')) throw new Error('The exported file has no video.');
  if (expectAudio && !has('audio')) throw new Error('The exported file has no audio, although your project has sound.');
  if (Number.isFinite(len) && Math.abs(len - duration) > tolerance) throw new Error(`The exported file has the wrong length (${len.toFixed(1)}s instead of ${duration.toFixed(1)}s).`);
  return { size: st.size, duration: len, audio: has('audio') };
}

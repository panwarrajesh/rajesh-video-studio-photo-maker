import { spawn } from 'child_process';
// Duration comes from the real file (ffprobe), never from what the client claims. Returns null when ffprobe is unavailable or the file is not media.
export const probeDuration = (file) => new Promise((ok) => {
  const p = spawn(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]); let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.on('error', () => ok(null));
  p.on('close', () => { const d = parseFloat(out); ok(Number.isFinite(d) && d > 0 && d < 86400 ? d : null); });
});

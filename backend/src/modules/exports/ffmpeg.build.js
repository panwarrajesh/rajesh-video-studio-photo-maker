import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg', FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

const num = (v, d, lo = -Infinity, hi = Infinity) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const f = (x) => Number(x).toFixed(3);
// FFmpeg filter syntax: use / in paths and escape ':' (matters on Windows: C:\Users\... -> C\:/Users/...)
const esc = (p) => String(p).replace(/\\/g, '/').replace(/:/g, '\\\\:');
const even = (x) => Math.max(2, Math.round(x / 2) * 2);

const col = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? `0x${v.slice(1)}` : d);

export function canvasSize(res, ratio) {
  const [a, b] = ratio.split(':').map(Number);
  return a >= b ? [even((res * a) / b), even(res)] : [even(res), even((res * b) / a)];
}
const hasAudio = (file) => new Promise((ok) => {
  const p = spawn(FFPROBE, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]);
  let o = ''; p.stdout.on('data', (d) => (o += d)); p.on('error', () => ok(false)); p.on('close', () => ok(o.trim().length > 0));
});
const tempo = (s) => { const o = []; while (s > 2) { o.push('atempo=2'); s /= 2; } while (s < 0.5) { o.push('atempo=0.5'); s /= 0.5; } o.push(`atempo=${f(s)}`); return o.join(','); };

// Approximations of the preview filters (preview uses CSS, export uses FFmpeg, so the look is close, not identical)
const FILTERS = {
  bright: (a) => `eq=brightness=${f(0.12 * a)}:saturation=${f(1 + 0.1 * a)}`,
  contrast: (a) => `eq=contrast=${f(1 + 0.5 * a)}`,
  warm: (a) => `colorbalance=rs=${f(0.15 * a)}:bs=${f(-0.15 * a)}`,
  cool: (a) => `colorbalance=rs=${f(-0.1 * a)}:bs=${f(0.15 * a)}`,
  vintage: (a) => `eq=saturation=${f(1 - 0.2 * a)}:contrast=${f(1 + 0.1 * a)},colorbalance=rs=${f(0.12 * a)}:bs=${f(-0.12 * a)}`,
  bw: (a) => `hue=s=${f(1 - a)}`,
  cinematic: (a) => `eq=contrast=${f(1 + 0.2 * a)}:saturation=${f(1 - 0.15 * a)}:brightness=${f(-0.04 * a)}`,
  fade: (a) => `eq=contrast=${f(1 - 0.25 * a)}:brightness=${f(0.05 * a)}:saturation=${f(1 - 0.3 * a)}`,
  highcontrast: (a) => `eq=contrast=${f(1 + a)}`,
  soft: (a) => `gblur=sigma=${f(Math.max(0.01, 1.2 * a))}`,
  night: (a) => `eq=brightness=${f(-0.2 * a)},colorbalance=bs=${f(0.2 * a)}`,
};

// Effects rendered in the export (time-windowed on the finished frame). Each returns one filter-graph segment: in -> out.
const chain = (x, ...fl) => `${x.in}${fl.join(',')}[${x.out}]`;
export const EFFECTS = {
  blur: (x) => chain(x, `gblur=sigma=${f(1 + x.i * 14)}:${x.w}`),
  motionblur: (x) => chain(x, `gblur=sigma=${f(2 + x.i * 18)}:sigmaV=0:${x.w}`),
  vignette: (x) => chain(x, `vignette=angle=${f(0.3 + x.i * 0.5)}:${x.w}`),
  noise: (x) => chain(x, `noise=alls=${Math.round(15 + x.i * 45)}:allf=t+u:${x.w}`),
  rgb: (x) => chain(x, `rgbashift=rh=${Math.round(2 + x.i * 10)}:bh=-${Math.round(2 + x.i * 10)}:${x.w}`),
  glitch: (x) => chain(x, `rgbashift=rh=${Math.round(4 + x.i * 14)}:bh=-${Math.round(4 + x.i * 14)}:${x.w}`, `noise=alls=${Math.round(20 + x.i * 40)}:allf=t:${x.w}`),
  lightleak: (x) => chain(x, `colorbalance=rs=${f(0.35 * x.i)}:gs=${f(0.12 * x.i)}:bs=${f(-0.25 * x.i)}:${x.w}`, `eq=brightness=${f(0.08 * x.i)}:${x.w}`),
  flash: (x) => chain(x, `drawbox=x=0:y=0:w=iw:h=ih:color=white@${f(0.8 * x.i)}:t=fill:enable='between(t,${f(x.s)},${f(Math.min(x.e, x.s + 0.3))})'`),
  fade: (x) => chain(x, `fade=t=out:st=${f(x.s)}:d=${f(Math.max(0.1, x.e - x.s))}:color=black`),
  pixelate: (x) => `${x.in}split[${x.id}a][${x.id}b];[${x.id}a]scale=${Math.max(2, Math.round(x.W / (6 + x.i * 40)))}:-2:flags=neighbor,scale=${x.W}:${x.H}:flags=neighbor[${x.id}p];[${x.id}b][${x.id}p]overlay=${x.w}[${x.out}]`,
  glow: (x) => `${x.in}split[${x.id}a][${x.id}b];[${x.id}b]gblur=sigma=14[${x.id}g];[${x.id}a][${x.id}g]blend=all_mode=screen:all_opacity=${f(0.7 * x.i)}:${x.w}[${x.out}]`,
};

export async function build({ clips, media, W, H, fps, D, free, resolveFile }) {
  const byId = new Map(media.map((m) => [m.id, m]));
  const inputs = [], g = [], audio = [], tmp = [], warn = new Set();
  const file = (c) => { const m = byId.get(c.mediaId); return m ? resolveFile(m) : null; };
  const textFile = async (txt) => { const p = path.join(os.tmpdir(), `rvs-${crypto.randomUUID()}.txt`); await fs.writeFile(p, txt); tmp.push(p); return p; };
  const fontPath = process.env.FFMPEG_FONT || (process.platform === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '');
  const font = fontPath ? `:fontfile=${esc(fontPath)}` : '';

  const order = { VIDEO: 0, IMAGE: 1, TEXT: 2 };
  const vis = clips.filter((c) => c.track in order).sort((a, b) => order[a.track] - order[b.track] || a.start - b.start);
  let last = '[0:v]', n = 0;

  for (const c of clips) {
    if (c.track === 'EFFECTS' && !EFFECTS[c.props.effect === 'grain' ? 'noise' : c.props.effect]) warn.add(`The effect "${c.props.effect}" is not included in the export yet.`);
    if (c.track === 'OVERLAY') warn.add('Stickers are not included in the export yet.');
    if (Object.values(c.keyframes || {}).some((a) => a.length)) warn.add('Keyframe animation is not included in the export yet.');
    if (c.props.anim && c.props.anim !== 'none') warn.add('Entrance animations are not included in the export yet.');
    if (c.props.trans && !['none', 'fade', 'crossfade'].includes(c.props.trans)) warn.add('Only Fade and Cross Fade transitions are exported.');
  }

  for (const c of vis) {
    const p = c.props, s = c.start, e = s + c.duration;
    n++;
    if (c.track === 'TEXT') {
      const px = (num(p.fontSize, 6, 1, 40) / 100) * W, op = f(num(p.opacity, 1, 0, 1));
      const fx = 0.5 + num(p.x, 0, -100, 100) / 200, fy = 0.5 + num(p.y, 0, -100, 100) / 200;
      let d = `drawtext=textfile=${esc(await textFile(String(p.text ?? '').slice(0, 500)))}${font}:fontsize=${f(px)}:fontcolor=${col(p.color, '0xffffff')}@${op}:x=${f(W * fx)}-text_w/2:y=${f(H * fy)}-text_h/2:enable='between(t,${f(s)},${f(e)})'`;
      if (p.shadow) d += ':shadowcolor=black@0.7:shadowx=2:shadowy=2';
      if (p.bg) d += `:box=1:boxcolor=${col(p.bg, '0x000000')}@1:boxborderw=${f(px * 0.15)}`;
      if (num(p.stroke, 0) > 0) d += `:borderw=${f((num(p.stroke, 0, 0, 8) * W) / 1000)}:bordercolor=${col(p.strokeColor, '0x000000')}`;
      g.push(`${last}${d}[t${n}]`); last = `[t${n}]`;
      continue;
    }
    const fp = file(c);
    if (!fp) { warn.add('A clip was skipped because its media file was not found.'); continue; }
    const isImg = c.track === 'IMAGE', speed = isImg ? 1 : c.speed;
    inputs.push(isImg ? ['-loop', '1', '-framerate', String(fps), '-t', f(c.duration + 1), '-i', fp] : ['-i', fp]);
    const k = inputs.length;
    if (!isImg && (await hasAudio(fp))) audio.push({ k, c });
    const sc = num(p.scale, 1, 0.1, 3), [cT, cR, cB, cL] = ['cropT', 'cropR', 'cropB', 'cropL'].map((q) => num(p[q], 0, 0, 45) / 100);
    const ch = [`trim=start=${f(c.trimIn)}:duration=${f(c.duration * speed)}`, `setpts=(PTS-STARTPTS)/${f(speed)}`, `fps=${fps}`,
      `crop=iw*${f(1 - cL - cR)}:ih*${f(1 - cT - cB)}:iw*${f(cL)}:ih*${f(cT)}`,
      `scale=${even(W * sc)}:${even(H * sc)}:force_original_aspect_ratio=decrease`];
    if (p.flipH) ch.push('hflip');
    if (p.flipV) ch.push('vflip');
    if (FILTERS[p.filter]) ch.push(FILTERS[p.filter](num(p.filterAmt, 1, 0, 1)));
    if (num(p.br, 1) !== 1 || num(p.ct, 1) !== 1 || num(p.sa, 1) !== 1) ch.push(`eq=brightness=${f((num(p.br, 1, 0.5, 1.5) - 1) * 0.5)}:contrast=${f(num(p.ct, 1, 0.5, 1.5))}:saturation=${f(num(p.sa, 1, 0, 2))}`);
    ch.push('format=rgba');
    const rot = (num(p.rotation, 0, -180, 180) * Math.PI) / 180;
    if (rot) ch.push(`rotate=${f(rot)}:c=none:ow=rotw(${f(rot)}):oh=roth(${f(rot)})`);
    if (num(p.opacity, 1) < 1) ch.push(`colorchannelmixer=aa=${f(num(p.opacity, 1, 0, 1))}`);
    if (['fade', 'crossfade'].includes(p.trans)) ch.push(`fade=t=in:st=0:d=${f(num(p.transDur, 0.6, 0.2, 2))}:alpha=1`);
    ch.push(`setpts=PTS+${f(s)}/TB`);
    g.push(`[${k}:v]${ch.join(',')}[v${n}]`);
    g.push(`${last}[v${n}]overlay=x=(W-w)/2+${f((W * num(p.x, 0, -100, 100)) / 100)}:y=(H-h)/2+${f((H * num(p.y, 0, -100, 100)) / 100)}:eof_action=pass:enable='between(t,${f(s)},${f(e)})'[o${n}]`);
    last = `[o${n}]`;
  }
  let en = 0;
  for (const c of clips.filter((x) => x.track === 'EFFECTS')) {
    const fx = EFFECTS[c.props.effect === 'grain' ? 'noise' : c.props.effect]; if (!fx) continue;
    en++;
    g.push(fx({ i: num(c.props.intensity, 0.6, 0, 1), s: c.start, e: c.start + c.duration, w: `enable='between(t,${f(c.start)},${f(c.start + c.duration)})'`, in: last, out: `fx${en}`, id: `fx${en}`, W, H }));
    last = `[fx${en}]`;
  }
  if (free) {
    const wm = await textFile('Rajesh Video Studio');
    g.push(`${last}drawtext=textfile=${esc(wm)}${font}:fontsize=${f(H / 30)}:fontcolor=white@0.6:x=w-text_w-20:y=h-text_h-20[wm]`); last = '[wm]';
  }
  g.push(`${last}format=yuv420p[vout]`);

  for (const c of clips.filter((x) => x.track === 'AUDIO')) {
    const fp = file(c);
    if (!fp) { warn.add('An audio clip was skipped because its media file was not found.'); continue; }
    inputs.push(['-i', fp]); audio.push({ k: inputs.length, c });
  }
  audio.forEach(({ k, c }, i) => {
    const p = c.props, ms = Math.round(c.start * 1000), fi = num(p.fadeIn, 0, 0, 30), fo = num(p.fadeOut, 0, 0, 30);
    const ch = [`atrim=start=${f(c.trimIn)}:duration=${f(c.duration * c.speed)}`, 'asetpts=PTS-STARTPTS', tempo(c.speed),
      `volume=${p.muted ? 0 : f(num(p.volume, 1, 0, 1))}`, 'aformat=sample_rates=44100:channel_layouts=stereo'];
    if (fi) ch.push(`afade=t=in:st=0:d=${f(fi)}`);
    if (fo) ch.push(`afade=t=out:st=${f(Math.max(0, c.duration - fo))}:d=${f(fo)}`);
    ch.push(`adelay=${ms}|${ms}`);
    g.push(`[${k}:a]${ch.join(',')}[a${i}]`);
  });
  if (audio.length) g.push(`${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0:duration=longest[aout]`);
  return { inputs, graph: g.join(';'), hasAudio: audio.length > 0, tmp, warnings: [...warn] };
}


export async function buildArgs({ clips, media, resolveFile, settings, free, out }) {
  const [W, H] = canvasSize(Number(settings.resolution), settings.ratio), fps = settings.fps;
  const D = Math.max(0.1, ...clips.map((c) => c.start + c.duration));
  const b = await build({ clips, media, W, H, fps, D, free, resolveFile });
  const codec = settings.format === 'mp4'
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart']
    : ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1', '-deadline', 'realtime', '-cpu-used', '5', '-pix_fmt', 'yuv420p', '-c:a', 'libopus'];
  const args = ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${fps}:d=${D}`, ...b.inputs.flat(), '-filter_complex', b.graph,
    '-map', '[vout]', ...(b.hasAudio ? ['-map', '[aout]'] : ['-an']), '-t', String(D), '-r', String(fps), ...codec, '-progress', 'pipe:1', '-nostats', out];
  return { args, tmp: b.tmp, warnings: b.warnings, D, W, H };
}

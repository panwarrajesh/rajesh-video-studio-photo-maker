// Runs the real FFmpeg export pipeline on generated media. Skipped automatically when ffmpeg is not installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgs, EFFECTS } from '../src/modules/exports/ffmpeg.build.js';

const has = spawnSync('ffmpeg', ['-version']).status === 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-exp-'));
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
if (fs.existsSync(font)) process.env.FFMPEG_FONT = font;
const run = (...a) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', f], { encoding: 'utf8' }).stdout);

const P = (o = {}) => ({ scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, filter: 'original', filterAmt: 1, trans: 'none', transDur: 0.6, cropT: 0, cropR: 0, cropB: 0, cropL: 0, flipH: false, flipV: false, br: 1, ct: 1, sa: 1, ...o });
const C = (id, track, mediaId, start, duration, o = {}) => ({ id, track, mediaId, start, duration, trimIn: 0, speed: 1, srcLen: 99, props: P(o.props), keyframes: {}, ...o, ...(o.props ? { props: P(o.props) } : {}) });
const media = [{ id: 'v1', url: path.join(dir, 'v1.mp4') }, { id: 'v2', url: path.join(dir, 'v2.mp4') }, { id: 'im', url: path.join(dir, 'im.png') }, { id: 'au', url: path.join(dir, 'au.wav') }];
const resolveFile = (m) => m.url;

test('prepare sample media', { skip: !has }, () => {
  assert.equal(run('-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=25:d=4', '-f', 'lavfi', '-i', 'sine=f=440:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', media[0].url).status, 0);
  assert.equal(run('-f', 'lavfi', '-i', 'smptebars=s=480x640:r=25:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', media[1].url).status, 0);
  assert.equal(run('-f', 'lavfi', '-i', 'color=c=red:s=800x600', '-frames:v', '1', media[2].url).status, 0);
  assert.equal(run('-f', 'lavfi', '-i', 'sine=f=220:d=8', media[3].url).status, 0);
});

// ffmpeg is run exactly with the args the server builds (minus the progress pipe)
function exec(b, out) { const args = b.args.slice(0, b.args.indexOf('-progress')).concat([out]); return spawnSync('ffmpeg', ['-loglevel', 'error', ...args], { encoding: 'utf8' }); }

test('full timeline: video split + speed, image overlay, text, audio, filters, adjust, fade transition', { skip: !has }, async () => {
  const clips = [
    C('a', 'VIDEO', 'v1', 0, 3, { props: { filter: 'vintage', br: 1.1, sa: 1.2 } }),
    C('b', 'VIDEO', 'v1', 3, 1.5, { trimIn: 1, speed: 2, props: { trans: 'fade' } }),
    C('c', 'VIDEO', 'v2', 4.5, 2, { props: { trans: 'fade', flipH: true, cropT: 5 } }),
    C('d', 'IMAGE', 'im', 1, 2, { props: { scale: 0.4, x: 20, y: -20, rotation: 15, opacity: 0.8 } }),
    { ...C('t', 'TEXT', null, 0.5, 2), kind: 'text', props: P({ text: 'Hello World', fontSize: 6, color: '#ffffff', bg: '#000000', shadow: true, stroke: 1, strokeColor: '#ff0000' }) },
    C('m', 'AUDIO', 'au', 0, 6, { props: { volume: 0.7, fadeIn: 1, fadeOut: 1 } }),
  ];
  const out = path.join(dir, 'full.mp4'), b = await buildArgs({ clips, media, resolveFile, settings: { resolution: '480', ratio: '9:16', fps: 30, format: 'mp4' }, free: true, out });
  const r = exec(b, out); assert.equal(r.status, 0, r.stderr);
  const p = probe(out), types = p.streams.map((s) => s.codec_type);
  assert.ok(types.includes('video') && types.includes('audio'), 'has video + audio');
  assert.ok(Math.abs(Number(p.format.duration) - 6.5) < 0.4, `duration ${p.format.duration}`);
  assert.equal(p.streams.find((s) => s.codec_type === 'video').width, 480);
  assert.equal(p.streams.find((s) => s.codec_type === 'video').height, 854);
});

for (const name of Object.keys(EFFECTS)) {
  test(`effect "${name}" renders`, { skip: !has }, async () => {
    const clips = [C('a', 'VIDEO', 'v1', 0, 3), { ...C('e', 'EFFECTS', null, 0.5, 1.5), kind: 'effect', props: P({ effect: name, intensity: 0.7 }) }];
    const out = path.join(dir, `fx-${name}.mp4`), b = await buildArgs({ clips, media, resolveFile, settings: { resolution: '480', ratio: '16:9', fps: 30, format: 'mp4' }, free: false, out });
    assert.deepEqual(b.warnings, []);
    const r = exec(b, out); assert.equal(r.status, 0, `${name}: ${r.stderr.slice(-300)}`);
  });
}

test('webm export works', { skip: !has }, async () => {
  const out = path.join(dir, 'w.webm'), b = await buildArgs({ clips: [C('a', 'VIDEO', 'v1', 0, 2)], media, resolveFile, settings: { resolution: '480', ratio: '1:1', fps: 24, format: 'webm' }, free: false, out });
  const r = exec(b, out); assert.equal(r.status, 0, r.stderr.slice(-300));
});
test('unsupported things produce warnings instead of failing', { skip: !has }, async () => {
  const clips = [C('a', 'VIDEO', 'v1', 0, 2), { ...C('s', 'OVERLAY', null, 0, 1), kind: 'sticker', props: P({ shape: 'star' }) }, { ...C('e', 'EFFECTS', null, 0, 1), kind: 'effect', props: P({ effect: 'speedlines' }) }];
  const out = path.join(dir, 'warn.mp4'), b = await buildArgs({ clips, media, resolveFile, settings: { resolution: '480', ratio: '16:9', fps: 30, format: 'mp4' }, free: false, out });
  assert.ok(b.warnings.length >= 2); assert.equal(exec(b, out).status, 0);
});

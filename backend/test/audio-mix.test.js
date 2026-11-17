// Real FFmpeg: exports small timelines and MEASURES the resulting audio (per frequency band) to prove each audio feature does what it says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgs } from '../src/modules/exports/ffmpeg.build.js';
import { runFfmpeg, validateOutput } from '../src/modules/exports/ffmpeg.runner.js';

const has = spawnSync('ffmpeg', ['-version']).status === 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-audio-'));
const ff = (...a) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const M = (id, file) => ({ id, url: path.join(dir, file) }), media = [M('music', 'm220.wav'), M('voice', 'v1000.wav'), M('vid', 'vid.mp4'), M('short', 's220.wav'), M('low', 'l60.wav')];
const resolveFile = (m) => m.url;
const P = (o = {}) => ({ scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, filter: 'original', filterAmt: 1, trans: 'none', transDur: 0.6, cropT: 0, cropR: 0, cropB: 0, cropL: 0, flipH: false, flipV: false, br: 1, ct: 1, sa: 1, ...o });
const C = (id, track, mediaId, start, duration, o = {}) => ({ id, track, mediaId, start, duration, trimIn: 0, speed: 1, srcLen: duration, keyframes: {}, ...o, props: P(o.props) });
const screen = (d) => C('scr', 'VIDEO', null, 0, d);                                   // a silent picture-only clip just to give the timeline a length
const SET = { resolution: '480', ratio: '16:9', fps: 25, format: 'mp4' };
async function render(name, clips, expectAudio = true) {
  const out = path.join(dir, `${name}.mp4`), b = await buildArgs({ clips, media, resolveFile, settings: SET, free: false, out });
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', ...b.args.slice(0, b.args.indexOf('-progress')), out], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr.slice(-400));
  await validateOutput(out, { duration: b.D, expectAudio }); return out;
}
// mean level (dB) of one frequency band during [ss, ss+t]
const level = (f, ss, t, hz) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(ss), '-t', String(t), '-i', f, '-af', `bandpass=f=${hz}:width_type=h:w=60,volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }); const m = /mean_volume: (-?[\d.]+|-inf)/.exec(r.stderr); return m ? (m[1] === '-inf' ? -120 : Number(m[1])) : -120; };
const music = (id, o = {}) => ({ ...C(id, 'AUDIO', 'music', 0, 8, { kind: 'music', ...o, props: o.props }) });

test('prepare sources', { skip: !has }, () => {
  for (const [f, hz, s] of [['m220.wav', 220, 8], ['v1000.wav', 1000, 4], ['s220.wav', 220, 2], ['l60.wav', 60, 4]]) assert.equal(ff('-f', 'lavfi', '-i', `sine=f=${hz}:d=${s}`, path.join(dir, f)).status, 0);
  assert.equal(ff('-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=8', '-f', 'lavfi', '-i', 'sine=f=330:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'vid.mp4')).status, 0);
});
test('volume slider: 200% is about +6 dB louder than 100%, 0% is silent', { skip: !has }, async () => {
  const a = level(await render('v1', [screen(8), music('m', { props: { volume: 1 } })]), 1, 3, 220), b = level(await render('v2', [screen(8), music('m', { props: { volume: 2 } })]), 1, 3, 220), z = level(await render('v0', [screen(8), music('m', { props: { volume: 0 } })], true), 1, 3, 220);
  assert.ok(Math.abs(b - a - 6) < 1.5, `delta ${b - a}`); assert.ok(z < -60, `muted level ${z}`);
});
test('fade in and fade out shape the start and end', { skip: !has }, async () => {
  const o = await render('fade', [screen(6), music('m', { duration: 6, props: { fadeIn: 1.5, fadeOut: 1.5 } })]), mid = level(o, 2, 1.5, 220);
  assert.ok(level(o, 0, 0.4, 220) < mid - 10, 'fade-in'); assert.ok(level(o, 5.5, 0.4, 220) < mid - 10, 'fade-out');
});
test('loop: a 2 s music file fills a 6 s clip; without loop it stops after 2 s', { skip: !has }, async () => {
  const mk = (loop) => [screen(6), { ...C('m', 'AUDIO', 'short', 0, 6, { kind: 'music', props: { loop } }), srcLen: 2 }];
  assert.ok(level(await render('loop1', mk(true)), 4.2, 1.5, 220) > -40, 'looped audio present at 4-6 s'); assert.ok(level(await render('loop0', mk(false)), 4.2, 1.5, 220) < -60, 'no loop = silence');
});
test('ducking: music drops under the voice-over (and only then); can be switched off', { skip: !has }, async () => {
  const voice = C('v', 'AUDIO', 'voice', 3, 2, { kind: 'voice' }), run = async (n, duck) => { const o = await render(n, [screen(8), music('m', { props: { duck } }), voice]); return { out: o, drop: level(o, 0.5, 2, 220) - level(o, 3.3, 1.4, 220) }; };
  const on = await run('duck1', true), off = await run('duck0', false);
  assert.ok(on.drop > 8, `ducked by ${on.drop.toFixed(1)} dB`); assert.ok(Math.abs(off.drop) < 1.5, `not ducked: ${off.drop.toFixed(1)} dB`); assert.ok(level(on.out, 3.3, 1.4, 1000) > -35, 'the voice itself stays audible');
  assert.ok(level(on.out, 6, 1.5, 220) > level(on.out, 3.3, 1.4, 220) + 8, 'music comes back after the voice');
});
test('original video sound is kept and mixed with the music; muting the clip silences only the video sound', { skip: !has }, async () => {
  const vid = (muted) => C('vid', 'VIDEO', 'vid', 0, 8, { srcLen: 8, props: { muted } }), o = await render('orig1', [vid(false), music('m')]);
  assert.ok(level(o, 1, 3, 330) > -40, 'video sound present'); assert.ok(level(o, 1, 3, 220) > -40, 'music present');
  const q = await render('orig2', [vid(true), music('m')]); assert.ok(level(q, 1, 3, 220) > -40, 'music still plays');
  const only = await render('orig3', [screen(8), music('m')]); // band-pass filters leak a little, so compare with an export that has no video sound at all
  assert.ok(Math.abs(level(q, 1, 3, 330) - level(only, 1, 3, 330)) < 2, 'muted video adds nothing'); assert.ok(level(o, 1, 3, 330) - level(q, 1, 3, 330) > 10, 'and the un-muted one is clearly louder');
});
test('bass boost raises low frequencies', { skip: !has }, async () => {
  const mk = (bass) => [screen(4), C('m', 'AUDIO', 'low', 0, 4, { kind: 'music', props: { bass } })];
  const flat = level(await render('b0', mk(0)), 1, 2, 60), boosted = level(await render('b12', mk(12)), 1, 2, 60); assert.ok(boosted - flat > 6, `+${(boosted - flat).toFixed(1)} dB`);
});
test('speed 2x plays the music twice as fast (half the length)', { skip: !has }, async () => {
  const o = await render('sp', [screen(6), { ...C('m', 'AUDIO', 'music', 0, 4, { kind: 'music', speed: 2 }), srcLen: 8 }]);
  assert.ok(level(o, 1, 2, 220) > -40); assert.ok(level(o, 4.4, 1.2, 220) < -60, 'ends at 4 s');
});
test('start position: audio placed at 2 s is silent before and audible after (in sync)', { skip: !has }, async () => {
  const o = await render('pos', [screen(6), C('m', 'AUDIO', 'music', 2, 2, { kind: 'music', srcLen: 8 })]);
  assert.ok(level(o, 0.1, 1.6, 220) < -60); assert.ok(level(o, 2.3, 1.4, 220) > -40); assert.ok(level(o, 4.3, 1.4, 220) < -60);
});
test('equalizer + echo run and keep the sound audible', { skip: !has }, async () => {
  const o = await render('eqecho', [screen(6), music('m', { duration: 6, props: { bass: 4, mid: -3, treble: 5, echo: 0.8 } })]); assert.ok(level(o, 1, 3, 220) > -45);
});
test('the exported audio is AAC inside an MP4', { skip: !has }, async () => {
  const o = await render('aac', [screen(3), music('m', { duration: 3 })]); const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', o], { encoding: 'utf8' }); assert.equal(r.stdout.trim(), 'aac');
});
test('validation: a good file passes; damaged, silent-when-sound-expected and wrong-length files are rejected', { skip: !has }, async () => {
  const good = await render('valid', [screen(4), music('m', { duration: 4 })]); assert.ok((await validateOutput(good, { duration: 4, expectAudio: true })).audio);
  const bad = path.join(dir, 'broken.mp4'); fs.writeFileSync(bad, Buffer.alloc(5000, 7)); await assert.rejects(validateOutput(bad, { duration: 4, expectAudio: false }), /damaged|cannot be read/);
  await assert.rejects(validateOutput(path.join(dir, 'nope.mp4'), { duration: 4 }), /no valid file/);
  const noAudio = await render('silentfile', [screen(4)], false); await assert.rejects(validateOutput(noAudio, { duration: 4, expectAudio: true }), /no audio/);
  await assert.rejects(validateOutput(good, { duration: 30, expectAudio: true }), /wrong length/);
});
test('cancel: a running FFmpeg stops at once and reports "Cancelled by user"', { skip: !has }, async () => {
  const ctl = new AbortController(), t0 = Date.now(); setTimeout(() => ctl.abort(), 600);
  await assert.rejects(runFfmpeg({ args: ['-re', '-f', 'lavfi', '-i', 'testsrc=d=600', '-f', 'null', '-'], duration: 600, signal: ctl.signal }), (e) => e.cancelled && /Cancelled/.test(e.message));
  assert.ok(Date.now() - t0 < 5000);
});
test('a damaged input gives a human message, not raw FFmpeg text', { skip: !has }, async () => {
  const f = path.join(dir, 'junk.wav'); fs.writeFileSync(f, Buffer.alloc(4000, 1));
  await assert.rejects(runFfmpeg({ args: ['-y', '-i', f, path.join(dir, 'x.mp3')], duration: 1 }), /damaged|FFmpeg failed/);
});

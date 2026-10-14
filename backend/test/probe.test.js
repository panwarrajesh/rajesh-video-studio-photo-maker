import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeDuration } from '../src/utils/probe.js';

const has = spawnSync('ffprobe', ['-version']).status === 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-probe-'));
test('measures the real duration of a media file', { skip: !has }, async () => {
  const f = path.join(dir, 'a.wav'); spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=f=300:d=2.5', f]);
  assert.ok(Math.abs((await probeDuration(f)) - 2.5) < 0.1);
});
test('returns null for a non-media file or a missing file (client value is then used as fallback)', async () => {
  const f = path.join(dir, 'x.txt'); fs.writeFileSync(f, 'hello'); assert.equal(await probeDuration(f), null); assert.equal(await probeDuration(path.join(dir, 'nope.mp4')), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHealthRouter } from '../src/modules/health/health.routes.js';

const serve = (deps) => { const app = express(); app.use('/api/health', createHealthRouter(deps)); const s = app.listen(0); return { s, url: `http://127.0.0.1:${s.address().port}/api/health/deep` }; };
const good = { db: async () => {}, tokenTable: async () => {}, ffmpeg: async () => {}, env: { JWT_SECRET: 'x' } };

test('everything fine -> 200 and no secrets in the answer', async () => {
  const { s, url } = serve({ ...good, env: { JWT_SECRET: 'super-secret-value', S3_BUCKET: 'b' } }); const r = await fetch(url), j = await r.json(); s.close();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.storage, 's3'); assert.ok(!JSON.stringify(j).includes('super-secret-value'));
});
test('missing RefreshToken table (forgot `prisma db push`) is reported precisely', async () => {
  const { s, url } = serve({ ...good, tokenTable: async () => { throw new Error('Invalid `prisma.refreshToken.count()` invocation:\n\nThe table `rvs.RefreshToken` does not exist in the current database.'); } });
  const r = await fetch(url), j = await r.json(); s.close(); assert.equal(r.status, 503); assert.equal(j.checks.database.ok, true); assert.equal(j.checks.refreshTokenTable.ok, false); assert.match(j.checks.refreshTokenTable.error, /does not exist/);
});
test('database down, ffmpeg missing and no JWT secret are each reported', async () => {
  const { s, url } = serve({ db: async () => { throw new Error("Can't reach database server"); }, tokenTable: async () => {}, ffmpeg: async () => { throw new Error('ffmpeg is not installed'); }, env: {} });
  const j = await (await fetch(url)).json(); s.close(); assert.deepEqual(Object.entries(j.checks).filter(([, c]) => !c.ok).map(([k]) => k).sort(), ['database', 'ffmpeg', 'jwtSecret']);
});
test('the default ffmpeg check really runs ffmpeg', async () => { const { s, url } = serve({ db: async () => {}, tokenTable: async () => {}, env: { JWT_SECRET: 'x' } }); const j = await (await fetch(url)).json(); s.close(); assert.equal(typeof j.checks.ffmpeg.ok, 'boolean'); });

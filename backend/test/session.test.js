import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService, GRACE_MS } from '../src/modules/auth/session.service.js';

function fakeStore() {
  const rows = []; let id = 0;
  return { rows,
    create: async (d) => { const r = { id: String(++id), revokedAt: null, ...d }; rows.push(r); return r; },
    find: async (h) => rows.find((r) => r.tokenHash === h) || null,
    revoke: async (i, at, why) => { const r = rows.find((x) => x.id === i); r.revokedAt = at; r.revokeReason = why; },
    revokeAll: async (u, at, why) => rows.filter((r) => r.userId === u && !r.revokedAt).forEach((r) => { r.revokedAt = at; r.revokeReason = why; }) };
}
const setup = () => { let t = 1_000_000; const store = fakeStore(), s = createSessionService(store, { now: () => t, ttl: 10_000_000 }); return { store, s, tick: (ms) => { t += ms; } }; };

test('issue stores only a hash, never the token', async () => {
  const { s, store } = setup(); const tok = await s.issue('u1', 'UA');
  assert.ok(tok.length >= 60); assert.ok(!JSON.stringify(store.rows).includes(tok));
});
test('rotate gives a new token and revokes the old one', async () => {
  const { s, store } = setup(); const t1 = await s.issue('u1'); const r = await s.rotate(t1);
  assert.equal(r.ok, true); assert.equal(r.userId, 'u1'); assert.notEqual(r.token, t1); assert.ok(store.rows[0].revokedAt);
  assert.equal((await s.rotate(r.token)).ok, true); // the new token works
});
test('unknown, empty or expired tokens are rejected', async () => {
  const { s, tick } = setup(); assert.equal((await s.rotate('nope')).ok, false); assert.equal((await s.rotate('')).ok, false); assert.equal((await s.rotate(undefined)).ok, false);
  const t = await s.issue('u1'); tick(10_000_001); assert.equal((await s.rotate(t)).ok, false);
});
test('parallel refresh inside the grace window is allowed (no accidental logout)', async () => {
  const { s, tick } = setup(); const t1 = await s.issue('u1'); await s.rotate(t1); tick(GRACE_MS - 1000);
  assert.equal((await s.rotate(t1)).ok, true);
});
test('an old token reused after the grace window kills every session of that user (theft protection)', async () => {
  const { s, store, tick } = setup(); const t1 = await s.issue('u1'); const r = await s.rotate(t1); await s.issue('u1'); tick(GRACE_MS + 1000);
  assert.equal((await s.rotate(t1)).ok, false); assert.ok(store.rows.every((x) => x.revokedAt)); assert.equal((await s.rotate(r.token)).ok, false);
});
test('logout revokes the token', async () => {
  const { s, tick } = setup(); const t = await s.issue('u1'); await s.revoke(t); tick(GRACE_MS + 1000); assert.equal((await s.rotate(t)).ok, false);
});
test('another user is not affected by a theft alarm', async () => {
  const { s, store, tick } = setup(); const a = await s.issue('A'); const b = await s.issue('B'); await s.rotate(a); tick(GRACE_MS + 1000); await s.rotate(a);
  assert.equal(store.rows.find((r) => r.userId === 'B').revokedAt, null); assert.equal((await s.rotate(b)).ok, true);
});

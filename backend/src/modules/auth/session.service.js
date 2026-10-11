// Refresh-token sessions: opaque random tokens, only a SHA-256 hash is stored, rotated on every use, revocable.
import crypto from 'crypto';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const REFRESH_TTL_MS = 60 * 24 * 3600 * 1000; // 60 days, renewed on every refresh
export const GRACE_MS = 20_000;                      // a parallel request may present the token that was just rotated

export function createSessionService(store, { now = () => Date.now(), ttl = REFRESH_TTL_MS } = {}) {
  async function issue(userId, userAgent = '') {
    const token = crypto.randomBytes(48).toString('base64url');
    await store.create({ userId, tokenHash: sha(token), expiresAt: new Date(now() + ttl), userAgent: String(userAgent).slice(0, 200) });
    return token;
  }
  async function rotate(token, userAgent) {
    if (!token || typeof token !== 'string') return { ok: false };
    const row = await store.find(sha(token));
    if (!row || row.expiresAt.getTime() <= now()) return { ok: false };
    if (row.revokedAt) {
      if (row.revokeReason === 'rotated' && now() - row.revokedAt.getTime() <= GRACE_MS) return { ok: true, userId: row.userId, token: await issue(row.userId, userAgent) };
      await store.revokeAll(row.userId, new Date(now()), 'theft'); // an old token came back later: assume it was stolen, end every session
      return { ok: false };
    }
    await store.revoke(row.id, new Date(now()), 'rotated');
    return { ok: true, userId: row.userId, token: await issue(row.userId, userAgent) };
  }
  async function revoke(token) {
    if (!token || typeof token !== 'string') return;
    const row = await store.find(sha(token));
    if (row && !row.revokedAt) await store.revoke(row.id, new Date(now()), 'logout');
  }
  return { issue, rotate, revoke };
}

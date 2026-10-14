import { describe, test, expect, beforeEach, vi } from 'vitest';
const res = (status, body = {}) => ({ ok: status < 300, status, json: async () => body });
async function load(cookie) { vi.resetModules(); vi.stubEnv('VITE_COOKIE_AUTH', cookie ? 'true' : 'false'); return import('./services/api.js'); }
beforeEach(() => { localStorage.clear(); });

describe('token mode (default)', () => {
  test('401 -> one refresh with the stored refresh token -> retry, and the rotated token is saved', async () => {
    const m = await load(false); localStorage.setItem('rvs_access', 'A1'); localStorage.setItem('rvs_refresh', 'R1');
    const calls = []; globalThis.fetch = vi.fn(async (u, o) => { calls.push([u, o]); if (u.endsWith('/auth/refresh')) return res(200, { accessToken: 'A2', refreshToken: 'R2' }); return o.headers.Authorization === 'Bearer A1' ? res(401) : res(200, { ok: 1 }); });
    expect(await m.api('/projects')).toEqual({ ok: 1 }); expect(localStorage.getItem('rvs_refresh')).toBe('R2'); expect(JSON.parse(calls.find((c) => c[0].endsWith('/auth/refresh'))[1].body)).toEqual({ refreshToken: 'R1' });
  });
  test('parallel 401s trigger exactly one refresh', async () => {
    const m = await load(false); localStorage.setItem('rvs_access', 'A1'); localStorage.setItem('rvs_refresh', 'R1'); let n = 0;
    globalThis.fetch = vi.fn(async (u, o) => { if (u.endsWith('/auth/refresh')) { n++; return res(200, { accessToken: 'A2', refreshToken: 'R2' }); } return o.headers.Authorization === 'Bearer A1' ? res(401) : res(200, {}); });
    await Promise.all([m.api('/a'), m.api('/b'), m.api('/c')]); expect(n).toBe(1);
  });
  test('a rejected refresh token ends the session; a server error does not', async () => {
    let m = await load(false); localStorage.setItem('rvs_access', 'A1'); localStorage.setItem('rvs_refresh', 'R1');
    globalThis.fetch = vi.fn(async (u) => (u.endsWith('/auth/refresh') ? res(401, { error: 'Session expired' }) : res(401, { error: 'Unauthorized' })));
    await expect(m.api('/projects')).rejects.toThrow(); expect(localStorage.getItem('rvs_refresh')).toBeNull();
    m = await load(false); localStorage.setItem('rvs_access', 'A1'); localStorage.setItem('rvs_refresh', 'R1');
    globalThis.fetch = vi.fn(async (u) => (u.endsWith('/auth/refresh') ? res(503) : res(401))); await expect(m.api('/projects')).rejects.toThrow(); expect(localStorage.getItem('rvs_refresh')).toBe('R1');
  });
});
describe('cookie mode (VITE_COOKIE_AUTH=true)', () => {
  test('never writes tokens to localStorage, sends credentials, refreshes through the cookie', async () => {
    const m = await load(true); const calls = [];
    globalThis.fetch = vi.fn(async (u, o) => { calls.push([u, o]); if (u.endsWith('/auth/login')) return res(200, { accessToken: 'A1', user: { id: 'u' } }); if (u.endsWith('/auth/refresh')) return res(200, { accessToken: 'A2' }); return o.headers.Authorization === 'Bearer A1' ? res(401) : res(200, { ok: 1 }); });
    const d = await m.api('/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } }); m.setTokens(d);
    expect(await m.api('/projects')).toEqual({ ok: 1 });
    expect(localStorage.getItem('rvs_access')).toBeNull(); expect(localStorage.getItem('rvs_refresh')).toBeNull(); expect(calls.every(([, o]) => o.credentials === 'include')).toBe(true);
    expect(JSON.parse(calls.find((c) => c[0].endsWith('/auth/refresh'))[1].body)).toEqual({});
  });
  test('a reload starts a session from the cookie alone', async () => { const m = await load(true); expect(m.hasSession()).toBe(true); });
});

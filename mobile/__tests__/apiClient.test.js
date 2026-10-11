import { createApiClient, jwtExp } from '../../shared/apiClient.js';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (expSec) => `${b64({ alg: 'HS256' })}.${b64({ id: 'u1', exp: expSec })}.sig`;
let NOW = 1_700_000_000_000;
const mem = (init = {}) => { const m = { ...init }; return { m, get: async (k) => m[k] ?? null, set: async (k, v) => { m[k] = v; }, del: async (k) => { delete m[k]; } }; };
const res = (status, body = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const user = { id: 'u1', name: 'Raj', email: 'r@x.com', plan: 'FREE' };
const mk = (storage, handler) => { const calls = []; const f = async (u, o) => { calls.push(`${o.method} ${u.replace('https://api.test/api', '')}`); return handler(u.replace('https://api.test/api', ''), o); }; return { calls, api: createApiClient({ baseUrl: 'https://api.test/api', storage, fetchImpl: f, now: () => NOW }) }; };
const fresh = () => jwt(NOW / 1000 + 900), old = () => jwt(NOW / 1000 - 10);

test('jwtExp reads exp and survives garbage', () => { expect(jwtExp(jwt(123))).toBe(123); expect(jwtExp('garbage')).toBe(0); });
test('login saves access, refresh and user', async () => {
  const st = mem(); const { api } = mk(st, () => res(200, { user, accessToken: fresh(), refreshToken: 'R1' }));
  expect((await api.login('r@x.com', 'pw')).name).toBe('Raj'); expect(st.m.rvs_refresh).toBe('R1'); expect(JSON.parse(st.m.rvs_user).id).toBe('u1');
});
test('restart with a valid session: logged in, no login screen', async () => {
  const st = mem({ rvs_access: fresh(), rvs_refresh: 'R1' }); const { api, calls } = mk(st, (p) => (p === '/auth/me' ? res(200, { user }) : res(500)));
  expect(await api.restore()).toEqual({ status: 'authed', user }); expect(calls).toEqual(['GET /auth/me']);
});
test('expired access token is refreshed automatically and the new refresh token is kept', async () => {
  const st = mem({ rvs_access: old(), rvs_refresh: 'R1' }); const { api } = mk(st, (p) => (p === '/auth/refresh' ? res(200, { user, accessToken: fresh(), refreshToken: 'R2' }) : res(200, { user })));
  expect((await api.restore()).status).toBe('authed'); expect(st.m.rvs_refresh).toBe('R2');
});
test('refresh token rejected (expired/revoked): session cleared, onSessionLost fired, back to login', async () => {
  const st = mem({ rvs_access: old(), rvs_refresh: 'R1', rvs_user: '{}' }); const lost = jest.fn(); const { api } = mk(st, () => res(401, { error: 'Session expired' })); api.onSessionLost(lost);
  expect((await api.restore()).status).toBe('anon'); expect(st.m).toEqual({}); expect(lost).toHaveBeenCalled();
});
test('NO internet at app start: stays logged in (cached user), tokens are NOT deleted', async () => {
  const st = mem({ rvs_access: old(), rvs_refresh: 'R1', rvs_user: JSON.stringify(user) }); const { api } = mk(st, () => { throw new Error('offline'); });
  expect(await api.restore()).toEqual({ status: 'authed', user, offline: true }); expect(st.m.rvs_refresh).toBe('R1');
});
test('server error (500) during refresh does not log the user out', async () => {
  const st = mem({ rvs_access: old(), rvs_refresh: 'R1', rvs_user: JSON.stringify(user) }); const { api } = mk(st, () => res(503));
  expect((await api.restore()).status).toBe('authed'); expect(st.m.rvs_refresh).toBe('R1');
});
test('a 401 on a request triggers one refresh and a retry that succeeds', async () => {
  const st = mem({ rvs_access: fresh(), rvs_refresh: 'R1' }); let first = true;
  const { api, calls } = mk(st, (p) => { if (p === '/auth/refresh') return res(200, { accessToken: fresh(), refreshToken: 'R2' }); if (first) { first = false; return res(401); } return res(200, [{ id: 'p1' }]); });
  expect(await api.request('/projects')).toEqual([{ id: 'p1' }]); expect(calls.filter((c) => c.includes('refresh')).length).toBe(1);
});
test('5 parallel requests with an expired token cause exactly ONE refresh (single-flight)', async () => {
  const st = mem({ rvs_access: old(), rvs_refresh: 'R1' }); const { api, calls } = mk(st, async (p) => (p === '/auth/refresh' ? res(200, { accessToken: fresh(), refreshToken: 'R2' }) : res(200, {})));
  await Promise.all([1, 2, 3, 4, 5].map(() => api.request('/projects'))); expect(calls.filter((c) => c.includes('refresh')).length).toBe(1);
});
test('network failure is reported as a network error (not as logged out)', async () => {
  const st = mem({ rvs_access: fresh(), rvs_refresh: 'R1' }); const { api } = mk(st, () => { throw new Error('x'); });
  await expect(api.request('/projects')).rejects.toMatchObject({ network: true }); expect(st.m.rvs_refresh).toBe('R1');
});
test('logout revokes on the server and clears storage, even when offline', async () => {
  const st = mem({ rvs_access: fresh(), rvs_refresh: 'R1', rvs_user: '{}' }); const { api, calls } = mk(st, () => res(200, { ok: true }));
  await api.logout(); expect(calls).toContain('POST /auth/logout'); expect(st.m).toEqual({});
  const st2 = mem({ rvs_access: fresh(), rvs_refresh: 'R1' }); const b = mk(st2, () => { throw new Error('offline'); }); await b.api.logout(); expect(st2.m).toEqual({});
});
test('login with a wrong password shows the server message', async () => {
  const { api } = mk(mem(), () => res(401, { error: 'Wrong email or password' })); await expect(api.login('a@b.c', 'x')).rejects.toThrow('Wrong email or password');
});

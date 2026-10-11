// API client with persistent login. No React, no Expo imports: storage and fetch are injected, so it is unit-tested and reusable on web.
export class ApiError extends Error {
  constructor(message, status = 0, network = false) { super(message); this.status = status; this.network = network; }
}
const K = { access: 'rvs_access', refresh: 'rvs_refresh', user: 'rvs_user' };

export function jwtExp(token) { // exp (seconds) read locally; the server still validates the signature
  try { const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(globalThis.atob(p + '='.repeat((4 - (p.length % 4)) % 4))).exp || 0; } catch { return 0; }
}
const expiring = (token, now, skew = 60) => !token || jwtExp(token) - now() / 1000 < skew;
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export function createApiClient({ baseUrl, storage, fetchImpl = (...a) => globalThis.fetch(...a), now = Date.now, clientName = 'mobile' }) {
  let refreshing = null, onSessionLost = null;
  const url = (p) => `${baseUrl.replace(/\/+$/, '')}${p}`;
  const save = async (d) => {
    await storage.set(K.access, d.accessToken);
    if (d.refreshToken) await storage.set(K.refresh, d.refreshToken); // the refresh token rotates on every refresh
    if (d.user) await storage.set(K.user, JSON.stringify(d.user));
  };
  const clear = async () => { for (const k of Object.values(K)) await storage.del(k); };

  // One refresh at a time. Result: 'ok' | 'invalid' (server rejected the token: log out) | 'network' (keep the session, try again later).
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const rt = await storage.get(K.refresh);
      if (!rt) return 'invalid';
      let res;
      try { res = await fetchImpl(url('/auth/refresh'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client': clientName }, body: JSON.stringify({ refreshToken: rt }) }); }
      catch { return 'network'; }
      if (res.status === 401 || res.status === 403) { await clear(); onSessionLost?.(); return 'invalid'; }
      if (!res.ok) return 'network'; // 5xx etc: the server has a problem, the user's session is still fine
      await save(await res.json()); return 'ok';
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function request(path, { method = 'GET', body, headers = {}, auth = true, retry = true } = {}) {
    if (auth) { const a = await storage.get(K.access); if (a && expiring(a, now)) await refresh(); }
    const token = auth ? await storage.get(K.access) : null;
    let res;
    try {
      res = await fetchImpl(url(path), { method, headers: { 'Content-Type': 'application/json', 'X-Client': clientName, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw new ApiError('Network error. Check your internet connection.', 0, true); }
    if (res.status === 401 && auth && retry) {
      const r = await refresh();
      if (r === 'ok') return request(path, { method, body, headers, auth, retry: false });
      if (r === 'network') throw new ApiError('Network error. Check your internet connection.', 0, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
    return data;
  }

  const authed = async (path, body) => { const d = await request(path, { method: 'POST', body, auth: false }); await save(d); return d.user; };
  return {
    request, refresh, onSessionLost: (fn) => { onSessionLost = fn; },
    login: (email, password) => authed('/auth/login', { email, password }),
    register: (name, email, password) => authed('/auth/register', { name, email, password }),
    async logout() { // only the user (or an invalid session) ends the login. Local data is cleared even if the server cannot be reached.
      const rt = await storage.get(K.refresh);
      try { if (rt) await request('/auth/logout', { method: 'POST', body: { refreshToken: rt }, auth: false }); } catch { /* offline: still log out locally */ }
      await clear();
    },
    async getAccessToken() { const a = await storage.get(K.access); if (!a || expiring(a, now)) await refresh(); return storage.get(K.access); },
    // App start / return from background. Never logs out because of a network problem.
    async restore() {
      const rt = await storage.get(K.refresh);
      if (!rt) return { status: 'anon' };
      const cached = parse(await storage.get(K.user));
      const a = await storage.get(K.access);
      if (!a || expiring(a, now)) {
        const r = await refresh();
        if (r === 'invalid') return { status: 'anon' };
        if (r === 'network') return { status: 'authed', user: cached, offline: true };
      }
      try { const me = await request('/auth/me'); await storage.set(K.user, JSON.stringify(me.user)); return { status: 'authed', user: me.user }; }
      catch (e) { return e.status === 401 ? { status: 'anon' } : { status: 'authed', user: cached, offline: true }; }
    },
  };
}

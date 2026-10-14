// In the phone app there is no dev proxy, so the user types the server address once (stored on the device).
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const getServer = () => localStorage.getItem('rvs_server') || '';

// VITE_COOKIE_AUTH=true: the refresh token lives in an HttpOnly cookie (JavaScript can never read it) and the access token only in memory.
// Needs the API and the site on the same site (e.g. api.example.com + app.example.com) so browsers do not block the cookie. Backend: COOKIE_AUTH=true.
export const COOKIE = import.meta.env.VITE_COOKIE_AUTH === 'true';
let memAccess = null;
const getAccess = () => (COOKIE ? memAccess : localStorage.getItem('rvs_access'));
export const hasSession = () => COOKIE || !!localStorage.getItem('rvs_access');
export function setTokens(d) {
  if (COOKIE) { memAccess = d.accessToken; return; }
  localStorage.setItem('rvs_access', d.accessToken);
  if (d.refreshToken) localStorage.setItem('rvs_refresh', d.refreshToken);
}
export function clearTokens() { memAccess = null; localStorage.removeItem('rvs_access'); localStorage.removeItem('rvs_refresh'); }
const cred = () => ({ credentials: COOKIE ? 'include' : 'same-origin' });

const compute = () => {
  const server = getServer();
  if (server) return `${server.replace(/\/+$/, '')}/api`;
  return import.meta.env.VITE_API_URL || '/api';
};
let BASE = compute();

export function setServer(url) {
  const v = url.trim();
  if (v) localStorage.setItem('rvs_server', v.startsWith('http') ? v : `http://${v}`);
  else localStorage.removeItem('rvs_server');
  BASE = compute();
}

let refreshing = null; // one refresh at a time (the server rotates the refresh token on every use)
function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = COOKIE ? null : localStorage.getItem('rvs_refresh');
    if (!COOKIE && !refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', ...cred(), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COOKIE ? {} : { refreshToken }) });
      if (!res.ok) { if (res.status === 401) clearTokens(); return false; } // only a rejected token ends the session
      setTokens(await res.json());
      return true;
    } catch { return false; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  let res;
  try {
    const accessToken = getAccess();
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`; // only send it when a token exists
    res = await fetch(`${BASE}${path}`, { method, ...cred(), headers, body: body ? JSON.stringify(body) : undefined });
  } catch (error) {
    console.error('API NETWORK ERROR:', error);
    throw new Error('Network error. Check your connection.');
  }
  if (res.status === 401 && retry && (await refresh())) return api(path, { method, body, retry: false });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const fileUrl = (u) => (/^https?:/.test(u) ? u : BASE.replace(/\/api$/, '') + u);

export async function upload(path, form) {
  await api('/auth/me');
  let res;
  try {
    const accessToken = getAccess();
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    res = await fetch(`${BASE}${path}`, { method: 'POST', ...cred(), headers, body: form });
  } catch (error) {
    console.error('UPLOAD NETWORK ERROR:', error);
    throw new Error('Network error. Upload failed.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

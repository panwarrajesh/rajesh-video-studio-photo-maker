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

const CLOUD_API = 'https://rajesh-video-studio-photo-maker.onrender.com/api';

const compute = () => {
  let server = getServer();
  if (server) {
    if (server.includes('-1.onrender.com') || (server.includes('localhost') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !isNative())) {
      localStorage.removeItem('rvs_server');
      server = '';
    } else {
      return `${server.replace(/\/+$/, '')}/api`;
    }
  }
  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (envUrl && !envUrl.includes('-1.onrender.com')) return envUrl;

  // On Native Android/iOS or any deployed site (e.g. Vercel), default directly to live cloud API
  if (isNative()) return CLOUD_API;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return CLOUD_API;
    }
  }
  return '/api';
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

export async function api(path, { method = 'GET', body, retry = true, attempts = 0, timeout = 4000 } = {}) {
  let res;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const accessToken = getAccess();
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`; // only send it when a token exists
    res = await fetch(`${BASE}${path}`, {
      method,
      ...cred(),
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    console.warn(`API call failed/timed out to ${path} (attempt ${attempts + 1}):`, error);
    // If network error/timeout (e.g. Render free tier waking up), retry once quickly
    if (attempts < 1 && (method === 'GET' || path.startsWith('/auth') || path.startsWith('/projects'))) {
      await new Promise((r) => setTimeout(r, 600));
      return api(path, { method, body, retry, attempts: attempts + 1, timeout: 3500 });
    }
    console.error('API NETWORK/TIMEOUT ERROR:', error);
    throw new Error('Server wake up ho raha hai ya internet check karein. Offline mode active hai.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && retry && (await refresh())) return api(path, { method, body, retry: false });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const fileUrl = (u) => (/^https?:/.test(u) ? u : BASE.replace(/\/api$/, '') + u);

export async function upload(path, form) {
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

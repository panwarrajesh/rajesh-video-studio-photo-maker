// In the phone app there is no dev proxy, so the user types the server address once (stored on the device).
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const getServer = () => localStorage.getItem('rvs_server') || '';
const compute = () => (getServer() ? `${getServer().replace(/\/+$/, '')}/api` : import.meta.env.VITE_API_URL || '/api');
let BASE = compute();
export function setServer(url) { const v = url.trim(); if (v) localStorage.setItem('rvs_server', v.startsWith('http') ? v : `http://${v}`); else localStorage.removeItem('rvs_server'); BASE = compute(); }
const get = (k) => localStorage.getItem(k);

async function refresh() {
  const refreshToken = get('rvs_refresh');
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  if (!res.ok) return false;
  const d = await res.json();
  localStorage.setItem('rvs_access', d.accessToken); localStorage.setItem('rvs_refresh', d.refreshToken);
  return true;
}
export async function api(path, { method = 'GET', body, retry = true } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${get('rvs_access')}` }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Network error. Check your connection.'); }
  if (res.status === 401 && retry && (await refresh())) return api(path, { method, body, retry: false });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const fileUrl = (u) => (/^https?:/.test(u) ? u : BASE.replace(/\/api$/, '') + u);
export async function upload(path, form) {
  await api('/auth/me'); // refreshes the token if it has expired
  let res;
  try { res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${get('rvs_access')}` }, body: form }); }
  catch { throw new Error('Network error. Upload failed.'); }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Upload failed');
  return d;
}

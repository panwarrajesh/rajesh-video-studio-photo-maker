// Finds out WHY the app does not work, in plain words. Pure (fetch and session are injected) so it is unit-tested.
const FIX = {
  url: 'The app was built without the server address. Set EXPO_PUBLIC_API_URL=https://YOUR-BACKEND/api (mobile/.env or eas.json) and restart / rebuild.',
  reach: 'The phone cannot reach the server. Check: phone has internet, the address starts with https:// and ends with /api, the backend is running (open <address>/health in the phone browser). On free hosting the server may need ~1 minute to wake up: try again.',
  health: 'The server answered but is not healthy. See the line below.',
  db: 'The server cannot talk to its database. Check DATABASE_URL on the server and that MySQL is running.',
  refreshTokenTable: 'The database is missing the new login table. On the server run:  npx prisma db push  (then restart the backend).',
  ffmpeg: 'FFmpeg is not installed on the server, so videos cannot be exported. Install FFmpeg (the Dockerfile in backend/ does it).',
  jwt: 'The server has no JWT_SECRET. Add JWT_SECRET to the server environment and restart.',
  auth: 'The saved login was rejected. Log out and log in again.',
};
const withTimeout = async (fetchImpl, url, ms = 9000) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetchImpl(url, { signal: c.signal }); } finally { clearTimeout(t); } };

export async function runDiagnostics({ apiUrl, fetchImpl = (...a) => globalThis.fetch(...a), session }) {
  const out = []; const add = (id, title, ok, detail = '', fix = '') => out.push({ id, title, ok, detail, fix });
  if (!apiUrl) { add('url', 'Server address is set', false, 'EXPO_PUBLIC_API_URL is empty', FIX.url); return out; }
  add('url', 'Server address is set', true, apiUrl);
  let res;
  try { res = await withTimeout(fetchImpl, `${apiUrl}/health`); }
  catch (e) { add('reach', 'Server is reachable', false, e?.name === 'AbortError' ? 'No answer after 9 seconds' : String(e?.message || e), FIX.reach); return out; }
  if (!res.ok) { add('reach', 'Server is reachable', false, `Answered with status ${res.status} (is the address right? it must end with /api)`, FIX.reach); return out; }
  add('reach', 'Server is reachable', true, 'GET /health → 200');
  try {
    const d = await withTimeout(fetchImpl, `${apiUrl}/health/deep`), body = await d.json().catch(() => null);
    if (!body?.checks) add('health', 'Server is ready', true, 'Older backend (no deep check). Update the backend to see more.');
    else for (const [name, c] of Object.entries(body.checks)) add(name, { database: 'Database works', refreshTokenTable: 'Login table exists', ffmpeg: 'FFmpeg installed (exports)', jwtSecret: 'JWT secret configured' }[name] || name, c.ok, c.ok ? (c.detail || '') : c.error || '', c.ok ? '' : FIX[name === 'jwtSecret' ? 'jwt' : name] || FIX.health);
  } catch (e) { add('health', 'Server is ready', false, String(e?.message || e), FIX.health); }
  if (session) {
    const s = await session();
    if (s.status === 'anon') add('auth', 'You are logged in', false, 'No saved login', 'Log in to continue.');
    else add('auth', 'You are logged in', true, s.offline ? 'Saved login (offline right now)' : `Signed in as ${s.user?.email || s.user?.name || 'user'}`);
  }
  return out;
}

export function reportText({ results, appVersion, os, apiUrl, lastError }) {
  const lines = [`Rajesh Video Studio v${appVersion} · ${os}`, `Server: ${apiUrl || '(not set)'}`, ''];
  for (const r of results) lines.push(`${r.ok ? '✓' : '✗'} ${r.title}${r.detail ? ` — ${r.detail}` : ''}`, ...(r.ok ? [] : [`   → ${r.fix}`]));
  if (lastError) lines.push('', 'Last crash:', lastError);
  return lines.join('\n');
}

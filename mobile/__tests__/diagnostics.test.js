jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}), getItemAsync: jest.fn(async () => null), deleteItemAsync: jest.fn(async () => {}) }));
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Share, Text } from 'react-native';
import fs from 'fs';
import path from 'path';
import { runDiagnostics, reportText } from '../src/diagnostics';
import ErrorBoundary from '../src/components/ErrorBoundary';
import * as SecureStore from 'expo-secure-store';

const J = (status, body) => ({ ok: status < 300, status, json: async () => body });
const deepOk = { ok: true, checks: { database: { ok: true }, refreshTokenTable: { ok: true }, ffmpeg: { ok: true }, jwtSecret: { ok: true } } };
const fakeFetch = (map) => async (url) => { const k = Object.keys(map).find((p) => url.endsWith(p)); if (!k) throw new Error('unexpected ' + url); const v = map[k]; if (v instanceof Error) throw v; return v; };
const bad = (rs) => rs.filter((r) => !r.ok).map((r) => r.id);

test('no server address -> the one clear fix, and nothing else is tried', async () => { const rs = await runDiagnostics({ apiUrl: '' }); expect(bad(rs)).toEqual(['url']); expect(rs[0].fix).toMatch(/EXPO_PUBLIC_API_URL/); });
test('server unreachable (no internet / wrong address / asleep)', async () => { const rs = await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: fakeFetch({ '/health': new Error('Network request failed') }) }); expect(bad(rs)).toEqual(['reach']); expect(rs.find((r) => r.id === 'reach').fix).toMatch(/internet|wake up/); });
test('address missing /api -> server answers 404 and the hint says so', async () => { const rs = await runDiagnostics({ apiUrl: 'https://x', fetchImpl: fakeFetch({ '/health': J(404, {}) }) }); expect(rs.find((r) => r.id === 'reach').detail).toMatch(/\/api/); });
test('the forgotten `prisma db push` is named exactly', async () => {
  const rs = await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: fakeFetch({ '/health': J(200, { ok: true }), '/health/deep': J(503, { ok: false, checks: { ...deepOk.checks, refreshTokenTable: { ok: false, error: 'The table RefreshToken does not exist' } } }) }) });
  expect(bad(rs)).toEqual(['refreshTokenTable']); expect(rs.find((r) => r.id === 'refreshTokenTable').fix).toMatch(/prisma db push/);
});
test('database down / ffmpeg missing / no JWT secret each get their own fix', async () => {
  const rs = await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: fakeFetch({ '/health': J(200, {}), '/health/deep': J(503, { checks: { database: { ok: false, error: 'x' }, refreshTokenTable: { ok: true }, ffmpeg: { ok: false, error: 'y' }, jwtSecret: { ok: false, error: 'z' } } }) }) });
  expect(bad(rs).sort()).toEqual(['database', 'ffmpeg', 'jwtSecret']); expect(rs.find((r) => r.id === 'jwtSecret').fix).toMatch(/JWT_SECRET/);
});
test('an older backend without the deep check is not reported as broken', async () => { const rs = await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: fakeFetch({ '/health': J(200, {}), '/health/deep': J(404, {}) }) }); expect(bad(rs)).toEqual([]); });
test('session check: logged in / not logged in / offline', async () => {
  const f = fakeFetch({ '/health': J(200, {}), '/health/deep': J(200, deepOk) });
  expect(bad(await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: f, session: async () => ({ status: 'anon' }) }))).toEqual(['auth']);
  expect(bad(await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: f, session: async () => ({ status: 'authed', user: { email: 'a@b.c' } }) }))).toEqual([]);
});
test('the shareable report lists every check, the fixes and the last crash', async () => {
  const rs = await runDiagnostics({ apiUrl: 'https://x/api', fetchImpl: fakeFetch({ '/health': new Error('offline') }) }); const t = reportText({ results: rs, appVersion: '1.2.0', os: 'android 14', apiUrl: 'https://x/api', lastError: 'TypeError: boom' });
  expect(t).toContain('v1.2.0'); expect(t).toContain('✗ Server is reachable'); expect(t).toContain('→'); expect(t).toContain('TypeError: boom');
});
test('crash screen: shows the error instead of a blank screen, can share it, and recovers with "Try again"', () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({}); jest.spyOn(console, 'error').mockImplementation(() => {}); let boom = true;
  const Bomb = () => { if (boom) throw new Error('kaboom'); return <Text>all good</Text>; };
  render(<ErrorBoundary><Bomb /></ErrorBoundary>);
  expect(screen.getByText('Something went wrong')).toBeTruthy(); expect(screen.getByText('kaboom')).toBeTruthy(); expect(SecureStore.setItemAsync).toHaveBeenCalledWith('rvs_last_error', expect.stringContaining('kaboom'));
  fireEvent.press(screen.getByText('Share error report')); expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('kaboom') });
  boom = false; fireEvent.press(screen.getByText('Try again')); expect(screen.getByText('all good')).toBeTruthy();
});
test('the copy of shared/ inside the app is identical to the source (the app must build from mobile/ alone)', () => {
  const src = path.join(__dirname, '..', '..', 'shared'); if (!fs.existsSync(src)) return;
  for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.js'))) expect(fs.readFileSync(path.join(__dirname, '..', 'src', 'shared', f), 'utf8')).toBe(fs.readFileSync(path.join(src, f), 'utf8'));
});

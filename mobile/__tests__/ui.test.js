jest.mock('../src/services/api', () => ({ api: { request: jest.fn(), getAccessToken: jest.fn(), refresh: jest.fn(), restore: jest.fn(), login: jest.fn(), onSessionLost: jest.fn() } }));
jest.mock('../src/config', () => ({ API_URL: 'https://api.test/api', mediaUrl: (u) => `https://api.test${u}` }));
jest.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => ({ pause() {}, play() {}, replace() {}, replaceAsync() {}, currentTime: 0 }) }));
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({ pause() {}, play() {}, replace() {}, seekTo() {}, currentTime: 0 }) }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('react-native-safe-area-context', () => { const { View } = require('react-native'); return { SafeAreaView: View, SafeAreaProvider: View }; });
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import AuthScreen from '../src/screens/AuthScreen';
import EditorScreen from '../src/screens/EditorScreen';
import Timeline, { actionAt } from '../src/components/Timeline';
import { useAuth } from '../src/state/auth';
import { useEditor } from '../src/state/editor';
import { api } from '../src/services/api';
import * as T from '../src/shared/timeline.js';

test('login screen: wrong password shows the message, correct login calls the store', async () => {
  const login = jest.fn().mockRejectedValueOnce(new Error('Wrong email or password')).mockResolvedValueOnce(undefined); useAuth.setState({ login });
  render(<AuthScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.c'); fireEvent.changeText(screen.getByPlaceholderText('Password (min 8)'), 'bad'); fireEvent.press(screen.getByText('Log in'));
  expect(await screen.findByText('Wrong email or password')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Password (min 8)'), 'goodpass1'); fireEvent.press(screen.getByText('Log in')); await waitFor(() => expect(login).toHaveBeenCalledTimes(2));
});
test('timeline button areas: + at the end of the main track, Add audio / Add text rows, mute label', () => {
  const clips = [T.clipFromMedia([], { id: 'm1', type: 'VIDEO', duration: 4 }, 'a')], { rows } = T.rowsFor(clips), W = 400, s = { playhead: 0, zoom: 60, clips }, v = rows[0], au = rows.find((r) => r.track === 'AUDIO'), tx = rows.find((r) => r.track === 'TEXT');
  expect(actionAt(200 + 4 * 60 + 20, v.top + 10, s, rows, W)).toEqual({ act: 'media' }); expect(actionAt(100, au.top + 5, s, rows, W)).toEqual({ act: 'audio' }); expect(actionAt(100, tx.top + 5, s, rows, W)).toEqual({ act: 'text' });
  expect(actionAt(200 - 90, v.top + 10, s, rows, W)).toEqual({ act: 'mute' }); expect(actionAt(200 + 100, v.top + 10, s, rows, W)).toBeNull();
});
test('timeline renders clips, selection handles and follows the playhead without crashing', () => {
  useEditor.getState().load({ id: 'p1', name: 'P', width: 1080, height: 1920, markers: [], tracks: [{ type: 'VIDEO', clips: [{ id: 'p1_a', mediaId: 'm1', start: 0, duration: 3, trimIn: 0, speed: 1, srcLen: 3, props: {}, keyframes: {} }] }] }, [{ id: 'm1', type: 'VIDEO', name: 'clip.mp4', url: '/u/a.mp4', duration: 3 }]);
  render(<Timeline onAction={() => {}} />); expect(screen.getByText('clip.mp4')).toBeTruthy(); expect(screen.getByText('＋ Add audio')).toBeTruthy();
  useEditor.getState().seek(2); useEditor.getState().select('a'); useEditor.getState().setZoom(100);
});

const project = { id: 'p1', name: 'My Reel', width: 1080, height: 1920, fps: 30, markers: [], tracks: ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'].map((type) => ({ type, locked: false, hidden: false, muted: false, clips: type === 'VIDEO' ? [{ id: 'p1_a', mediaId: 'm1', start: 0, duration: 4, trimIn: 0, speed: 1, srcLen: 4, props: {}, keyframes: {} }] : [] })) };
test('editor screen: loads project + media, fixed toolbar, Text sheet adds a real text clip, Export sheet starts a job', async () => {
  const calls = [];
  api.request.mockImplementation(async (path, o = {}) => { calls.push(`${o.method || 'GET'} ${path}`); if (path.startsWith('/media')) return [{ id: 'm1', type: 'VIDEO', name: 'clip.mp4', url: '/u/a.mp4', duration: 4 }]; if (path.endsWith('/export')) return { id: 'job1' }; if (path.startsWith('/exports/')) return { status: 'PROCESSING', progress: 40 }; return path.includes('/timeline') ? { ok: true } : project; });
  render(<EditorScreen route={{ params: { projectId: 'p1' } }} navigation={{ goBack: jest.fn() }} />);
  expect(await screen.findByText('My Reel')).toBeTruthy(); expect(screen.getByText('Media')).toBeTruthy(); expect(screen.getByText('Effects')).toBeTruthy();
  fireEvent.press(screen.getByText('Text')); fireEvent.press(await screen.findByText('＋ Heading'));
  await waitFor(() => expect(useEditor.getState().clips.some((c) => c.kind === 'text')).toBe(true));
  fireEvent.press(screen.getByText('Done')); fireEvent.press(screen.getByText('Export')); fireEvent.press(await screen.findByText('Start export'));
  await waitFor(() => expect(calls.some((c) => c === 'POST /projects/p1/export')).toBe(true));
  expect(await screen.findByText(/Rendering… 40%/)).toBeTruthy();
});

jest.mock('../src/services/thumbs', () => ({ filmstrip: jest.fn(async () => ['file://f1.jpg', 'file://f2.jpg']), frameIndex: (t, d, n) => Math.min(n - 1, Math.floor((t / d) * n)), projectThumb: jest.fn() }));
test('timeline draws film-strip frames on a video clip once they are loaded', async () => {
  useEditor.getState().load({ id: 'p1', name: 'P', width: 1080, height: 1920, markers: [], tracks: [{ type: 'VIDEO', clips: [{ id: 'p1_a', mediaId: 'm1', start: 0, duration: 3, trimIn: 0, speed: 1, srcLen: 3, props: {}, keyframes: {} }] }] }, [{ id: 'm1', type: 'VIDEO', name: 'clip.mp4', url: '/u/a.mp4', duration: 3 }]);
  const { UNSAFE_getAllByType } = render(<Timeline onAction={() => {}} />); const { Image } = require('react-native');
  await waitFor(() => expect(UNSAFE_getAllByType(Image).some((i) => i.props.source?.uri === 'file://f1.jpg')).toBe(true));
});

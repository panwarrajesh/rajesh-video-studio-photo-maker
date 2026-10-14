jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));
import * as VT from 'expo-video-thumbnails';
import * as IM from 'expo-image-manipulator';
import { filmstrip, frameIndex, projectThumb } from '../src/services/thumbs';

beforeEach(() => { jest.clearAllMocks(); });

test('filmstrip asks for evenly spaced frames of the video, once, and caches the result', async () => {
  VT.getThumbnailAsync.mockImplementation(async (u, o) => ({ uri: `file://${o.time}.jpg` }));
  const a = await filmstrip('https://x/a.mp4', 4, 4); expect(a).toEqual(['file://500.jpg', 'file://1500.jpg', 'file://2500.jpg', 'file://3500.jpg']);
  await filmstrip('https://x/a.mp4', 4, 4); expect(VT.getThumbnailAsync).toHaveBeenCalledTimes(4);          // cached
});
test('one failing frame does not break the strip, and a bad video does not block the next one', async () => {
  VT.getThumbnailAsync.mockRejectedValueOnce(new Error('decode')).mockResolvedValue({ uri: 'file://ok.jpg' });
  expect(await filmstrip('https://x/b.mp4', 2, 3)).toEqual([null, 'file://ok.jpg', 'file://ok.jpg']);
  VT.getThumbnailAsync.mockResolvedValue({ uri: 'file://c.jpg' }); expect(await filmstrip('https://x/c.mp4', 2, 2)).toEqual(['file://c.jpg', 'file://c.jpg']);
});
test('frameIndex maps a source time to the right frame and clamps', () => { expect(frameIndex(0, 4, 8)).toBe(0); expect(frameIndex(2, 4, 8)).toBe(4); expect(frameIndex(99, 4, 8)).toBe(7); expect(frameIndex(-1, 4, 8)).toBe(0); });
test('project thumbnail: video -> frame -> 200px JPEG data URL; image skips the frame step', async () => {
  VT.getThumbnailAsync.mockResolvedValue({ uri: 'file://frame.jpg' }); IM.manipulateAsync.mockResolvedValue({ base64: 'QUJD' });
  expect(await projectThumb({ type: 'video', uri: 'file://v.mp4' })).toBe('data:image/jpeg;base64,QUJD'); expect(IM.manipulateAsync).toHaveBeenCalledWith('file://frame.jpg', [{ resize: { width: 200 } }], expect.objectContaining({ base64: true }));
  VT.getThumbnailAsync.mockClear(); await projectThumb({ type: 'image', uri: 'file://i.jpg' }); expect(VT.getThumbnailAsync).not.toHaveBeenCalled(); expect(IM.manipulateAsync.mock.calls[1][0]).toBe('file://i.jpg');
});
test('project thumbnail returns null instead of throwing, and refuses data the server would reject', async () => {
  IM.manipulateAsync.mockRejectedValueOnce(new Error('bad')); expect(await projectThumb({ type: 'image', uri: 'x' })).toBeNull();
  IM.manipulateAsync.mockResolvedValueOnce({ base64: 'A'.repeat(90000) }); expect(await projectThumb({ type: 'image', uri: 'x' })).toBeNull();
});

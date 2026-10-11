import { useEditor } from '../src/state/editor';

const proj = (clips = []) => ({ id: 'p1', name: 'P', width: 1080, height: 1920, markers: [], tracks: ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'].map((type) => ({ type, locked: false, hidden: false, muted: false, clips: type === 'VIDEO' ? clips : [] })) });
const vclip = (n, mediaId, start, duration) => ({ id: `p1_${n}`, mediaId, start, duration, trimIn: 0, speed: 1, srcLen: duration, props: {}, keyframes: {} });
const S = () => useEditor.getState();
const media = [{ id: 'm1', type: 'VIDEO', duration: 4, name: 'a.mp4', url: '/uploads/a.mp4' }, { id: 'm2', type: 'VIDEO', duration: 3, name: 'b.mp4', url: '/uploads/b.mp4' }];
beforeEach(() => S().load(proj([vclip('a', 'm1', 0, 4), vclip('b', 'm2', 4, 3)]), media));

test('load converts the server project; nothing is dirty yet', () => { expect(S().clips.map((c) => c.id)).toEqual(['a', 'b']); expect(S().dirty).toBe(false); expect(S().canUndo).toBe(false); });
test('split at the playhead makes two clips, selects the right one and marks the project dirty', () => {
  S().seek(1.5); S().select('a'); S().split();
  expect(S().clips.filter((c) => c.mediaId === 'm1').map((c) => [c.start, c.duration, c.trimIn])).toEqual([[0, 1.5, 0], [1.5, 2.5, 1.5]]); expect(S().dirty).toBe(true); expect(S().canUndo).toBe(true);
});
test('split with nothing selected uses the main clip under the playhead', () => { S().seek(5); S().split(); expect(S().clips.filter((c) => c.mediaId === 'm2').length).toBe(2); });
test('undo / redo restore the exact earlier state', () => {
  S().seek(1); S().select('a'); S().split(); expect(S().clips.length).toBe(3); S().undo(); expect(S().clips.length).toBe(2); expect(S().canRedo).toBe(true); S().redo(); expect(S().clips.length).toBe(3);
});
test('speed 2x halves the duration; delete removes; undo brings it back', () => {
  S().speed('a', 2); expect(S().clips.find((c) => c.id === 'a').duration).toBe(2); S().remove('b'); expect(S().clips.map((c) => c.id)).toEqual(['a']); S().undo(); expect(S().clips.length).toBe(2);
});
test('slider-style edits merge into a single undo step', () => {
  S().props('a', { volume: 0.9 }); S().props('a', { volume: 0.5 }); S().props('a', { volume: 0.2 }); expect(S().clips[0].props.volume).toBe(0.2); S().undo(); expect(S().clips[0].props.volume).toBe(1);
});
test('trim right snaps to the neighbouring clip start (within 8px)', () => { S().setZoom(60); S().trimRight('a', 3.97); expect(S().clips[0].duration).toBeCloseTo(4, 5); });
test('dragging a clip with long-press logic: move snaps against the other clip edge', () => { S().setZoom(60); S().moveClip('b', 4.05); expect(S().clips.find((c) => c.id === 'b').start).toBeCloseTo(4, 5); });
test('addMedia puts new photos/videos at the end of their track and registers the media', () => {
  S().addMedia([{ id: 'm3', type: 'VIDEO', duration: 2, name: 'c.mp4', url: '/u/c.mp4' }, { id: 'm4', type: 'IMAGE', duration: null, name: 'd.jpg', url: '/u/d.jpg' }]);
  expect(S().clips.find((c) => c.mediaId === 'm3').start).toBe(7); expect(S().clips.find((c) => c.mediaId === 'm4').track).toBe('IMAGE'); expect(S().media.length).toBe(4);
});
test('text and effect layers are added at the playhead on their own tracks', () => {
  S().seek(2); S().addLayer({ track: 'TEXT', kind: 'text', props: { text: 'नमस्ते' } }); S().addLayer({ track: 'EFFECTS', kind: 'effect', props: { effect: 'blur', intensity: 0.5 } });
  const t = S().clips.find((c) => c.kind === 'text'); expect([t.track, t.start, t.props.text]).toEqual(['TEXT', 2, 'नमस्ते']); expect(S().clips.find((c) => c.kind === 'effect').props.effect).toBe('blur');
});
test('markSaved only clears dirty if nothing changed while saving', () => { S().speed('a', 2); const v = S().version; S().speed('a', 1); S().markSaved(v); expect(S().dirty).toBe(true); S().markSaved(S().version); expect(S().dirty).toBe(false); });
test('muting the main track is stored in tracks (saved with the project)', () => { S().toggleMute('VIDEO'); expect(S().tracks.VIDEO.muted).toBe(true); expect(S().dirty).toBe(true); });

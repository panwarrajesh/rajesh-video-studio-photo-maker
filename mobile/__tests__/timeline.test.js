import * as T from '../../shared/timeline.js';
import { createHistory } from '../../shared/history.js';

const tracks = T.DEFAULT_TRACKS();
const media = (id, type, d) => ({ id, type, duration: d });
const base = () => { let c = []; for (const m of [media('v1', 'VIDEO', 4), media('v2', 'VIDEO', 3)]) c = T.add(c, T.clipFromMedia(c, m, m.id)).clips; return c; };

test('clips are appended back-to-back on their own track', () => { const c = base(); expect(c.map((x) => [x.id, x.start, x.duration])).toEqual([['v1', 0, 4], ['v2', 4, 3]]); expect(T.totalDuration(c)).toBe(7); });
test('split creates two clips that keep the original media window', () => {
  const r = T.split(base(), tracks, 'v1', 1.5); const [a, b] = r.clips.filter((c) => c.mediaId === 'v1');
  expect([a.start, a.duration, a.trimIn]).toEqual([0, 1.5, 0]); expect([b.start, b.duration, b.trimIn]).toEqual([1.5, 2.5, 1.5]); expect(r.selected).toBe(b.id);
});
test('split too close to an edge does nothing', () => { expect(T.split(base(), tracks, 'v1', 0.05)).toBeNull(); expect(T.split(base(), tracks, 'v1', 3.95)).toBeNull(); });
test('trim left moves start and the source offset together; cannot trim past the source', () => {
  let c = T.trimLeft(base(), tracks, 'v2', 5).clips.find((x) => x.id === 'v2'); expect([c.start, c.trimIn, c.duration]).toEqual([5, 1, 2]);
  c = T.trimLeft(base(), tracks, 'v2', 0).clips.find((x) => x.id === 'v2'); expect(c.trimIn).toBe(0); expect(c.start).toBe(4);
});
test('trim right is clamped to the source length', () => { expect(T.trimRight(base(), tracks, 'v1', 99).clips[0].duration).toBe(4); expect(T.trimRight(base(), tracks, 'v1', 0).clips[0].duration).toBe(T.MIN); });
test('speed keeps the same media window: 2x halves the length', () => { const c = T.setSpeed(base(), tracks, 'v1', 2).clips[0]; expect([c.speed, c.duration]).toEqual([2, 2]); });
test('ripple delete closes the gap, plain delete does not', () => {
  expect(T.rippleDelete(base(), tracks, 'v1').clips.map((c) => [c.id, c.start])).toEqual([['v2', 0]]);
  expect(T.remove(base(), tracks, 'v1').clips.map((c) => [c.id, c.start])).toEqual([['v2', 4]]);
});
test('duplicate lands right after the original', () => { const r = T.duplicate(base(), tracks, 'v2'); expect(r.clips.find((c) => c.id === r.selected).start).toBe(7); });
test('locked tracks cannot be edited', () => { const t = { ...tracks, VIDEO: { locked: true } }; expect(T.remove(base(), t, 'v1')).toBeNull(); expect(T.split(base(), t, 'v1', 2)).toBeNull(); expect(T.updateProps(base(), t, 'v1', { volume: 0 })).toBeNull(); });
test('snapping pulls a clip edge to a neighbour only within the pixel threshold', () => {
  expect(T.snapMove(base(), [], 10, 'v2', 4.05, 3, 60)).toBeCloseTo(4, 5); expect(T.snapMove(base(), [], 10, 'v2', 4.5, 3, 60)).toBeCloseTo(4.5, 5);
});
test('hidden track clips are not "at" the playhead', () => { expect(T.clipAt(base(), 'VIDEO', 1, tracks).id).toBe('v1'); expect(T.clipAt(base(), 'VIDEO', 1, { ...tracks, VIDEO: { hidden: true } })).toBeNull(); expect(T.clipAt(base(), 'VIDEO', 99, tracks)).toBeNull(); });
test('loadClips converts the server format (ids are prefixed with the project id)', () => {
  const proj = { id: 'p1', tracks: [{ type: 'VIDEO', locked: false, hidden: false, muted: true, clips: [{ id: 'p1_abc', mediaId: 'm', start: 1, duration: 2, trimIn: 0, speed: 1, srcLen: 2, props: { volume: 0.5 }, keyframes: null }] }] };
  const c = T.loadClips(proj)[0]; expect(c.id).toBe('abc'); expect(c.props.volume).toBe(0.5); expect(c.props.filter).toBe('original'); expect(T.loadTracks(proj).VIDEO.muted).toBe(true);
});
test('hit-testing: handle of the selected clip beats the clip body, rows resolve by y', () => {
  const clips = base(), { rows } = T.rowsFor(clips), v = rows.find((r) => r.track === 'VIDEO'), W = 400, z = 50;
  const at = (x, y, sel) => T.hitTest({ x, y, width: W, playhead: 0, zoom: z, clips, selected: sel, rows });
  expect(at(200 + 100, v.top + 10, null)).toMatchObject({ type: 'clip', clip: { id: 'v1' } });          // 0..4s => x 200..400
  expect(at(200 + 200 + 5, v.top + 10, 'v1')).toMatchObject({ type: 'handle', side: 'R' });           // right edge of v1 at x=400
  expect(at(200 - 8, v.top + 10, 'v1')).toMatchObject({ type: 'handle', side: 'L' });
  expect(at(10, v.top + 10, null)).toMatchObject({ type: 'row' }); expect(at(100, 2, null)).toBeNull();
});
test('history: undo/redo, drag edits with the same key merge into ONE step', () => {
  let t = 0; const h = createHistory(100, () => t); let cur = 'A';
  h.record(cur, 'k'); cur = 'B'; t = 100; h.record(cur, 'k'); cur = 'C'; t = 200; h.record(cur, 'k'); cur = 'D';        // merged: only 'A' saved
  expect(h.undo(cur)).toBe('A'); expect(h.canUndo()).toBe(false); expect(h.redo('A')).toBe('D'); expect(h.canRedo()).toBe(false);
  t = 5000; h.record('D', null); h.record('E', null); expect(h.undo('F')).toBe('E'); expect(h.undo('E')).toBe('D');
  h.record('X', null); expect(h.canRedo()).toBe(false);                                                               // a new edit clears redo
});

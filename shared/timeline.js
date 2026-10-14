// Pure timeline engine shared by mobile (and reusable by web). Every function returns NEW arrays and never mutates its input.
export const TRACKS = ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'];
export const MIN = 0.1;
export const DEFAULT_PROPS = { scale: 1, x: 0, y: 0, rotation: 0, flipH: false, flipV: false, opacity: 1, blur: 0, cropT: 0, cropR: 0, cropB: 0, cropL: 0, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, anim: 'none', filter: 'original', filterAmt: 1, trans: 'none', transDur: 0.6, br: 1, ct: 1, sa: 1 };
export const TEXT_DEFAULTS = { text: 'Your text', fontFamily: 'System', fontSize: 6, color: '#ffffff', bg: '', bold: true, italic: false, underline: false, align: 'center', letterSpacing: 0, lineHeight: 1.2, shadow: true, stroke: 0, strokeColor: '#000000' };
export const EFFECT_NAMES = ['blur', 'motionblur', 'vignette', 'noise', 'rgb', 'glitch', 'lightleak', 'flash', 'fade', 'pixelate', 'glow']; // all rendered by the server export
export const FILTER_NAMES = ['original', 'bright', 'contrast', 'warm', 'cool', 'vintage', 'bw', 'cinematic', 'fade', 'highcontrast', 'soft', 'night'];

const clone = (o) => JSON.parse(JSON.stringify(o));
let seq = 0;
export const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const totalDuration = (clips) => Math.max(0, ...clips.map((c) => c.start + c.duration));
export const DEFAULT_TRACKS = () => Object.fromEntries(TRACKS.map((t) => [t, { locked: false, hidden: false, muted: false }]));

// project (as returned by GET /projects/:id) <-> flat clip list. Same format the web editor saves.
export const loadClips = (proj) => proj.tracks.flatMap((t) => (t.clips || []).map((c) => ({
  id: c.id.slice(proj.id.length + 1), mediaId: c.mediaId, ...(c.kind ? { kind: c.kind } : {}), track: t.type, start: c.start, duration: c.duration,
  trimIn: c.trimIn, speed: c.speed, srcLen: c.srcLen, props: { ...DEFAULT_PROPS, ...c.props }, keyframes: c.keyframes || {},
})));
export const loadTracks = (proj) => ({ ...DEFAULT_TRACKS(), ...Object.fromEntries(proj.tracks.map((t) => [t.type, { locked: t.locked, hidden: t.hidden, muted: t.muted }])) });

const mapKf = (kf, fn) => Object.fromEntries(Object.entries(kf || {}).map(([k, a]) => [k, a.map((f) => ({ ...f, t: fn(f.t) }))]));
const patch = (clips, id, fn) => clips.map((c) => (c.id === id ? fn(c) : c));
const find = (clips, id) => clips.find((c) => c.id === id);
const lockedClip = (clips, tracks, id) => { const c = find(clips, id); return !c || !!tracks?.[c.track]?.locked; };

export function clipFromMedia(clips, m, id = newId()) { // photos/videos/audio go to the end of their own track
  const end = Math.max(0, ...clips.filter((c) => c.track === m.type).map((c) => c.start + c.duration)), duration = m.duration || 5;
  return { id, mediaId: m.id, track: m.type, start: end, duration, trimIn: 0, speed: 1, srcLen: m.type === 'IMAGE' ? 3600 : duration, props: { ...DEFAULT_PROPS }, keyframes: {} };
}
export const layerClip = ({ track, kind, start, props = {}, duration = 3, id = newId() }) => ({ id, mediaId: null, kind, track, start, duration, trimIn: 0, speed: 1, srcLen: 3600, props: { ...DEFAULT_PROPS, ...props }, keyframes: {} });
export const add = (clips, clip) => ({ clips: [...clips, clip], selected: clip.id });

export function split(clips, tracks, id, t) {
  const c = find(clips, id);
  if (!c || lockedClip(clips, tracks, id) || t <= c.start + MIN || t >= c.start + c.duration - MIN) return null;
  const right = { ...clone(c), id: newId(), start: t, trimIn: c.trimIn + (t - c.start) * c.speed, duration: c.start + c.duration - t, keyframes: mapKf(c.keyframes, (k) => k - (t - c.start)) };
  return { clips: clips.flatMap((x) => (x.id === id ? [{ ...x, duration: t - c.start }, right] : [x])), selected: right.id };
}
export function trimLeft(clips, tracks, id, ns) {
  if (lockedClip(clips, tracks, id)) return null;
  return { clips: patch(clips, id, (c) => {
    const n = Math.min(Math.max(ns, c.start - c.trimIn / c.speed, 0), c.start + c.duration - MIN), d = n - c.start;
    return { ...c, start: n, trimIn: Math.max(0, c.trimIn + d * c.speed), duration: c.duration - d, keyframes: mapKf(c.keyframes, (t) => t - d) };
  }) };
}
export function trimRight(clips, tracks, id, nd) {
  if (lockedClip(clips, tracks, id)) return null;
  return { clips: patch(clips, id, (c) => ({ ...c, duration: Math.min(Math.max(nd, MIN), (c.srcLen - c.trimIn) / c.speed) })) };
}
export const move = (clips, tracks, id, start) => (lockedClip(clips, tracks, id) ? null : { clips: patch(clips, id, (c) => ({ ...c, start: Math.max(0, start) })) });
export const remove = (clips, tracks, id) => (lockedClip(clips, tracks, id) ? null : { clips: clips.filter((c) => c.id !== id), selected: null });
export function rippleDelete(clips, tracks, id) {
  const c = find(clips, id); if (!c || lockedClip(clips, tracks, id)) return null; const end = c.start + c.duration;
  return { clips: clips.filter((x) => x.id !== id).map((x) => (x.track === c.track && x.start >= end - 0.001 ? { ...x, start: x.start - c.duration } : x)), selected: null };
}
export function duplicate(clips, tracks, id) {
  const c = find(clips, id); if (!c || lockedClip(clips, tracks, id)) return null;
  const copy = { ...clone(c), id: newId(), start: c.start + c.duration }; return { clips: [...clips, copy], selected: copy.id };
}
export const setSpeed = (clips, tracks, id, sp) => (lockedClip(clips, tracks, id) ? null : { clips: patch(clips, id, (c) => ({ ...c, duration: (c.duration * c.speed) / sp, speed: sp, keyframes: mapKf(c.keyframes, (t) => (t * c.speed) / sp) })) });
export const updateProps = (clips, tracks, id, p) => (lockedClip(clips, tracks, id) ? null : { clips: patch(clips, id, (c) => ({ ...c, props: { ...c.props, ...p } })) });

// the visible clip of a track at time t
export const clipAt = (clips, track, t, tracks) => (tracks?.[track]?.hidden ? null : clips.find((c) => c.track === track && t >= c.start && t < c.start + c.duration) || null);

// snapping: edges, markers, playhead (threshold in pixels so it feels the same at any zoom)
export function snapTime(clips, markers, playhead, skipId, t, zoom, px = 8) {
  let best = t, bd = px / zoom;
  for (const p of [0, playhead, ...markers, ...clips.filter((c) => c.id !== skipId).flatMap((c) => [c.start, c.start + c.duration])]) { const d = Math.abs(t - p); if (d < bd) { bd = d; best = p; } }
  return best;
}
export function snapMove(clips, markers, playhead, id, t, dur, zoom, px = 8) { // aligns the clip start OR end, whichever snaps closer
  const a = snapTime(clips, markers, playhead, id, t, zoom, px), e = snapTime(clips, markers, playhead, id, t + dur, zoom, px) - dur;
  const sa = a !== t, se = Math.abs(e - t) > 1e-9;
  if (sa && se) return Math.abs(a - t) <= Math.abs(e - t) ? a : e;
  return sa ? a : se ? e : t;
}

// ---- timeline screen layout (rows) + touch hit-testing, pure so it can be unit-tested
export const ROW_H = { VIDEO: 64, IMAGE: 48, OVERLAY: 40, EFFECTS: 40, AUDIO: 46, TEXT: 46 };
export function rowsFor(clips, top = 36, gap = 8) {
  const has = (t) => clips.some((c) => c.track === t), rows = []; let y = top;
  for (const t of ['VIDEO', 'IMAGE', 'OVERLAY', 'EFFECTS', 'AUDIO', 'TEXT']) if (t === 'VIDEO' || t === 'AUDIO' || t === 'TEXT' || has(t)) { rows.push({ track: t, top: y, h: ROW_H[t] }); y += ROW_H[t] + gap; }
  return { rows, height: y };
}
export function hitTest({ x, y, width, playhead, zoom, clips, selected, rows, slop = 22 }) {
  const cx = width / 2, sx = (t) => cx + (t - playhead) * zoom;
  const row = rows.find((r) => y >= r.top && y <= r.top + r.h); if (!row) return null;
  const list = clips.filter((c) => c.track === row.track);
  const sel = list.find((c) => c.id === selected);
  if (sel) { // handles of the selected clip first (a little wider than drawn so a thumb can hit them)
    if (Math.abs(x - sx(sel.start)) <= slop) return { type: 'handle', side: 'L', clip: sel };
    if (Math.abs(x - sx(sel.start + sel.duration)) <= slop) return { type: 'handle', side: 'R', clip: sel };
  }
  const hit = list.find((c) => x >= sx(c.start) && x <= sx(c.start + c.duration));
  return hit ? { type: 'clip', clip: hit } : { type: 'row', row };
}

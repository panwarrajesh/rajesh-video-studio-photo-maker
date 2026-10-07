import { create } from 'zustand';

export const totalDuration = (clips) => Math.max(0, ...clips.map((c) => c.start + c.duration));
export const DEFAULT_PROPS = { scale: 1, x: 0, y: 0, rotation: 0, flipH: false, flipV: false, opacity: 1, blur: 0, cropT: 0, cropR: 0, cropB: 0, cropL: 0, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, anim: 'none', filter: 'original', filterAmt: 1, trans: 'none', transDur: 0.6 };
export const TEXT_DEFAULTS = { text: 'Your text', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 6, color: '#ffffff', bg: '', bold: true, italic: false, underline: false, align: 'center', letterSpacing: 0, lineHeight: 1.2, shadow: true, stroke: 0, strokeColor: '#000000' };
const MIN = 0.1;
export const DEFAULT_TRACKS = () => Object.fromEntries(['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'].map((t) => [t, { locked: false, hidden: false, muted: false }]));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- keyframes: clip.keyframes = { prop: [{ t: seconds from clip start, v }] } for x,y,scale,rotation,opacity,blur,volume
const ease = (u) => u * u * (3 - 2 * u);
export function evalProp(c, k, t) {
  const f = c.keyframes?.[k];
  if (!f?.length) return c.props[k];
  const lt = t - c.start, last = f[f.length - 1];
  if (lt <= f[0].t) return f[0].v;
  if (lt >= last.t) return last.v;
  const i = f.findIndex((q) => q.t > lt), a = f[i - 1], b = f[i];
  return a.v + (b.v - a.v) * ease((lt - a.t) / (b.t - a.t));
}
export const evalProps = (c, t) => {
  const ks = Object.keys(c.keyframes || {}).filter((k) => c.keyframes[k].length);
  return ks.length ? { ...c.props, ...Object.fromEntries(ks.map((k) => [k, evalProp(c, k, t)])) } : c.props;
};
export const kfTimes = (c) => [...new Set(Object.values(c.keyframes || {}).flat().map((f) => f.t))];
const mapKf = (kf, fn) => Object.fromEntries(Object.entries(kf || {}).map(([k, a]) => [k, a.map((f) => ({ ...f, t: fn(f.t) }))]));
const upsert = (arr = [], t, v) => {
  const i = arr.findIndex((f) => Math.abs(f.t - t) < 0.05);
  const n = i >= 0 ? arr.map((f, j) => (j === i ? { t: f.t, v } : f)) : [...arr, { t, v }];
  return n.sort((a, b) => a.t - b.t);
};

// ---- history: snapshots of `clips`. Rapid edits with the same key (drag, slider) merge into one undo step.
let lastKey = '', lastAt = 0;
export const useEditor = create((set, get) => {
  const rec = (key) => {
    const now = performance.now();
    if (!key || key !== lastKey || now - lastAt > 700) set((s) => ({ past: [...s.past.slice(-99), s.clips], future: [] }));
    lastKey = key || ''; lastAt = now;
  };
  const locked = (id) => { const c = get().clips.find((x) => x.id === id); return !c || !!get().tracks[c.track]?.locked; };
  const edit = (key, id, fn) => { if (locked(id)) return; rec(key); set((s) => ({ clips: s.clips.map((c) => (c.id === id ? fn(c) : c)) })); };

  return {
    media: [], clips: [], past: [], future: [], tracks: DEFAULT_TRACKS(), markers: [], clipboard: null, playhead: 0, playing: false, selected: null, zoom: 50,
    setMedia: (media) => set({ media }),
    addClip(m) {
      rec(null);
      const end = Math.max(0, ...get().clips.filter((c) => c.track === m.type).map((c) => c.start + c.duration));
      const duration = m.duration || 5;
      const clip = { id: crypto.randomUUID(), mediaId: m.id, track: m.type, start: end, duration, trimIn: 0, speed: 1, srcLen: m.type === 'IMAGE' ? 3600 : duration, props: { ...DEFAULT_PROPS }, keyframes: {} };
      set((s) => ({ clips: [...s.clips, clip], selected: clip.id }));
    },
    addLayer({ track, kind, ...props }) {
      rec(null);
      const clip = { id: crypto.randomUUID(), mediaId: null, kind, track, start: get().playhead, duration: 3, trimIn: 0, speed: 1, srcLen: 3600, props: { ...DEFAULT_PROPS, ...props }, keyframes: {} };
      set((s) => ({ clips: [...s.clips, clip], selected: clip.id }));
    },
    moveClip: (id, start) => edit(`m${id}`, id, (c) => ({ ...c, start: Math.max(0, start) })),
    trimLeft: (id, ns) => edit(`t${id}`, id, (c) => {
      const n = Math.min(Math.max(ns, c.start - c.trimIn / c.speed, 0), c.start + c.duration - MIN), d = n - c.start;
      return { ...c, start: n, trimIn: Math.max(0, c.trimIn + d * c.speed), duration: c.duration - d, keyframes: mapKf(c.keyframes, (t) => t - d) };
    }),
    trimRight: (id, nd) => edit(`t${id}`, id, (c) => ({ ...c, duration: Math.min(Math.max(nd, MIN), (c.srcLen - c.trimIn) / c.speed) })),
    splitClip() {
      const { clips, selected, playhead: t } = get();
      const c = clips.find((x) => x.id === selected) || clips.find((x) => t > x.start && t < x.start + x.duration);
      if (!c || t <= c.start + MIN || t >= c.start + c.duration - MIN || get().tracks[c.track]?.locked) return;
      rec(null);
      const right = { ...c, id: crypto.randomUUID(), start: t, trimIn: c.trimIn + (t - c.start) * c.speed, duration: c.start + c.duration - t, props: { ...c.props }, keyframes: mapKf(c.keyframes, (k) => k - (t - c.start)) };
      set({ clips: clips.flatMap((x) => (x.id === c.id ? [{ ...c, duration: t - c.start }, right] : [x])), selected: right.id });
    },
    setSpeed: (id, sp) => edit(null, id, (c) => ({ ...c, duration: (c.duration * c.speed) / sp, speed: sp, keyframes: mapKf(c.keyframes, (t) => (t * c.speed) / sp) })),
    updateProps: (id, p) => edit(`p${id}${Object.keys(p)[0]}`, id, (c) => {
      const t = get().playhead - c.start, props = { ...c.props };
      let kf = c.keyframes || {};
      for (const [k, v] of Object.entries(p)) { if (kf[k]?.length) kf = { ...kf, [k]: upsert(kf[k], t, v) }; else props[k] = v; }
      return { ...c, props, keyframes: kf };
    }),
    toggleKeyframe(id, k) {
      const c0 = get().clips.find((x) => x.id === id), lt = get().playhead - (c0?.start ?? 0);
      if (!c0 || lt < 0 || lt > c0.duration) return;
      edit(null, id, (c) => {
        const arr = c.keyframes?.[k] || [], has = arr.some((f) => Math.abs(f.t - lt) < 0.05);
        return { ...c, keyframes: { ...c.keyframes, [k]: has ? arr.filter((f) => Math.abs(f.t - lt) >= 0.05) : upsert(arr, lt, evalProp(c, k, get().playhead)) } };
      });
    },
    clearKeyframes: (id) => edit(null, id, (c) => ({ ...c, keyframes: {} })),
    removeClip: (id) => { if (locked(id)) return; rec(null); set((s) => ({ clips: s.clips.filter((c) => c.id !== id), selected: null })); },
    removeByMedia: (mid) => { rec(null); set((s) => ({ clips: s.clips.filter((c) => c.mediaId !== mid) })); },
    toggleTrack: (type, key) => set((s) => ({ tracks: { ...s.tracks, [type]: { ...s.tracks[type], [key]: !s.tracks[type][key] } } })),
    addMarker() {
      const t = get().playhead, m = get().markers, near = m.find((x) => Math.abs(x - t) < 0.05);
      set({ markers: near !== undefined ? m.filter((x) => x !== near) : [...m, t].sort((a, b) => a - b) });
    },
    removeMarker: (t) => set((s) => ({ markers: s.markers.filter((x) => x !== t) })),
    snapPoints(skip) { const s = get(); return [0, s.playhead, ...s.markers, ...s.clips.filter((c) => c.id !== skip).flatMap((c) => [c.start, c.start + c.duration])]; },
    snapStart(id, t, dur, zoom, off) { // aligns the clip's start OR end to the nearest edge/marker/playhead (hold Alt to disable)
      if (off) return t;
      let best = t, bd = 8 / zoom;
      for (const p of get().snapPoints(id)) for (const [cand, adj] of [[t, p], [t + dur, p - dur]]) { const d = Math.abs(cand - p); if (d < bd) { bd = d; best = adj; } }
      return best;
    },
    snapPoint(id, t, zoom, off) {
      if (off) return t;
      let best = t, bd = 8 / zoom;
      for (const p of get().snapPoints(id)) { const d = Math.abs(t - p); if (d < bd) { bd = d; best = p; } }
      return best;
    },
    copy() { const c = get().clips.find((x) => x.id === get().selected); if (c) set({ clipboard: clone(c) }); },
    cut() { get().copy(); const id = get().selected; if (id) get().removeClip(id); },
    paste() {
      const cb = get().clipboard;
      if (!cb || get().tracks[cb.track]?.locked) return;
      rec(null);
      const clip = { ...clone(cb), id: crypto.randomUUID(), start: get().playhead };
      set((s) => ({ clips: [...s.clips, clip], selected: clip.id }));
    },
    duplicate() {
      const c = get().clips.find((x) => x.id === get().selected);
      if (!c || get().tracks[c.track]?.locked) return;
      rec(null);
      const clip = { ...clone(c), id: crypto.randomUUID(), start: c.start + c.duration };
      set((s) => ({ clips: [...s.clips, clip], selected: clip.id }));
    },
    rippleDelete(id) { // delete and close the gap on the same track
      const c = get().clips.find((x) => x.id === id);
      if (!c || locked(id)) return;
      rec(null);
      const end = c.start + c.duration;
      set((s) => ({ selected: null, clips: s.clips.filter((x) => x.id !== id).map((x) => (x.track === c.track && x.start >= end - 0.001 ? { ...x, start: x.start - c.duration } : x)) }));
    },
    undo() {
      const { past, clips, future } = get();
      if (!past.length) return;
      lastKey = '';
      set({ clips: past[past.length - 1], past: past.slice(0, -1), future: [clips, ...future], selected: null });
    },
    redo() {
      const { past, clips, future } = get();
      if (!future.length) return;
      lastKey = '';
      set({ clips: future[0], future: future.slice(1), past: [...past, clips], selected: null });
    },
    select: (selected) => set({ selected }),
    seek: (t) => set({ playhead: Math.max(0, t) }),
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom }),
  };
});

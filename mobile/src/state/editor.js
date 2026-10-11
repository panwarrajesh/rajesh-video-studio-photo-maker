import { create } from 'zustand';
import * as T from '../../../shared/timeline.js';
import { createHistory } from '../../../shared/history.js';

const hist = createHistory(100);
const mainAt = (s) => T.clipAt(s.clips, 'VIDEO', s.playhead, s.tracks) || T.clipAt(s.clips, 'IMAGE', s.playhead, s.tracks);

export const useEditor = create((set, get) => {
  const flags = () => ({ canUndo: hist.canUndo(), canRedo: hist.canRedo() });
  const run = (key, fn) => { // every edit goes through here: history snapshot + dirty flag for autosave
    const s = get(), r = fn(s); if (!r) return false;
    hist.record(s.clips, key);
    set({ clips: r.clips, ...(r.selected !== undefined ? { selected: r.selected } : {}), ...flags(), version: s.version + 1, dirty: true });
    return true;
  };
  return {
    project: null, media: [], clips: [], tracks: T.DEFAULT_TRACKS(), markers: [], selected: null, playhead: 0, playing: false, zoom: 60, version: 0, dirty: false, canUndo: false, canRedo: false,
    load(project, media) { hist.clear(); set({ project, media, clips: T.loadClips(project), tracks: T.loadTracks(project), markers: project.markers || [], selected: null, playhead: 0, playing: false, version: 0, dirty: false, ...flags() }); },
    setProject: (project) => set({ project }),
    addMedia(items) {
      set((s) => ({ media: [...s.media.filter((m) => !items.some((i) => i.id === m.id)), ...items] }));
      run(null, (s) => { let clips = s.clips; for (const m of items) clips = [...clips, T.clipFromMedia(clips, m)]; return { clips, selected: null }; });
    },
    addLayer: (opts) => run(null, (s) => T.add(s.clips, T.layerClip({ start: s.playhead, ...opts }))),
    split() { run(null, (s) => { const c = s.clips.find((x) => x.id === s.selected) || mainAt(s); return c ? T.split(s.clips, s.tracks, c.id, s.playhead) : null; }); },
    trimLeft: (id, t) => run(`t${id}`, (s) => T.trimLeft(s.clips, s.tracks, id, T.snapTime(s.clips, s.markers, s.playhead, id, t, s.zoom))),
    trimRight: (id, end) => run(`t${id}`, (s) => { const c = s.clips.find((x) => x.id === id); return c && T.trimRight(s.clips, s.tracks, id, T.snapTime(s.clips, s.markers, s.playhead, id, end, s.zoom) - c.start); }),
    moveClip: (id, start) => run(`m${id}`, (s) => { const c = s.clips.find((x) => x.id === id); return c && T.move(s.clips, s.tracks, id, T.snapMove(s.clips, s.markers, s.playhead, id, start, c.duration, s.zoom)); }),
    remove: (id) => run(null, (s) => T.remove(s.clips, s.tracks, id)),
    duplicate: (id) => run(null, (s) => T.duplicate(s.clips, s.tracks, id)),
    speed: (id, sp) => run(null, (s) => T.setSpeed(s.clips, s.tracks, id, sp)),
    props: (id, p) => run(`p${id}${Object.keys(p)[0]}`, (s) => T.updateProps(s.clips, s.tracks, id, p)),
    undo() { const s = get(), prev = hist.undo(s.clips); if (prev) set({ clips: prev, selected: null, ...flags(), version: s.version + 1, dirty: true }); },
    redo() { const s = get(), next = hist.redo(s.clips); if (next) set({ clips: next, selected: null, ...flags(), version: s.version + 1, dirty: true }); },
    select: (id) => set({ selected: id }), seek: (t) => set({ playhead: Math.max(0, t) }), setPlaying: (playing) => set({ playing }), setZoom: (zoom) => set({ zoom }),
    toggleMute: (track) => set((s) => ({ tracks: { ...s.tracks, [track]: { ...s.tracks[track], muted: !s.tracks[track].muted } }, dirty: true, version: s.version + 1 })),
    markSaved: (version) => set((s) => (s.version === version ? { dirty: false } : {})),
  };
});

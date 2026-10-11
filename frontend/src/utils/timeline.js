import { DEFAULT_TRACKS } from '../store/editor.js';
export const loadTracks = (proj) => ({ ...DEFAULT_TRACKS(), ...Object.fromEntries(proj.tracks.map((t) => [t.type, { locked: t.locked, hidden: t.hidden, muted: t.muted }])) });
// Converts the project returned by the API (tracks -> clips) into the editor's flat clip list.
export const loadClips = (proj) => proj.tracks.flatMap((t) => (t.clips || []).map((c) => ({
  id: c.id.slice(proj.id.length + 1), mediaId: c.mediaId, ...(c.kind ? { kind: c.kind } : {}), track: t.type,
  start: c.start, duration: c.duration, trimIn: c.trimIn, speed: c.speed, srcLen: c.srcLen, props: c.props, keyframes: c.keyframes || {},
})));

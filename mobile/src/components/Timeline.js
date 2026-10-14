import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, PanResponder, Image, Vibration } from 'react-native';
import { useEditor } from '../state/editor';
import * as T from '../shared/timeline.js';
import { mediaUrl } from '../config';
import { filmstrip, frameIndex } from '../services/thumbs';
import { c, TRACK_COLOR } from '../theme';

export const TL_HEIGHT = 250;

// real frames of the video drawn along the clip (like a film strip); falls back to the plain coloured bar while loading
function Strip({ clip, media, h, width }) {
  const url = media ? mediaUrl(media.url) : null, dur = media?.duration || clip.srcLen || 1, [frames, setFrames] = useState(null);
  useEffect(() => { let live = true; if (url) filmstrip(url, dur).then((f) => live && setFrames(f)); return () => { live = false; }; }, [url, dur]);
  if (!frames) return null;
  const tw = Math.max(h, width / 60), n = Math.max(1, Math.ceil(width / tw));
  return <View style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row', opacity: 0.85 }}>{Array.from({ length: n }, (_, i) => {
    const uri = frames[frameIndex(clip.trimIn + (((i + 0.5) * tw) / width) * clip.duration * clip.speed, dur, frames.length)];
    return uri ? <Image key={i} source={{ uri }} resizeMode="cover" style={{ width: tw, height: h }} /> : <View key={i} style={{ width: tw, height: h }} />;
  })}</View>;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function TimeLabel() {
  const t = useEditor((s) => s.playhead), tot = useEditor((s) => T.totalDuration(s.clips));
  return <View style={{ height: 30, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: c.tl }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 12 }}>{mmss(t)} <Text style={{ color: c.mut, fontWeight: '500' }}>/ {mmss(tot)}</Text></Text></View>;
}

// areas that behave like buttons (they are drawn inside the scrolling layer, so they are hit-tested here)
export function actionAt(x, y, s, rows, w) {
  const sx = (t) => w / 2 + (t - s.playhead) * s.zoom, inRow = (r) => r && y >= r.top && y <= r.top + r.h, vr = rows.find((r) => r.track === 'VIDEO');
  const mainEnd = Math.max(0, ...s.clips.filter((q) => q.track === 'VIDEO').map((q) => q.start + q.duration));
  if (inRow(vr) && x >= sx(mainEnd) + 6 && x <= sx(mainEnd) + 60) return { act: 'media' };
  if (inRow(vr) && x >= sx(0) - 118 && x <= sx(0) - 60) return { act: 'mute' };
  for (const [track, act] of [['AUDIO', 'audio'], ['TEXT', 'text']]) if (inRow(rows.find((r) => r.track === track)) && !s.clips.some((q) => q.track === track)) return { act };
  if (inRow(vr)) {
    const main = s.clips.filter((q) => q.track === 'VIDEO').sort((a, b) => a.start - b.start);
    for (let i = 1; i < main.length; i++) if (Math.abs(main[i].start - (main[i - 1].start + main[i - 1].duration)) < 0.06 && Math.abs(x - sx(main[i].start)) < 16) return { act: 'trans', id: main[i].id };
  }
  return null;
}

// Fixed centre playhead; the timeline slides under it. One finger: scrub / trim (selected clip handles) / long-press to move. Two fingers: pinch zoom.
export default function Timeline({ onAction }) {
  const clips = useEditor((s) => s.clips), media = useEditor((s) => s.media), selected = useEditor((s) => s.selected), zoom = useEditor((s) => s.zoom), tracks = useEditor((s) => s.tracks);
  const [w, setW] = useState(0), tx = useRef(new Animated.Value(0)).current, g = useRef(null), L = useRef({}), act = useRef(onAction);
  const { rows } = useMemo(() => T.rowsFor(clips), [clips]);
  L.current = { w, rows }; act.current = onAction;

  useEffect(() => { // move the layer without re-rendering React on every frame
    const apply = (s) => tx.setValue(w / 2 - s.playhead * s.zoom);
    apply(useEditor.getState());
    return useEditor.subscribe((s, p) => { if (s.playhead !== p.playhead || s.zoom !== p.zoom) apply(s); });
  }, [w, tx]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const ne = e.nativeEvent, s = useEditor.getState(), { w: W, rows: R } = L.current;
      if (ne.touches.length >= 2) { g.current = { type: 'pinch', d0: Math.abs(ne.touches[0].pageX - ne.touches[1].pageX) || 1, z0: s.zoom }; return; }
      const x = ne.locationX, y = ne.locationY, a = actionAt(x, y, s, R, W), hit = T.hitTest({ x, y, width: W, playhead: s.playhead, zoom: s.zoom, clips: s.clips, selected: s.selected, rows: R });
      g.current = { type: a ? 'act' : hit?.type === 'handle' ? 'trim' : 'tap', a, hit, x0: ne.pageX, t0: s.playhead, c0: hit?.clip && { ...hit.clip }, moved: false, timer: null };
      if (!a && hit?.type === 'clip') g.current.timer = setTimeout(() => { const q = g.current; if (q && !q.moved) { q.type = 'move'; useEditor.getState().select(q.c0.id); Vibration.vibrate(15); } }, 450);
    },
    onPanResponderMove: (e) => {
      const ne = e.nativeEvent, q = g.current; if (!q) return;
      const s = useEditor.getState();
      if (ne.touches.length >= 2) { if (q.type !== 'pinch') { clearTimeout(q.timer); q.type = 'pinch'; q.d0 = Math.abs(ne.touches[0].pageX - ne.touches[1].pageX) || 1; q.z0 = s.zoom; } s.setZoom(clamp((q.z0 * Math.abs(ne.touches[0].pageX - ne.touches[1].pageX)) / q.d0, 15, 300)); return; }
      if (q.type === 'pinch') return;
      const dx = ne.pageX - q.x0; if (Math.abs(dx) > 6) q.moved = true;
      if (q.type === 'trim') { const k = q.c0; if (q.hit.side === 'L') s.trimLeft(k.id, k.start + dx / s.zoom); else s.trimRight(k.id, k.start + k.duration + dx / s.zoom); }
      else if (q.type === 'move') s.moveClip(q.c0.id, q.c0.start + dx / s.zoom);
      else if (q.moved) { clearTimeout(q.timer); q.type = 'scrub'; }
      if (q.type === 'scrub') { if (s.playing) s.setPlaying(false); s.seek(clamp(q.t0 - dx / s.zoom, 0, T.totalDuration(s.clips))); }
    },
    onPanResponderRelease: () => {
      const q = g.current; g.current = null; if (!q) return; clearTimeout(q.timer);
      if (q.moved || q.type === 'pinch' || q.type === 'trim') return;
      const s = useEditor.getState();
      if (q.a) return act.current?.(q.a);
      s.select(q.hit?.type === 'clip' ? q.hit.clip.id : null);
    },
    onPanResponderTerminate: () => { if (g.current) clearTimeout(g.current.timer); g.current = null; },
  }), []);

  const total = T.totalDuration(clips), step = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 25 ? 5 : 10, secs = Math.ceil(total + 8);
  const mainEnd = Math.max(0, ...clips.filter((q) => q.track === 'VIDEO').map((q) => q.start + q.duration));
  const main = clips.filter((q) => q.track === 'VIDEO').sort((a, b) => a.start - b.start);
  const labelOf = (k) => (k.kind === 'text' ? k.props.text : k.kind === 'effect' ? k.props.effect : media.find((m) => m.id === k.mediaId)?.name || k.track);
  return (
    <View style={{ height: TL_HEIGHT, backgroundColor: c.tl, overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: tx }] }}>
        {Array.from({ length: secs + 1 }, (_, i) => (i % step === 0 ? <Text key={i} style={{ position: 'absolute', left: i * zoom - 20, width: 40, top: 8, textAlign: 'center', color: c.mut, fontSize: 11, fontWeight: '600' }}>{mmss(i)}</Text> : null))}
        {rows.map((r) => {
          const list = clips.filter((q) => q.track === r.track), label = r.track === 'AUDIO' ? '＋ Add audio' : r.track === 'TEXT' ? '＋ Add text' : null;
          return (
            <View key={r.track}>
              {label && !list.length && <View style={{ position: 'absolute', left: 0, top: r.top, height: r.h, width: Math.max(total, 4) * zoom + 140, borderRadius: 10, backgroundColor: '#242428', justifyContent: 'center', paddingLeft: 14 }}><Text style={{ color: '#a8aebc', fontWeight: '600' }}>{label}</Text></View>}
              {r.track === 'VIDEO' && <Text style={{ position: 'absolute', left: -112, top: r.top + 18, width: 52, textAlign: 'center', color: '#d4d8e2', fontSize: 10, fontWeight: '600' }}>{tracks.VIDEO.muted ? 'Unmute' : 'Mute clip'}</Text>}
              {list.map((k) => {
                const sel = selected === k.id, m = media.find((x) => x.id === k.mediaId), width = Math.max(4, k.duration * zoom);
                return (
                  <View key={k.id} style={{ position: 'absolute', left: k.start * zoom, top: r.top, width, height: r.h, borderRadius: 8, overflow: 'hidden', backgroundColor: TRACK_COLOR[k.track], borderWidth: sel ? 2 : 0, borderColor: '#fff', opacity: tracks[k.track]?.hidden ? 0.35 : 1 }}>
                    {k.track === 'VIDEO' && <Strip clip={k} media={m} h={r.h} width={width} />}
                    {k.track === 'IMAGE' && m && <Image source={{ uri: mediaUrl(m.url) }} resizeMode="cover" style={{ position: 'absolute', width, height: r.h, opacity: 0.7 }} />}
                    <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 12, margin: 8, marginLeft: 12, textShadowColor: '#0009', textShadowRadius: 3 }}>{labelOf(k)}{k.speed !== 1 ? `  ${k.speed}x` : ''}</Text>
                    {sel && <><View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, backgroundColor: '#fff' }} /><View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 14, backgroundColor: '#fff' }} /></>}
                  </View>
                );
              })}
              {r.track === 'VIDEO' && <View style={{ position: 'absolute', left: mainEnd * zoom + 10, top: r.top + 4, width: 44, height: r.h - 8, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: '#111', fontWeight: '700' }}>+</Text></View>}
            </View>
          );
        })}
        {main.slice(1).map((k, i) => (Math.abs(k.start - (main[i].start + main[i].duration)) < 0.06 ? <View key={k.id} style={{ position: 'absolute', left: k.start * zoom - 12, top: rows[0].top + 6, width: 24, height: rows[0].h - 12, borderRadius: 7, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 3, height: 16, backgroundColor: '#444', borderRadius: 2 }} /></View> : null))}
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 1, top: 0, bottom: 0, width: 2, backgroundColor: '#fff' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}><TimeLabel /></View>
    </View>
  );
}

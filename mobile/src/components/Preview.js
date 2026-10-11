import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { useEditor } from '../state/editor';
import * as T from '../../../shared/timeline.js';
import { mediaUrl } from '../config';

// Preview approximations of the export filters (the exported file uses the real FFmpeg versions)
const TINT = { bright: ['#ffffff', 0.12], warm: ['#ff9a3c', 0.2], cool: ['#3c8cff', 0.18], vintage: ['#8a5a2b', 0.3], bw: ['#808080', 0.45], cinematic: ['#0d2233', 0.22], fade: ['#ffffff', 0.18], night: ['#0a1a4a', 0.4], soft: ['#ffffff', 0.08], highcontrast: ['#000000', 0.12], contrast: ['#000000', 0.1] };

export default function Preview() {
  const project = useEditor((s) => s.project);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const key = useEditor((s) => { // re-render only when the set of visible things (or an edit) changes, not on every playhead tick
    const v = T.clipAt(s.clips, 'VIDEO', s.playhead, s.tracks), i = T.clipAt(s.clips, 'IMAGE', s.playhead, s.tracks);
    const t = s.clips.filter((q) => q.track === 'TEXT' && !s.tracks.TEXT.hidden && s.playhead >= q.start && s.playhead < q.start + q.duration).map((q) => q.id).join(',');
    return `${v?.id}|${i?.id}|${t}|${s.version}`;
  });
  const vp = useVideoPlayer(null, (p) => { p.loop = false; }), ap = useAudioPlayer(null);

  useEffect(() => { // keep the native players in step with the timeline clock
    let loaded = null, lastCheck = 0, wasPlaying = false;
    const run = (s) => {
      const k = T.clipAt(s.clips, 'VIDEO', s.playhead, s.tracks), m = k && s.media.find((x) => x.id === k.mediaId);
      if (!k || !m) { if (wasPlaying) { vp.pause(); wasPlaying = false; } return; }
      const url = mediaUrl(m.url);
      if (loaded !== url) { loaded = url; lastCheck = 0; if (vp.replaceAsync) vp.replaceAsync(url); else vp.replace(url); }
      const want = k.trimIn + (s.playhead - k.start) * k.speed, now = Date.now();
      if (!s.playing || now - lastCheck > 300) { lastCheck = now; if (!s.playing || Math.abs(vp.currentTime - want) > 0.4) vp.currentTime = want; }
      vp.playbackRate = k.speed; vp.volume = k.props.volume; vp.muted = !!(s.tracks.VIDEO.muted || k.props.muted);
      if (s.playing && !wasPlaying) { vp.play(); wasPlaying = true; } else if (!s.playing && wasPlaying) { vp.pause(); wasPlaying = false; }
    };
    run(useEditor.getState());
    return useEditor.subscribe(run);
  }, [vp]);
  useEffect(() => { // audio track
    let loaded = null, lastCheck = 0, wasPlaying = false;
    const run = (s) => {
      const k = T.clipAt(s.clips, 'AUDIO', s.playhead, s.tracks), m = k && s.media.find((x) => x.id === k.mediaId);
      if (!k || !m) { if (wasPlaying) { ap.pause(); wasPlaying = false; } return; }
      const url = mediaUrl(m.url);
      if (loaded !== url) { loaded = url; lastCheck = 0; ap.replace(url); }
      const want = k.trimIn + (s.playhead - k.start) * k.speed, now = Date.now();
      if (!s.playing || now - lastCheck > 400) { lastCheck = now; if (!s.playing || Math.abs(ap.currentTime - want) > 0.5) ap.seekTo(want); }
      ap.volume = k.props.volume; ap.muted = !!(s.tracks.AUDIO.muted || k.props.muted);
      if (s.playing && !wasPlaying) { ap.play(); wasPlaying = true; } else if (!s.playing && wasPlaying) { ap.pause(); wasPlaying = false; }
    };
    run(useEditor.getState());
    return useEditor.subscribe(run);
  }, [ap]);

  const s = useEditor.getState(), ratio = project ? project.width / project.height : 9 / 16;
  const W = Math.min(box.w, box.h * ratio) || 0, H = W / ratio;
  const v = T.clipAt(s.clips, 'VIDEO', s.playhead, s.tracks), i = T.clipAt(s.clips, 'IMAGE', s.playhead, s.tracks), main = v || i, im = i && !v && s.media.find((x) => x.id === i.mediaId);
  const texts = s.clips.filter((q) => q.track === 'TEXT' && !s.tracks.TEXT.hidden && s.playhead >= q.start && s.playhead < q.start + q.duration);
  const tint = main && TINT[main.props.filter], tr = (k) => [{ translateX: (W * k.props.x) / 200 }, { translateY: (H * k.props.y) / 200 }, { rotate: `${k.props.rotation}deg` }, { scale: k.props.scale }];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width - 16, h: e.nativeEvent.layout.height - 16 })} data-key={key}>
      <View style={{ width: W, height: H, backgroundColor: '#000', overflow: 'hidden', borderRadius: 6 }}>
        <VideoView player={vp} nativeControls={false} contentFit="contain" style={{ position: 'absolute', width: W, height: H, opacity: v ? (v.props.opacity ?? 1) : 0, transform: v ? tr(v) : [] }} />
        {im && <Image source={{ uri: mediaUrl(im.url) }} resizeMode="contain" style={{ position: 'absolute', width: W, height: H, opacity: i.props.opacity ?? 1, transform: tr(i) }} />}
        {!!tint && <View pointerEvents="none" style={{ position: 'absolute', width: W, height: H, backgroundColor: tint[0], opacity: tint[1] * (main.props.filterAmt ?? 1) }} />}
        {texts.map((k) => (
          <View key={k.id} pointerEvents="none" style={{ position: 'absolute', width: W, height: H, alignItems: 'center', justifyContent: 'center', opacity: k.props.opacity, transform: tr({ props: { ...k.props, scale: 1 } }) }}>
            <Text style={{ color: k.props.color, fontSize: (k.props.fontSize / 100) * W * k.props.scale, fontWeight: k.props.bold ? '800' : '400', fontStyle: k.props.italic ? 'italic' : 'normal', textAlign: 'center', backgroundColor: k.props.bg || 'transparent', paddingHorizontal: k.props.bg ? 8 : 0, textShadowColor: k.props.shadow ? '#000c' : 'transparent', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } }}>{k.props.text}</Text>
          </View>))}
        {!main && !texts.length && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#666' }}>{s.clips.length ? '' : 'Add media to start'}</Text></View>}
      </View>
    </View>
  );
}

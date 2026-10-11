import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, AppState, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEditor } from '../state/editor';
import * as T from '../../../shared/timeline.js';
import { api } from '../services/api';
import { uploadMedia } from '../services/upload';
import { exportPayload, startExport, getExport, downloadAndShare } from '../services/exportJob';
import Preview from '../components/Preview';
import Timeline from '../components/Timeline';
import { c } from '../theme';

const SWATCH = ['#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#ff2d92', '#8e8e93'];
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const Chip = ({ on, label, onPress }) => <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, backgroundColor: on ? c.brand : c.s3, marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{label}</Text></Pressable>;
const Row = ({ children }) => <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 4 }}>{children}</ScrollView>;
const Rng = ({ label, value, min, max, step = 0.05, onChange }) => (
  <View><Text style={{ color: c.mut, fontWeight: '600' }}>{label}  <Text style={{ color: c.text }}>{Math.round(value * 100) / 100}</Text></Text>
    <Slider value={value} minimumValue={min} maximumValue={max} step={step} onValueChange={onChange} minimumTrackTintColor={c.brand} maximumTrackTintColor={c.line} thumbTintColor="#fff" style={{ height: 36 }} /></View>
);
const Btn = ({ label, onPress, primary, danger, disabled }) => <Pressable disabled={disabled} onPress={onPress} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: primary ? c.brand : c.s3, opacity: disabled ? 0.5 : 1, alignItems: 'center', marginRight: 8 }}><Text style={{ color: danger ? c.danger : '#fff', fontWeight: '800' }}>{label}</Text></Pressable>;

export default function EditorScreen({ route, navigation }) {
  const { projectId, addIds } = route.params;
  const [state, setState] = useState({ loading: true, error: '' }), [sheet, setSheet] = useState(null), [save, setSave] = useState('saved'), [busy, setBusy] = useState(null);
  const clips = useEditor((s) => s.clips), selected = useEditor((s) => s.selected), playing = useEditor((s) => s.playing), canUndo = useEditor((s) => s.canUndo), canRedo = useEditor((s) => s.canRedo), project = useEditor((s) => s.project), media = useEditor((s) => s.media);
  const E = useEditor.getState;
  const sel = clips.find((q) => q.id === selected);

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const [p, m] = await Promise.all([api.request(`/projects/${projectId}`), api.request(`/media?projectId=${projectId}`)]);
      E().load(p, m);
      if (addIds?.length) { E().addMedia(addIds.map((id) => m.find((x) => x.id === id)).filter(Boolean)); E().select(null); }
      setState({ loading: false, error: '' });
    } catch (e) { setState({ loading: false, error: e.message }); }
  }, [projectId, addIds, E]);
  useEffect(() => { load(); return () => { E().setPlaying(false); }; }, [load, E]);

  useEffect(() => { // play clock
    if (!playing) return undefined;
    let raf, last = Date.now();
    const tick = () => { const s = E(), now = Date.now(), t = s.playhead + (now - last) / 1000; last = now; const end = T.totalDuration(s.clips); if (t >= end) { s.seek(end); s.setPlaying(false); return; } s.seek(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, E]);

  useEffect(() => { // autosave: debounced, immediate when the app goes to the background / screen closes, retry on failure
    let timer; let saving = false;
    const flush = async () => {
      const s = E(); if (!s.dirty || saving || !s.project) return; saving = true; setSave('saving'); const v = s.version;
      try { await api.request(`/projects/${projectId}/timeline`, { method: 'PUT', body: { clips: s.clips, tracks: s.tracks, markers: s.markers } }); E().markSaved(v); setSave(E().dirty ? 'dirty' : 'saved'); }
      catch { setSave('error'); clearTimeout(timer); timer = setTimeout(flush, 5000); }
      finally { saving = false; if (E().dirty && !timer) timer = setTimeout(flush, 1500); }
    };
    const unsub = useEditor.subscribe((s, p) => { if (s.version !== p.version && s.dirty) { setSave('dirty'); clearTimeout(timer); timer = setTimeout(() => { timer = null; flush(); }, 1500); } });
    const app = AppState.addEventListener('change', (st) => { if (st !== 'active') { clearTimeout(timer); timer = null; flush(); } });
    return () => { unsub(); app.remove(); clearTimeout(timer); flush(); };
  }, [projectId, E]);

  useEffect(() => { // Android back button: close a sheet / deselect before leaving
    const h = BackHandler.addEventListener('hardwareBackPress', () => { if (sheet) { setSheet(null); return true; } if (E().selected) { E().select(null); return true; } return false; });
    return () => h.remove();
  }, [sheet, E]);

  const mainAt = () => { const s = E(); return T.clipAt(s.clips, 'VIDEO', s.playhead, s.tracks) || T.clipAt(s.clips, 'IMAGE', s.playhead, s.tracks) || s.clips.find((q) => q.track === 'VIDEO' || q.track === 'IMAGE'); };
  const visualTarget = () => (sel && (sel.track === 'VIDEO' || sel.track === 'IMAGE') ? sel : mainAt());

  async function pickMedia() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 30 });
    if (res.canceled) return; await uploadAll(res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'), duration: a.duration ? a.duration / 1000 : null })));
  }
  async function pickAudio() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
    if (res.canceled) return; const a = res.assets[0]; await uploadAll([{ uri: a.uri, mime: a.mimeType || 'audio/mpeg', duration: null }]);
  }
  async function uploadAll(files) {
    const items = []; const failed = [];
    for (let i = 0; i < files.length; i++) {
      setBusy({ msg: `Uploading ${i + 1} of ${files.length}…`, pct: i / files.length });
      try { items.push(await uploadMedia({ projectId, ...files[i], onProgress: (x) => setBusy({ msg: `Uploading ${i + 1} of ${files.length}…`, pct: (i + x) / files.length }) })); } catch (e) { failed.push(e.message); }
    }
    setBusy(null); if (items.length) { E().addMedia(items); E().select(null); setSheet(null); }
    if (failed.length) Alert.alert('Upload problem', failed[0], [{ text: 'OK' }, { text: 'Retry', onPress: () => uploadAll(files) }]);
  }
  const onTimeline = (a) => { if (a.act === 'media') pickMedia(); else if (a.act === 'audio') setSheet('audio'); else if (a.act === 'text') setSheet('text'); else if (a.act === 'mute') E().toggleMute('VIDEO'); else if (a.act === 'trans') { E().select(a.id); setSheet('trans'); } };

  if (state.loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><ActivityIndicator color={c.brand} size="large" /></SafeAreaView>;
  if (state.error) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 24, gap: 14 }}><Text style={{ color: c.danger, textAlign: 'center' }}>{state.error}</Text><Btn primary label="Retry" onPress={load} /><Btn label="Back" onPress={() => navigation.goBack()} /></SafeAreaView>;

  const tool = (label, onPress, o = {}) => <Pressable key={label} onPress={onPress} disabled={o.disabled} style={{ width: 70, alignItems: 'center', paddingVertical: 10, opacity: o.disabled ? 0.35 : 1 }}><Text style={{ fontSize: 20 }}>{o.icon}</Text><Text style={{ color: o.danger ? c.danger : c.text, fontSize: 11, fontWeight: '700', marginTop: 3 }}>{label}</Text></Pressable>;
  const isVis = sel && (sel.track === 'VIDEO' || sel.track === 'IMAGE'), isMedia = sel && (sel.track === 'VIDEO' || sel.track === 'AUDIO');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 52, gap: 8 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 8 }}><Text style={{ color: c.text, fontSize: 22 }}>✕</Text></Pressable>
        <Text style={{ color: c.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>{project?.name}</Text>
        <Text style={{ color: save === 'error' ? c.danger : save === 'saved' ? c.ok : '#ffc35c', fontSize: 12, fontWeight: '700' }}>{{ saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved', error: 'Retrying…' }[save]}</Text>
        <Pressable onPress={() => setSheet('export')} disabled={!clips.length} style={{ backgroundColor: c.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, opacity: clips.length ? 1 : 0.5 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Export</Text></Pressable>
      </View>
      <Preview />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 }}>
        <Pressable disabled={!canUndo} onPress={() => E().undo()} style={{ padding: 10, opacity: canUndo ? 1 : 0.3 }}><Text style={{ color: c.text, fontSize: 20 }}>↶</Text></Pressable>
        <Pressable disabled={!canRedo} onPress={() => E().redo()} style={{ padding: 10, opacity: canRedo ? 1 : 0.3 }}><Text style={{ color: c.text, fontSize: 20 }}>↷</Text></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Pressable onPress={() => { const s = E(); if (!s.playing && s.playhead >= T.totalDuration(s.clips) - 0.05) s.seek(0); s.setPlaying(!s.playing); }} disabled={!clips.length} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', opacity: clips.length ? 1 : 0.4 }}><Text style={{ color: '#fff', fontSize: 20 }}>{playing ? '❚❚' : '▶'}</Text></Pressable>
        </View>
        <Text style={{ color: c.mut, width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{mmss(T.totalDuration(clips))}</Text>
      </View>
      <Timeline onAction={onTimeline} />

      {!!sheet && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 72, backgroundColor: c.s2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10, maxHeight: '55%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{{ speed: 'Speed', volume: 'Volume', filter: 'Filters', text: 'Text', effects: 'Effects', audio: 'Audio', export: 'Export', trans: 'Transition' }[sheet]}</Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={12}><Text style={{ color: '#9fb0ff', fontWeight: '800', fontSize: 16 }}>Done</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            {sheet === 'speed' && sel && <Row>{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((v) => <Chip key={v} on={sel.speed === v} label={`${v}x`} onPress={() => E().speed(sel.id, v)} />)}</Row>}
            {sheet === 'volume' && sel && <><Rng label="Volume" value={sel.props.volume} min={0} max={1} onChange={(v) => E().props(sel.id, { volume: v })} /><Rng label="Fade in (s)" value={sel.props.fadeIn} min={0} max={5} step={0.1} onChange={(v) => E().props(sel.id, { fadeIn: v })} /><Rng label="Fade out (s)" value={sel.props.fadeOut} min={0} max={5} step={0.1} onChange={(v) => E().props(sel.id, { fadeOut: v })} /><Row><Chip on={sel.props.muted} label={sel.props.muted ? 'Muted' : 'Mute clip'} onPress={() => E().props(sel.id, { muted: !sel.props.muted })} /></Row></>}
            {sheet === 'filter' && (() => { const k = visualTarget(); return k ? <><Row>{T.FILTER_NAMES.map((n) => <Chip key={n} on={(k.props.filter || 'original') === n} label={n} onPress={() => { E().select(k.id); E().props(k.id, { filter: n }); }} />)}</Row>
              {(k.props.filter || 'original') !== 'original' && <Rng label="Intensity" value={k.props.filterAmt} min={0} max={1} onChange={(v) => E().props(k.id, { filterAmt: v })} />}
              <Rng label="Brightness" value={k.props.br ?? 1} min={0.5} max={1.5} onChange={(v) => E().props(k.id, { br: v })} /><Rng label="Contrast" value={k.props.ct ?? 1} min={0.5} max={1.5} onChange={(v) => E().props(k.id, { ct: v })} /><Rng label="Saturation" value={k.props.sa ?? 1} min={0} max={2} onChange={(v) => E().props(k.id, { sa: v })} /></> : <Text style={{ color: c.mut }}>Add a photo or video first.</Text>; })()}
            {sheet === 'trans' && sel && <><Row>{['none', 'fade', 'crossfade'].map((n) => <Chip key={n} on={(sel.props.trans || 'none') === n} label={n} onPress={() => E().props(sel.id, { trans: n })} />)}</Row><Rng label="Length (s)" value={sel.props.transDur} min={0.2} max={2} step={0.1} onChange={(v) => E().props(sel.id, { transDur: v })} /><Text style={{ color: c.mut, fontSize: 12 }}>Fade and Cross Fade are rendered in the export.</Text></>}
            {sheet === 'effects' && <><Row>{T.EFFECT_NAMES.map((n) => <Chip key={n} on={sel?.kind === 'effect' && sel.props.effect === n} label={n} onPress={() => (sel?.kind === 'effect' ? E().props(sel.id, { effect: n }) : E().addLayer({ track: 'EFFECTS', kind: 'effect', props: { effect: n, intensity: 0.6 } }))} />)}</Row>
              {sel?.kind === 'effect' ? <Rng label="Intensity" value={sel.props.intensity} min={0} max={1} onChange={(v) => E().props(sel.id, { intensity: v })} /> : <Text style={{ color: c.mut, fontSize: 12 }}>Tap an effect to add it at the playhead (3 s). Drag its edges on the timeline to change the time range.</Text>}</>}
            {sheet === 'audio' && <><View style={{ flexDirection: 'row' }}><Btn primary label="＋ Pick audio file" onPress={pickAudio} /></View>
              <Row>{media.filter((m) => m.type === 'AUDIO').map((m) => <Chip key={m.id} label={m.name.slice(0, 22)} onPress={() => { E().addMedia([m]); setSheet(null); }} />)}</Row>
              {sel?.track === 'AUDIO' && <Rng label="Volume" value={sel.props.volume} min={0} max={1} onChange={(v) => E().props(sel.id, { volume: v })} />}</>}
            {sheet === 'text' && <>
              {sel?.kind === 'text' ? <>
                <TextInput value={sel.props.text} onChangeText={(t) => E().props(sel.id, { text: t })} multiline style={{ backgroundColor: c.s3, color: c.text, borderRadius: 12, padding: 12, fontSize: 18 }} />
                <Row>{SWATCH.map((col) => <Pressable key={col} onPress={() => E().props(sel.id, { color: col })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, marginRight: 8, borderWidth: sel.props.color === col ? 3 : 1, borderColor: sel.props.color === col ? c.brand : c.line }} />)}</Row>
                <Rng label="Size" value={sel.props.fontSize} min={2} max={20} step={0.5} onChange={(v) => E().props(sel.id, { fontSize: v })} /><Rng label="Position (up/down)" value={sel.props.y} min={-90} max={90} step={1} onChange={(v) => E().props(sel.id, { y: v })} />
                <Row><Chip on={sel.props.bold} label="Bold" onPress={() => E().props(sel.id, { bold: !sel.props.bold })} /><Chip on={!!sel.props.bg} label="Box" onPress={() => E().props(sel.id, { bg: sel.props.bg ? '' : '#000000' })} /><Chip on={sel.props.shadow} label="Shadow" onPress={() => E().props(sel.id, { shadow: !sel.props.shadow })} /></Row></>
                : <Row>{[['Heading', { fontSize: 9 }], ['Subtitle', { fontSize: 5, bold: false }], ['Caption', { fontSize: 3.6, bg: '#000000', y: 70 }]].map(([l, o]) => <Chip key={l} label={`＋ ${l}`} onPress={() => E().addLayer({ track: 'TEXT', kind: 'text', props: { ...T.TEXT_DEFAULTS, text: l, ...o } })} />)}</Row>}
              <Text style={{ color: c.mut, fontSize: 12 }}>Text appears at the playhead. Hindi and English both work.</Text></>}
            {sheet === 'export' && <ExportPanel projectId={projectId} onClose={() => setSheet(null)} />}
          </ScrollView>
        </View>)}

      <View style={{ height: 72, backgroundColor: c.s1, borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center' }}>
        {sel ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
            {tool('Back', () => E().select(null), { icon: '‹' })}{tool('Split', () => E().split(), { icon: '✂️' })}
            {isMedia && tool('Speed', () => setSheet('speed'), { icon: '⏱' })}{isMedia && tool('Volume', () => setSheet('volume'), { icon: '🔊' })}
            {isVis && tool('Filters', () => setSheet('filter'), { icon: '🎨' })}{sel.kind === 'text' && tool('Edit', () => setSheet('text'), { icon: '✏️' })}
            {sel.kind === 'effect' && tool('Edit', () => setSheet('effects'), { icon: '✨' })}
            {tool('Duplicate', () => E().duplicate(sel.id), { icon: '⧉' })}{tool('Delete', () => E().remove(sel.id), { icon: '🗑', danger: true })}
          </ScrollView>) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
            {tool('Media', pickMedia, { icon: '🖼' })}{tool('Audio', () => setSheet('audio'), { icon: '🎵' })}{tool('Text', () => setSheet('text'), { icon: 'T' })}{tool('Effects', () => setSheet('effects'), { icon: '✨' })}
            {tool('Filters', () => { if (mainAt()) setSheet('filter'); else Alert.alert('Add a photo or video first'); }, { icon: '🎨' })}{tool('Split', () => E().split(), { icon: '✂️' })}
          </ScrollView>)}
      </View>
      {!!busy && <View style={{ position: 'absolute', inset: 0, backgroundColor: '#000b', justifyContent: 'center', padding: 30 }}><View style={{ backgroundColor: c.s2, borderRadius: 20, padding: 22, gap: 12, alignItems: 'center' }}><ActivityIndicator color={c.brand} /><Text style={{ color: c.text, fontWeight: '800' }}>{busy.msg}</Text><View style={{ height: 8, alignSelf: 'stretch', backgroundColor: c.s3, borderRadius: 4 }}><View style={{ height: 8, width: `${Math.round(busy.pct * 100)}%`, backgroundColor: c.brand, borderRadius: 4 }} /></View></View></View>}
    </SafeAreaView>
  );
}

function ExportPanel({ projectId, onClose }) {
  const project = useEditor((s) => s.project);
  const [s, setS] = useState({ resolution: '720', fps: 30, format: 'mp4' }), [job, setJob] = useState(null), [err, setErr] = useState('');
  const ratio = (() => { const r = project.width / project.height; return r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1'; })();
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function start() {
    setErr(''); setJob({ status: 'QUEUED', progress: 0 });
    try {
      const { id } = await startExport(projectId, exportPayload(useEditor.getState(), { ...s, ratio }));
      const poll = async () => {
        try { const j = await getExport(id); setJob(j); if (j.status === 'QUEUED' || j.status === 'PROCESSING') timer.current = setTimeout(poll, 1500); }
        catch (e) { if (e.network) timer.current = setTimeout(poll, 3000); else { setErr(e.message); setJob(null); } }
      };
      poll();
    } catch (e) { setErr(e.message); setJob(null); }
  }
  const running = job && (job.status === 'QUEUED' || job.status === 'PROCESSING');
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.mut }}>Resolution</Text><Row>{['480', '720', '1080'].map((v) => <Chip key={v} on={s.resolution === v} label={`${v}p`} onPress={() => !running && setS({ ...s, resolution: v })} />)}</Row>
      <Text style={{ color: c.mut }}>Frame rate / format</Text><Row>{[24, 30, 60].map((v) => <Chip key={v} on={s.fps === v} label={`${v} fps`} onPress={() => !running && setS({ ...s, fps: v })} />)}{['mp4', 'webm'].map((v) => <Chip key={v} on={s.format === v} label={v.toUpperCase()} onPress={() => !running && setS({ ...s, format: v })} />)}</Row>
      {!!err && <Text style={{ color: c.danger }}>{err}</Text>}
      {job && <><View style={{ height: 8, backgroundColor: c.s3, borderRadius: 4 }}><View style={{ height: 8, width: `${job.progress || 0}%`, backgroundColor: c.brand, borderRadius: 4 }} /></View>
        <Text style={{ color: c.text }}>{job.status === 'QUEUED' ? 'Waiting in queue…' : job.status === 'PROCESSING' ? `Rendering… ${job.progress}%` : job.status === 'DONE' ? 'Your video is ready' : 'Export failed'}</Text>
        {job.status === 'FAILED' && <Text style={{ color: c.danger }}>{job.error}</Text>}
        {(job.warnings || []).map((w) => <Text key={w} style={{ color: c.mut, fontSize: 12 }}>⚠ {w}</Text>)}</>}
      <View style={{ flexDirection: 'row' }}>
        {job?.status === 'DONE' ? <Btn primary label="Save / Share" onPress={() => downloadAndShare(job.outputUrl, s.format).catch((e) => setErr(e.message))} /> : <Btn primary disabled={running} label={job?.status === 'FAILED' ? 'Retry' : running ? 'Exporting…' : 'Start export'} onPress={start} />}
        <Btn label="Close" onPress={onClose} />
      </View>
    </View>
  );
}

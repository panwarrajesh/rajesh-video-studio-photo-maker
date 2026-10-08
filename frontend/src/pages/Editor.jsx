import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, upload, fileUrl } from '../services/api.js';
import { useEditor, totalDuration, TEXT_DEFAULTS, evalProp, evalProps, kfTimes, DEFAULT_TRACKS } from '../store/editor.js';
import { useShortcuts } from '../hooks/useShortcuts.js';
import ExportDialog from '../features/ExportDialog.jsx';
import { useAutosave } from '../hooks/useAutosave.js';
import { Icon, Logo } from '../components/Icon.jsx';
import { loadClips, loadTracks } from '../utils/timeline.js';
import { EFFECTS, composeEffects } from '../effects/effects.js';
import { FxDefs, Pixelate } from '../effects/FxDefs.jsx';
import { FILTERS, filterCss } from '../filters/filters.js';
import { TRANSITIONS, transitionFx } from '../transitions/transitions.js';

const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const size = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);

function getDuration(file) {
  if (file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((ok) => {
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = (v) => { URL.revokeObjectURL(url); ok(v); };
    el.preload = 'metadata'; el.onloadedmetadata = () => done(el.duration); el.onerror = () => done(null);
    setTimeout(() => done(null), 5000); el.src = url;
  });
}
function sync(el, clip, t, playing, muted) {
  if (!el) return;
  if (!clip) return el.pause();
  const q = evalProps(clip, t), fade = Math.min(1, q.fadeIn > 0 ? (t - clip.start) / q.fadeIn : 1, q.fadeOut > 0 ? (clip.start + clip.duration - t) / q.fadeOut : 1);
  el.playbackRate = clip.speed; el.muted = !!muted; el.volume = q.muted ? 0 : Math.max(0, Math.min(1, q.volume * fade));
  const want = clip.trimIn + (t - clip.start) * clip.speed;
  if (!playing || Math.abs(el.currentTime - want) > 0.3) { try { el.currentTime = want; } catch { /* not ready */ } }
  if (playing && el.paused) el.play().catch(() => {});
  if (!playing && !el.paused) el.pause();
}

function MediaPanel({ projectId, setErr, onAdded, only }) {
  const { media, setMedia, addClip, removeByMedia } = useEditor();
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  async function send(files) {
    setBusy(true); setErr('');
    for (const f of files) {
      try {
        const fd = new FormData(); fd.append('projectId', projectId);
        const d = await getDuration(f); if (d) fd.append('duration', d);
        fd.append('file', f);
        const m = await upload('/media/upload', fd); setMedia([m, ...useEditor.getState().media]);
      } catch (e) { setErr(`${f.name}: ${e.message}`); }
    }
    setBusy(false);
  }
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { setErr(e.message); } };
  const list = media.filter((m) => (!only || m.type === only) && m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="tabbody" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); send([...e.dataTransfer.files]); }}>
      
      <label className="btn primary sm">{busy ? 'Uploading…' : only === 'AUDIO' ? '+ Upload audio' : '+ Upload (or drop files)'}
        <input hidden type="file" multiple accept=".mp4,.webm,.mov,.mp3,.wav,.png,.jpg,.jpeg,.webp" onChange={(e) => { send([...e.target.files]); e.target.value = ''; }} /></label>
      <input placeholder="Search media…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="medialist">{list.map((m) => (
        <div key={m.id} className="mitem"><b title={m.name}>{m.name}</b>
          <small className="muted">{m.type} · {size(m.size)}{m.duration ? ` · ${m.duration.toFixed(1)}s` : ''}</small>
          <div className="row">
            <button className="btn sm" onClick={() => { addClip(m); onAdded?.(); }}>Add</button>
            <button className="btn sm" onClick={wrap(async () => { const n = prompt('Rename', m.name); if (n) { const u = await api(`/media/${m.id}`, { method: 'PUT', body: { name: n } }); setMedia(media.map((x) => (x.id === m.id ? u : x))); } })}>Rename</button>
            <button className="btn sm danger" onClick={wrap(async () => { if (!confirm('Delete this media?')) return; await api(`/media/${m.id}`, { method: 'DELETE' }); removeByMedia(m.id); setMedia(media.filter((x) => x.id !== m.id)); })}>Delete</button>
          </div></div>))}
        {!list.length && <small className="muted">No media yet.</small>}</div>
    </aside>
  );
}

const SHAPES = {
  star: 'M50 5L61 38L96 38L68 58L79 92L50 72L21 92L32 58L4 38L39 38Z',
  heart: 'M50 88C10 58 5 30 25 18C38 10 48 18 50 28C52 18 62 10 75 18C95 30 90 58 50 88Z',
  arrow: 'M10 40H60V15L95 50L60 85V60H10Z',
  burst: 'M50 3L60 30L88 15L72 42L97 50L72 58L88 85L60 70L50 97L40 70L12 85L28 58L3 50L28 42L12 15L40 30Z',
  circle: 'M50 6A44 44 0 1 1 49.9 6Z',
  banner: 'M6 28H94V72H6Z',
};
const FONTS = [['Sans', 'Inter, system-ui, sans-serif'], ['Serif', 'Georgia, serif'], ['Mono', 'ui-monospace, monospace'], ['Impact', 'Impact, Haettenschweiler, sans-serif'], ['Casual', '"Comic Sans MS", cursive']];
const Shape = ({ shape, color }) => <svg viewBox="0 0 100 100" width="100%" height="100%"><path d={SHAPES[shape]} fill={color} /></svg>;
const bounce = (u) => 1 - Math.abs(Math.cos(u * 3 * Math.PI)) * (1 - u);

function animFx(kind, u) {
  const f = { o: 1, x: 0, y: 0, s: 1, blur: 0 };
  if (u >= 1) return f;
  if (kind === 'fade') f.o = u;
  if (kind === 'slide') { f.x = (1 - u) * -60; f.o = u; }
  if (kind === 'zoom') { f.s = 0.3 + 0.7 * u; f.o = u; }
  if (kind === 'bounce') f.y = (1 - bounce(u)) * -80;
  if (kind === 'pop') f.s = u < 0.6 ? (u / 0.6) * 1.2 : 1.2 - 0.2 * ((u - 0.6) / 0.4);
  if (kind === 'blur') { f.blur = (1 - u) * 12; f.o = u; }
  return f;
}
function vstyle(c, t, overlay) {
  if (!c) return {};
  const p = evalProps(c, t), f = animFx(p.anim, Math.min(1, (t - c.start) / 0.7));
  return {
    opacity: p.opacity * f.o, filter: f.blur + p.blur ? `blur(${f.blur + p.blur}px)` : undefined,
    clipPath: overlay ? undefined : `inset(${p.cropT}% ${p.cropR}% ${p.cropB}% ${p.cropL}%)`,
    transform: `${overlay ? 'translate(-50%,-50%)' : `translate(${p.x}%,${p.y}%)`} translate(${f.x}%,${f.y}%) rotate(${p.rotation}deg) scale(${p.scale * f.s * (p.flipH ? -1 : 1)},${p.scale * f.s * (p.flipV ? -1 : 1)})`,
  };
}
function Layer({ c, t }) {
  const p = evalProps(c, t), st = { ...vstyle(c, t, true), left: `${50 + p.x / 2}%`, top: `${50 + p.y / 2}%` };
  if (c.kind === 'sticker') return <div className="ovl" style={{ ...st, width: '20cqw', height: '20cqw' }}><Shape shape={p.shape} color={p.color} /></div>;
  const n = p.text.length;
  const text = p.anim === 'typewriter' ? p.text.slice(0, Math.ceil(n * Math.min(1, (t - c.start) / Math.max(0.3, n * 0.06)))) : p.text;
  return (
    <div className="ovl" style={{ ...st, fontFamily: p.fontFamily, fontSize: `${p.fontSize}cqw`, color: p.color, background: p.bg || 'transparent', padding: p.bg ? '0.15em 0.4em' : 0,
      fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? 'italic' : 'normal', textDecoration: p.underline ? 'underline' : 'none', textAlign: p.align,
      letterSpacing: `${p.letterSpacing}px`, lineHeight: p.lineHeight, textShadow: p.shadow ? '0 2px 8px rgba(0,0,0,.7)' : 'none',
      WebkitTextStroke: p.stroke ? `${p.stroke}px ${p.strokeColor}` : undefined, whiteSpace: 'pre-wrap' }}>{text}</div>
  );
}

const peaksCache = new Map(); let actx;
function Wave({ c, media }) {
  const m = media.find((x) => x.id === c.mediaId);
  const [pk, setPk] = useState(peaksCache.get(m?.id));
  useEffect(() => {
    if (!m || pk || m.size > 30e6) return;
    let dead = false;
    fetch(fileUrl(m.url)).then((r) => r.arrayBuffer()).then((b) => { actx = actx || new AudioContext(); return actx.decodeAudioData(b); }).then((buf) => {
      const d = buf.getChannelData(0), N = 400, step = Math.floor(d.length / N) || 1;
      const out = Array.from({ length: N }, (_, i) => { let mx = 0; for (let j = i * step; j < (i + 1) * step && j < d.length; j += 16) mx = Math.max(mx, Math.abs(d[j])); return mx; });
      peaksCache.set(m.id, out); if (!dead) setPk(out);
    }).catch(() => {});
    return () => { dead = true; };
  }, [m?.id, pk]); // eslint-disable-line
  if (!pk) return null;
  const a = Math.floor((c.trimIn / c.srcLen) * pk.length), b = Math.max(a + 1, Math.ceil(((c.trimIn + c.duration * c.speed) / c.srcLen) * pk.length));
  const sl = pk.slice(a, b);
  return <svg className="wave" viewBox={`0 0 ${sl.length} 2`} preserveAspectRatio="none">{sl.map((v, i) => <rect key={i} x={i} y={1 - v} width="0.8" height={Math.max(0.05, v * 2)} />)}</svg>;
}

function clipStyle(c, t) {
  if (!c) return {};
  const st = vstyle(c, t), p = c.props, x = transitionFx(p.trans, t - c.start, p.transDur);
  const f = [st.filter, filterCss(p.filter, p.filterAmt), x?.filter].filter(Boolean).join(' ') || undefined;
  if (!x) return { ...st, filter: f };
  return { ...st, filter: f, opacity: st.opacity * (x.opacity ?? 1), clipPath: x.clipPath || st.clipPath, transform: `${x.transform || ''} ${st.transform}` };
}

const TABS = [['media', 'film', 'Media'], ['text', 'type', 'Text'], ['audio', 'music', 'Audio'], ['stickers', 'smile', 'Stickers'], ['effects', 'sparkles', 'Effects']];
const PRESETS = [['Heading', { fontSize: 9, bold: true }], ['Subtitle', { fontSize: 5, bold: false }], ['Caption', { fontSize: 3.6, bold: true, bg: '#000000' }]];

function LeftPanel({ tab, setTab, projectId, setErr, onAdded }) {
  const addLayer = useEditor((x) => x.addLayer);
  const add = (a) => { addLayer(a); onAdded(); };
  return (
    <div className="panel left">
      <div className="tabs">{TABS.map(([k, ic, l]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}><Icon name={ic} size={18} /><span>{l}</span></button>)}</div>
      <div className="tabcontent">
        {tab === 'media' && <MediaPanel projectId={projectId} setErr={setErr} onAdded={onAdded} />}
        {tab === 'audio' && <MediaPanel only="AUDIO" projectId={projectId} setErr={setErr} onAdded={onAdded} />}
        {tab === 'text' && <div className="stack">
          {PRESETS.map(([l, o]) => <button key={l} className="btn block" onClick={() => add({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, text: l, ...o })}><Icon name="type" size={16} /> {l}</button>)}
          <small className="muted">Text is placed at the playhead. Change font, color and animation in Edit.</small></div>}
        {tab === 'stickers' && <div className="stickers">{Object.keys(SHAPES).map((k) => (
          <button key={k} className="stk" title={k} onClick={() => add({ track: 'OVERLAY', kind: 'sticker', shape: k, color: '#ffb020' })}><Shape shape={k} color="#ffb020" /></button>))}</div>}
        {tab === 'effects' && <div className="chips">{Object.entries(EFFECTS).map(([k, v]) => (
          <button key={k} className="chip" onClick={() => add({ track: 'EFFECTS', kind: 'effect', effect: k, intensity: 0.6 })}>{v.label}</button>))}</div>}
      </div>
    </div>
  );
}

function Preview() {
  const { clips, media, playhead, playing, tracks: tk } = useEditor();
  const v = useRef(), a = useRef(), stage = useRef();
  const at = (track) => !tk[track].hidden && clips.find((c) => c.track === track && playhead >= c.start && playhead < c.start + c.duration);
  const url = (c) => { const m = c && media.find((x) => x.id === c.mediaId); return m ? fileUrl(m.url) : undefined; };
  const vc = at('VIDEO'), ic = at('IMAGE'), ac = at('AUDIO');
  useEffect(() => { sync(v.current, vc, playhead, playing, tk.VIDEO.muted); sync(a.current, ac, playhead, playing, tk.AUDIO.muted); });
  const fx = composeEffects(clips.filter((c) => c.kind === 'effect' && !tk.EFFECTS.hidden && playhead >= c.start && playhead < c.start + c.duration), playhead);
  return (<>
    <FxDefs rgb={fx.rgb} mblur={fx.mblur} distort={fx.distort} />
    <div ref={stage} className="stage" style={{ filter: fx.filters.join(' ') || undefined, transform: fx.transforms.join(' ') || undefined }}>
    <video ref={v} src={url(vc)} className="vid" style={{ display: vc ? 'block' : 'none', ...clipStyle(vc, playhead) }} playsInline onLoadedData={() => sync(v.current, vc, useEditor.getState().playhead, useEditor.getState().playing)} />
    {!vc && ic && <img className="vid" style={clipStyle(ic, playhead)} src={url(ic)} alt="" />}
    {clips.filter((c) => (c.kind === 'text' || c.kind === 'sticker') && !tk[c.track].hidden && playhead >= c.start && playhead < c.start + c.duration).map((c) => <Layer key={c.id} c={c} t={playhead} />)}
    {fx.overlays.map((o, i) => <div key={i} className="ovfx" style={o} />)}
    {fx.pixel > 0 && <Pixelate stage={stage} size={fx.pixel} />}
    </div>
    <audio ref={a} src={url(ac)} />
  </>);
}

function useMobile() {
  const q = '(max-width:900px)', [m, setM] = useState(() => window.matchMedia?.(q)?.matches ?? false);
  useEffect(() => { const mq = window.matchMedia?.(q); if (!mq) return; const f = () => setM(mq.matches); mq.addEventListener?.('change', f); return () => mq.removeEventListener?.('change', f); }, []);
  return m;
}
function Thumb({ c, media }) {
  const m = media.find((x) => x.id === c.mediaId); if (!m) return null;
  return c.track === 'IMAGE' ? <span className="cthumb" style={{ backgroundImage: `url(${fileUrl(m.url)})` }} /> : <video className="cthumb" src={`${fileUrl(m.url)}#t=0.5`} preload="metadata" muted playsInline />;
}
const ALL_TRACKS = ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'];

function Timeline({ onAdd }) {
  const { clips, media, playhead, zoom, selected, seek, select, moveClip, trimLeft, trimRight, tracks: tk, toggleTrack, markers, removeMarker, snapStart, snapPoint } = useEditor();
  const width = Math.max(totalDuration(clips) + 10, 30) * zoom;
  const mobile = useMobile(), visTracks = mobile ? ALL_TRACKS.filter((x) => x === 'VIDEO' || clips.some((c) => c.track === x)) : ALL_TRACKS;
  function scrub(e) {
    const r = e.currentTarget.getBoundingClientRect(), mv = (ev) => seek((ev.clientX - r.left) / zoom);
    mv(e);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function drag(e, c) {
    e.stopPropagation(); select(c.id);
    const x0 = e.clientX, s0 = c.start;
    const mv = (ev) => moveClip(c.id, snapStart(c.id, s0 + (ev.clientX - x0) / zoom, c.duration, zoom, ev.altKey));
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function trim(e, c, side) {
    e.stopPropagation(); select(c.id);
    const x0 = e.clientX;
    const mv = (ev) => { const dt = (ev.clientX - x0) / zoom; if (side === 'L') trimLeft(c.id, snapPoint(c.id, c.start + dt, zoom, ev.altKey)); else trimRight(c.id, snapPoint(c.id, c.start + c.duration + dt, zoom, ev.altKey) - c.start); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  return (
    <div className="tl-scroll"><div style={{ width: width + 112, position: 'relative' }}>
      <div className="ruler" style={{ marginLeft: 112, width }} onPointerDown={scrub}>
        {Array.from({ length: Math.ceil(width / zoom) }, (_, i) => <span key={i} style={{ left: i * zoom }}>{i}s</span>)}
        {markers.map((m) => <i key={m} className="mk" style={{ left: m * zoom }} title="Marker (double-click to remove)" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={() => removeMarker(m)} />)}</div>
      {visTracks.map((t) => (
        <div key={t} className={`track ${t} ${tk[t].locked ? 'locked' : ''} ${tk[t].hidden ? 'hid' : ''}`}>
          <div className="thead"><b>{t.charAt(0) + t.slice(1).toLowerCase()}</b>
            <button title={tk[t].locked ? 'Unlock' : 'Lock'} className={tk[t].locked ? 'on' : ''} onClick={() => toggleTrack(t, 'locked')}><Icon name="lock" size={13} /></button>
            <button title={tk[t].hidden ? 'Show' : 'Hide'} className={tk[t].hidden ? 'on' : ''} onClick={() => toggleTrack(t, 'hidden')}><Icon name={tk[t].hidden ? 'eyeoff' : 'eye'} size={13} /></button>
            {(t === 'VIDEO' || t === 'AUDIO') && <button title={tk[t].muted ? 'Unmute' : 'Mute'} className={tk[t].muted ? 'on' : ''} onClick={() => toggleTrack(t, 'muted')}><Icon name={tk[t].muted ? 'volumeoff' : 'volume'} size={13} /></button>}
          </div>
          <div className="lane" style={{ width }} onClick={(e) => { if (e.target === e.currentTarget) select(null); }}>
            {clips.filter((c) => c.track === t).map((c) => (
              <div key={c.id} className={`clip ${t} ${selected === c.id ? 'sel' : ''}`} style={{ left: c.start * zoom, width: c.duration * zoom }} onPointerDown={(e) => drag(e, c)} onClick={(e) => { e.stopPropagation(); select(c.id); }}>
                <i className="h l" onPointerDown={(e) => trim(e, c, 'L')} />{(c.track === 'IMAGE' || c.track === 'VIDEO') && <Thumb c={c} media={media} />}{kfTimes(c).map((kt) => <b key={kt} className="kfd" style={{ left: kt * zoom - 4 }} />)}{c.track === 'AUDIO' && <Wave c={c} media={media} />}{c.kind === 'text' ? c.props.text : c.kind === 'sticker' ? c.props.shape : c.kind === 'effect' ? EFFECTS[c.props.effect]?.label : media.find((m) => m.id === c.mediaId)?.name}<i className="h r" onPointerDown={(e) => trim(e, c, 'R')} /></div>))}
          </div></div>))}
      {mobile && ['AUDIO', 'TEXT'].filter((k) => !visTracks.includes(k)).map((k) => <button key={k} className="addrow" onClick={() => onAdd(k === 'AUDIO' ? 'audio' : 'text')}><Icon name="plus" size={14} /> Add {k.toLowerCase()}</button>)}
      <div className="playhead" style={{ left: 112 + playhead * zoom }} />
    </div></div>
  );
}

function KSlider({ c, k, label, ...rest }) {
  const { playhead, toggleKeyframe, updateProps } = useEditor();
  const kfs = c.keyframes?.[k], lt = playhead - c.start, here = kfs?.some((f) => Math.abs(f.t - lt) < 0.05);
  return (
    <div className="kfrow"><Slider label={label} value={evalProp(c, k, playhead)} onChange={(v) => updateProps(c.id, { [k]: v })} {...rest} />
      <button className={`kf ${kfs?.length ? 'on' : ''} ${here ? 'here' : ''}`} title="Add/remove keyframe at playhead" onClick={() => toggleKeyframe(c.id, k)}>◆</button></div>
  );
}

function EffectProps({ c }) {
  const up = useEditor((x) => x.updateProps);
  return (<>
    <label className="prop"><span>Effect</span><select value={c.props.effect} onChange={(e) => up(c.id, { effect: e.target.value })}>{Object.entries(EFFECTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
    <Slider label="Intensity" value={c.props.intensity} min={0} max={1} step={0.05} onChange={(v) => up(c.id, { intensity: v })} />
  </>);
}
function MediaFx({ c }) {
  const up = useEditor((x) => x.updateProps), p = c.props;
  return (<>
    <label className="prop"><span>Filter</span><select value={p.filter} onChange={(e) => up(c.id, { filter: e.target.value })}>{Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
    {p.filter !== 'original' && <Slider label="Filter intensity" value={p.filterAmt} min={0} max={1} step={0.05} onChange={(v) => up(c.id, { filterAmt: v })} />}
    <label className="prop"><span>Transition in</span><select value={p.trans} onChange={(e) => up(c.id, { trans: e.target.value })}>{Object.entries(TRANSITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
    {p.trans !== 'none' && <Slider label="Transition length" value={p.transDur} min={0.2} max={2} step={0.1} unit="s" onChange={(v) => up(c.id, { transDur: v })} />}
  </>);
}
function TextProps({ c }) {
  const up = useEditor((x) => x.updateProps), p = c.props, set = (k) => (v) => up(c.id, { [k]: v });
  const tog = (k, l) => <button className={`btn sm ${p[k] ? 'primary' : ''}`} onClick={() => set(k)(!p[k])}>{l}</button>;
  return (<>
    <textarea rows={3} value={p.text} onChange={(e) => set('text')(e.target.value)} />
    <label className="prop"><span>Font</span><select value={p.fontFamily} onChange={(e) => set('fontFamily')(e.target.value)}>{FONTS.map(([n, v]) => <option key={n} value={v}>{n}</option>)}</select></label>
    <Slider label="Size" value={p.fontSize} min={2} max={25} step={0.5} onChange={set('fontSize')} />
    <div className="row"><input type="color" title="Text color" value={p.color} onChange={(e) => set('color')(e.target.value)} />{tog('bold', 'B')}{tog('italic', 'I')}{tog('underline', 'U')}{tog('shadow', 'Shadow')}</div>
    <div className="row"><label className="muted">Background <input type="color" value={p.bg || '#000000'} onChange={(e) => set('bg')(e.target.value)} /></label><button className="btn sm" onClick={() => set('bg')('')}>None</button></div>
    <label className="prop"><span>Align</span><select value={p.align} onChange={(e) => set('align')(e.target.value)}>{['left', 'center', 'right'].map((a) => <option key={a}>{a}</option>)}</select></label>
    <Slider label="Letter spacing" value={p.letterSpacing} min={-2} max={20} onChange={set('letterSpacing')} />
    <Slider label="Line height" value={p.lineHeight} min={0.8} max={2.5} step={0.1} onChange={set('lineHeight')} />
    <div className="row"><Slider label="Border" value={p.stroke} min={0} max={8} step={0.5} onChange={set('stroke')} /><input type="color" value={p.strokeColor} onChange={(e) => set('strokeColor')(e.target.value)} /></div>
  </>);
}
function StickerProps({ c }) {
  const up = useEditor((x) => x.updateProps);
  return (
    <div className="row"><input type="color" value={c.props.color} onChange={(e) => up(c.id, { color: e.target.value })} />
      <select value={c.props.shape} onChange={(e) => up(c.id, { shape: e.target.value })}>{Object.keys(SHAPES).map((k) => <option key={k}>{k}</option>)}</select></div>
  );
}

const Slider = ({ label, value, min, max, step = 1, onChange, unit = '' }) => (
  <label className="prop"><span>{label}<em>{Math.round(value * 100) / 100}{unit}</em></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /></label>
);

function Props() {
  const { clips, selected, updateProps, setSpeed, clearKeyframes } = useEditor();
  const c = clips.find((x) => x.id === selected);
  if (!c) return <aside className="panel">Properties<small className="muted">Select a clip on the timeline</small></aside>;
  const p = c.props, set = (k) => (v) => updateProps(c.id, { [k]: v });
  const visual = ['VIDEO', 'IMAGE', 'TEXT', 'OVERLAY'].includes(c.track), audible = c.track === 'VIDEO' || c.track === 'AUDIO', media2 = c.track === 'VIDEO' || c.track === 'IMAGE';
  return (
    <aside className="panel props"><b>Properties</b>
      {c.kind === 'text' && <TextProps c={c} />}
      {c.kind === 'sticker' && <StickerProps c={c} />}
      {c.kind === 'effect' && <EffectProps c={c} />}
      {media2 && <MediaFx c={c} />}
      {Object.values(c.keyframes || {}).some((a) => a.length) && <button className="btn sm" onClick={() => clearKeyframes(c.id)}>Clear all keyframes</button>}
      {visual && <label className="prop"><span>Entrance animation</span><select value={p.anim} onChange={(e) => set('anim')(e.target.value)}>{['none', 'fade', 'slide', 'zoom', 'bounce', 'pop', 'blur', ...(c.kind === 'text' ? ['typewriter'] : [])].map((a) => <option key={a}>{a}</option>)}</select></label>}
      {audible && <label className="prop"><span>Speed</span>
        <select value={c.speed} onChange={(e) => setSpeed(c.id, +e.target.value)}>{[0.25, 0.5, 1, 1.5, 2, 4].map((v) => <option key={v} value={v}>{v}x</option>)}</select></label>}
      {visual && <>
        <KSlider c={c} k="scale" label="Scale" min={0.1} max={3} step={0.05} />
        <KSlider c={c} k="x" label="Position X" min={-100} max={100} unit="%" />
        <KSlider c={c} k="y" label="Position Y" min={-100} max={100} unit="%" />
        <KSlider c={c} k="rotation" label="Rotation" min={-180} max={180} unit="°" />
        <KSlider c={c} k="opacity" label="Opacity" min={0} max={1} step={0.05} />
        <KSlider c={c} k="blur" label="Blur" min={0} max={20} step={0.5} unit="px" />
        <div className="row"><button className={`btn sm ${p.flipH ? 'primary' : ''}`} onClick={() => set('flipH')(!p.flipH)}>Flip H</button>
          <button className={`btn sm ${p.flipV ? 'primary' : ''}`} onClick={() => set('flipV')(!p.flipV)}>Flip V</button></div>
        {media2 && <b>Crop</b>}
        {media2 && [['cropT', 'Top'], ['cropB', 'Bottom'], ['cropL', 'Left'], ['cropR', 'Right']].map(([k, l]) => <Slider key={k} label={l} value={p[k]} min={0} max={45} unit="%" onChange={set(k)} />)}
      </>}
      {audible && <>
        <KSlider c={c} k="volume" label="Volume" min={0} max={1} step={0.05} />
        <Slider label="Fade in" value={p.fadeIn} min={0} max={5} step={0.1} unit="s" onChange={set('fadeIn')} />
        <Slider label="Fade out" value={p.fadeOut} min={0} max={5} step={0.1} unit="s" onChange={set('fadeOut')} />
        <button className={`btn sm ${p.muted ? 'primary' : ''}`} onClick={() => set('muted')(!p.muted)}>{p.muted ? 'Muted' : 'Mute'}</button></>}
      <button className="btn sm" onClick={() => updateProps(c.id, { scale: 1, x: 0, y: 0, rotation: 0, flipH: false, flipV: false, opacity: 1, cropT: 0, cropR: 0, cropB: 0, cropL: 0 })}>Reset transform</button>
    </aside>
  );
}

export default function Editor() {
  const { id } = useParams();
  const [p, setP] = useState(null); const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [showExport, setShowExport] = useState(false);
  const [tab, setTab] = useState('media'); const [sheet, setSheet] = useState(null);
  const [ready, setReady] = useState(false); const [recover, setRecover] = useState(null);
  const { playing, playhead, clips, zoom, selected, setPlaying, seek, setZoom, removeClip, setMedia, splitClip, past, future, undo, redo, duplicate, addMarker } = useEditor();

  useEffect(() => {
    useEditor.setState({ clips: [], past: [], future: [], tracks: DEFAULT_TRACKS(), markers: [], playhead: 0, playing: false, selected: null });
    setReady(false); setRecover(null);
    Promise.all([api(`/projects/${id}`), api(`/media?projectId=${id}`)]).then(([proj, m]) => {
      setP(proj); setMedia(m);
      useEditor.setState({ clips: loadClips(proj), tracks: loadTracks(proj), markers: proj.markers || [], past: [], future: [] });
      try { // unsaved local backup newer than the server copy -> offer recovery
        const b = JSON.parse(localStorage.getItem(`rvs_backup_${id}`));
        if (b?.clips && new Date(b.at) > new Date(proj.updatedAt)) setRecover(b);
      } catch { /* ignore */ }
      setReady(true);
    }).catch((e) => setErr(e.message));
  }, [id, setMedia]);

  useEffect(() => {          // playback clock
    if (!playing) return;
    let last = performance.now(), raf;
    const tick = (now) => {
      const t = useEditor.getState().playhead + (now - last) / 1000; last = now;
      const end = totalDuration(useEditor.getState().clips);
      if (t >= end) { seek(end); setPlaying(false); return; }
      seek(t); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, seek, setPlaying]);

  const { status, saveNow } = useAutosave(id, ready);
  const step = (n) => () => { const st = useEditor.getState(); st.seek(st.playhead + n / (p?.fps || 30)); };
  useShortcuts({
    left: step(-1), right: step(1), 'shift+left': step(-(p?.fps || 30)), 'shift+right': step(p?.fps || 30),
    'mod+s': saveNow,
  });

  if (err && !p) return <div className="center"><p className="err">{err}</p><Link to="/">Back</Link></div>;
  if (!p) return <div className="center">Loading…</div>;
  const dur = totalDuration(clips);
  return (
    <div className="editor">
      <header className="top etop">
        <Link className="ib" to="/" title="Back to projects"><Icon name="back" /></Link>
        <span className="brandmark"><Logo /></span><b className="pname">{p.name}</b>
        <span className={`savechip save-${status}`}>{{ saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved', error: 'Retrying…' }[status]}</span>
        {err && <span className="err">{err}</span>}
        {recover && <span className="recover">Unsaved changes found ({new Date(recover.at).toLocaleTimeString()}){' '}
          <button className="btn sm primary" onClick={() => { useEditor.setState({ clips: recover.clips, tracks: recover.tracks || DEFAULT_TRACKS(), markers: recover.markers || [] }); setRecover(null); }}>Restore</button>{' '}
          <button className="btn sm" onClick={() => { localStorage.removeItem(`rvs_backup_${id}`); setRecover(null); }}>Discard</button></span>}
        <span className="grow" /><span className="muted res">{p.width}×{p.height} · {p.fps}fps</span>
        <button className="btn primary" onClick={() => setShowExport(true)}><Icon name="download" size={16} /> Export</button>
      </header>
      <div className={`zl ${sheet === 'left' ? 'open' : ''}`}><button className="ib sheet-x" onClick={() => setSheet(null)}><Icon name="close" /></button><LeftPanel tab={tab} setTab={setTab} projectId={id} setErr={setErr} onAdded={() => setSheet('props')} /></div>
      <section className="preview">
        <div className="canvaswrap"><div className="canvas" style={{ aspectRatio: `${p.width}/${p.height}`, '--ar': p.width / p.height }}><Preview /></div></div>
        <div className="transport">
          <div className="tgroup">
            <button className="ib" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}><Icon name="undo" /></button>
            <button className="ib" title="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Icon name="redo" /></button>
          </div>
          <div className="tgroup mid">
            <button className="ib" title="Stop" onClick={() => { setPlaying(false); seek(0); }}><Icon name="stop" size={18} /></button>
            <button className="ib play" title="Play / Pause (Space)" onClick={() => { if (!playing && playhead >= dur) seek(0); setPlaying(!playing); }}><Icon name={playing ? 'pause' : 'play'} size={20} /></button>
            <span className="time">{fmt(playhead)} <i>/ {fmt(dur)}</i></span>
          </div>
          <div className="tgroup end">
            <button className="ib" title="Split at playhead (S)" onClick={splitClip}><Icon name="scissors" /></button>
            <button className="ib" title="Duplicate (Ctrl+D)" onClick={duplicate}><Icon name="copy" /></button>
            <button className="ib" title="Marker at playhead (M)" onClick={addMarker}><Icon name="flag" /></button>
            <button className="ib danger" title="Delete clip" disabled={!selected} onClick={() => removeClip(selected)}><Icon name="trash" /></button>
            <input className="zoomr" type="range" min="10" max="200" value={zoom} onChange={(e) => setZoom(+e.target.value)} title="Timeline zoom" />
          </div>
        </div>
      </section>
      <div className={`zr ${sheet === 'props' ? 'open' : ''}`}><button className="ib sheet-x" onClick={() => setSheet(null)}><Icon name="close" /></button><Props /></div>
      <footer className="timeline"><Timeline onAdd={(tb) => { setTab(tb); setSheet('left'); }} /></footer>
      {showExport && <ExportDialog project={p} onClose={() => setShowExport(false)} />}
      {sheet && <div className="backdrop" onClick={() => setSheet(null)} />}
      <nav className="nav">
        {TABS.map(([k, ic, l]) => <button key={k} className={sheet === 'left' && tab === k ? 'on' : ''} onClick={() => { setTab(k); setSheet(sheet === 'left' && tab === k ? null : 'left'); }}><Icon name={ic} size={21} /><span>{l}</span></button>)}
        <i className="navsep" />
        <button title="Split at playhead" onClick={splitClip}><Icon name="scissors" size={21} /><span>Split</span></button>
        <button title="Duplicate clip" disabled={!selected} onClick={duplicate}><Icon name="copy" size={21} /><span>Duplicate</span></button>
        <button title="Delete clip" className="danger" disabled={!selected} onClick={() => selected && removeClip(selected)}><Icon name="trash" size={21} /><span>Delete</span></button>
        <button className={`${sheet === 'props' ? 'on' : ''} ${selected ? 'dot' : ''}`} onClick={() => setSheet(sheet === 'props' ? null : 'props')}><Icon name="sliders" size={21} /><span>Edit</span></button>
      </nav>
    </div>
  );
}

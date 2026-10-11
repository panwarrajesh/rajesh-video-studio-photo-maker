import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { useEditor, totalDuration } from '../store/editor.js';
import { fileUrl } from '../services/api.js';
import { FILTERS } from '../filters/filters.js';
import { TRANSITIONS } from '../transitions/transitions.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- film strip: real frames from the video, drawn along the clip ----------
const strips = new Map(); let chain = Promise.resolve();
const seekTo = (v, t) => new Promise((ok) => { const done = () => { v.removeEventListener('seeked', done); ok(); }; v.addEventListener('seeked', done); setTimeout(done, 3000); v.currentTime = t; });
function buildStrip(url, e) {
  return new Promise((ok) => {
    const v = document.createElement('video');
    const fin = () => { e.subs.forEach((f) => f()); try { v.removeAttribute('src'); v.load(); } catch { /* ignore */ } ok(); };
    v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.onerror = () => { e.fail = true; fin(); };
    v.onloadeddata = async () => {
      try {
        const d = v.duration || 1, N = Math.max(4, Math.min(14, Math.ceil(d))), c = document.createElement('canvas'), g = c.getContext('2d'), frames = [];
        c.height = 96; c.width = Math.round(96 * ((v.videoWidth || 9) / (v.videoHeight || 16)));
        for (let i = 0; i < N; i++) { await seekTo(v, (d * (i + 0.5)) / N); g.drawImage(v, 0, 0, c.width, c.height); frames.push(c.toDataURL('image/jpeg', 0.5)); }
        e.frames = frames; e.dur = d;
      } catch { e.fail = true; }
      fin();
    };
    v.src = url;
  });
}
function useFilmstrip(url) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!url) return;
    let e = strips.get(url);
    if (!e) { e = { frames: null, fail: false, dur: 0, subs: new Set() }; strips.set(url, e); const en = e; chain = chain.then(() => buildStrip(url, en)); }
    const f = () => bump((n) => n + 1); e.subs.add(f); return () => e.subs.delete(f);
  }, [url]);
  return url ? strips.get(url) : null;
}
function Strip({ c, m, h, zoom }) {
  const url = m ? fileUrl(m.url) : null, e = useFilmstrip(c.track === 'VIDEO' ? url : null);
  if (c.track === 'IMAGE') return <div className="mstrip" style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundSize: 'auto 100%' }} />;
  const w = c.duration * zoom, tw = Math.max(h, w / 120), n = Math.ceil(w / tw), N = e?.frames?.length || 0, md = m?.duration || e?.dur || c.srcLen || 1;
  return <div className="mstrip">{N > 0 && Array.from({ length: n }, (_, i) => {
    const t = c.trimIn + (((i + 0.5) * tw) / w) * c.duration * c.speed;
    return <img key={i} alt="" draggable={false} src={e.frames[clamp(Math.floor((t / md) * N), 0, N - 1)]} style={{ width: tw, height: h }} />;
  })}</div>;
}
function TimeLabel() {
  const t = useEditor((s) => s.playhead), tot = useEditor((s) => totalDuration(s.clips));
  return <div className="mtime">{mmss(t)} <i>/ {mmss(tot)}</i></div>;
}

// ---------- the phone timeline: fixed centre playhead, the timeline scrolls under it ----------
export function MobileTimeline({ onAdd, onTrans, Wave }) {
  const clips = useEditor((s) => s.clips), media = useEditor((s) => s.media), tracks = useEditor((s) => s.tracks), zoom = useEditor((s) => s.zoom), selected = useEditor((s) => s.selected), markers = useEditor((s) => s.markers);
  const layer = useRef(), view = useRef(), ptr = useRef(new Map()), g = useRef(null);
  const total = totalDuration(clips), width = (total + 8) * zoom + 240;

  useEffect(() => { // move the layer without re-rendering React on every frame
    const apply = (t, z) => { if (layer.current) layer.current.style.transform = `translateX(${-t * z}px)`; };
    apply(useEditor.getState().playhead, zoom);
    return useEditor.subscribe((s, p) => { if (s.playhead !== p.playhead || s.zoom !== p.zoom) apply(s.playhead, s.zoom); });
  }, [zoom]);

  function down(e) {
    if (e.target.closest?.('[data-act]')) return;
    ptr.current.set(e.pointerId, e.clientX);
    if (ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; g.current = { type: 'pinch', d0: Math.abs(a - b) || 1, z0: useEditor.getState().zoom }; return; }
    const S = useEditor.getState(), el = e.target.closest?.('[data-clip]'), hd = e.target.closest?.('[data-handle]'), clip = el ? S.clips.find((c) => c.id === el.dataset.clip) : null;
    g.current = { type: hd && clip ? 'trim' : 'tap', x0: e.clientX, t0: S.playhead, clip, side: hd?.dataset.handle, moved: false, c0: clip && { ...clip }, timer: null };
    if (clip && !hd) g.current.timer = setTimeout(() => { if (g.current && !g.current.moved) { g.current.type = 'move'; navigator.vibrate?.(15); } }, 450); // long-press = move the clip
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function move(e) {
    if (ptr.current.has(e.pointerId)) ptr.current.set(e.pointerId, e.clientX);
    const q = g.current; if (!q) return;
    if (q.type === 'pinch') { if (ptr.current.size < 2) return; const [a, b] = [...ptr.current.values()]; useEditor.getState().setZoom(clamp((q.z0 * Math.abs(a - b)) / q.d0, 15, 300)); return; }
    const S = useEditor.getState(), dx = e.clientX - q.x0;
    if (Math.abs(dx) > 6) q.moved = true;
    if (q.type === 'trim') {
      const c = q.c0;
      if (q.side === 'L') S.trimLeft(c.id, S.snapPoint(c.id, c.start + dx / S.zoom, S.zoom, false)); else S.trimRight(c.id, S.snapPoint(c.id, c.start + c.duration + dx / S.zoom, S.zoom, false) - c.start);
    } else if (q.type === 'move') S.moveClip(q.c0.id, S.snapStart(q.c0.id, q.c0.start + dx / S.zoom, q.c0.duration, S.zoom, false));
    else if (q.moved) { clearTimeout(q.timer); q.type = 'scrub'; }
    if (q.type === 'scrub') { if (S.playing) S.setPlaying(false); S.seek(clamp(q.t0 - dx / S.zoom, 0, Math.max(0, totalDuration(S.clips)))); }
  }
  function up(e) {
    ptr.current.delete(e.pointerId);
    const q = g.current; if (!q) return;
    if (q.type === 'pinch') { if (!ptr.current.size) g.current = null; return; }
    clearTimeout(q.timer);
    if (!q.moved && q.type !== 'trim') useEditor.getState().select(q.clip ? q.clip.id : null);
    g.current = null;
  }

  // vertical layout
  const has = (t) => clips.some((c) => c.track === t);
  const rows = []; let y = 38;
  const add = (track, h, icon, label) => { rows.push({ track, h, icon, label, top: y }); y += h + 8; };
  add('VIDEO', 64);
  if (has('IMAGE')) add('IMAGE', 48, 'image');
  if (has('OVERLAY')) add('OVERLAY', 40, 'smile');
  if (has('EFFECTS')) add('EFFECTS', 40, 'sparkles');
  add('AUDIO', 46, 'music', 'Add audio'); add('TEXT', 46, 'type', 'Add text');
  const main = clips.filter((c) => c.track === 'VIDEO' || c.track === 'IMAGE').sort((a, b) => a.start - b.start);
  const mainEnd = Math.max(0, ...clips.filter((c) => c.track === 'VIDEO').map((c) => c.start + c.duration));
  const step = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 25 ? 5 : 10, secs = Math.ceil(total + 8);

  return (
    <div className="mtl" ref={view} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="mlayer" ref={layer} style={{ width }}>
        <div className="mruler">{Array.from({ length: secs + 1 }, (_, i) => (i % step === 0
          ? <span key={i} className="mtick" style={{ left: i * zoom }}>{mmss(i)}</span> : i % step === Math.round(step / 2) ? <i key={i} className="mdot" style={{ left: i * zoom }} /> : null))}
          {markers.map((m) => <b key={m} className="mmk" style={{ left: m * zoom }} />)}</div>
        {rows.map((r) => {
          const list = clips.filter((c) => c.track === r.track), hidden = tracks[r.track].hidden;
          return (
            <div key={r.track} className={`mrow ${hidden ? 'hid' : ''}`} style={{ top: r.top, height: r.h }}>
              {r.track === 'VIDEO'
                ? <button data-act className="mmute" title="Mute clip" onClick={() => useEditor.getState().toggleTrack('VIDEO', 'muted')}><Icon name={tracks.VIDEO.muted ? 'volumeoff' : 'volume'} size={20} /><span>{tracks.VIDEO.muted ? 'Unmute' : 'Mute clip'}</span></button>
                : <i className="mrowicon" style={{ top: (r.h - 40) / 2 }}><Icon name={r.icon} size={18} /></i>}
              {r.label && !list.length && <button data-act className="mbar" style={{ height: r.h, width: Math.max(total, 4) * zoom + 140 }} onClick={() => onAdd(r.track === 'AUDIO' ? 'audio' : 'text')}><Icon name="plus" size={16} /> {r.label}</button>}
              {list.map((c) => {
                const m = media.find((x) => x.id === c.mediaId), sel = selected === c.id;
                return (
                  <div key={c.id} data-clip={c.id} className={`mclip ${c.track} ${sel ? 'sel' : ''}`} style={{ left: c.start * zoom, width: c.duration * zoom, height: r.h }}>
                    {(c.track === 'VIDEO' || c.track === 'IMAGE') && <Strip c={c} m={m} h={r.h} zoom={zoom} />}
                    {c.track === 'AUDIO' && Wave && <Wave c={c} media={media} />}
                    {c.track !== 'VIDEO' && c.track !== 'IMAGE' && <span className="mlabel">{c.kind === 'text' ? c.props.text : c.kind === 'sticker' ? c.props.shape : c.kind === 'effect' ? c.props.effect : m?.name}</span>}
                    {sel && <><i data-handle="L" className="mh l" /><i data-handle="R" className="mh r" /></>}
                  </div>
                );
              })}
              {r.track === 'VIDEO' && <button data-act className="mplus" title="Add media" style={{ left: mainEnd * zoom + 10, height: r.h - 8, top: 4 }} onClick={() => onAdd('media')}><Icon name="plus" size={22} /></button>}
            </div>
          );
        })}
        {main.slice(1).map((c, i) => (Math.abs(c.start - (main[i].start + main[i].duration)) < 0.06
          ? <button key={c.id} data-act className="mtr" title="Transition" style={{ left: c.start * zoom - 12, top: 44, height: 52 }} onClick={() => onTrans(c.id)}><i /></button> : null))}
      </div>
      <div className="mphead" />
      <TimeLabel />
    </div>
  );
}

export function MobileTransport({ onFull }) {
  const { playing, past, future, undo, redo, snapOn, toggleSnap } = useEditor();
  const toggle = () => { const s = useEditor.getState(); if (!s.playing && s.playhead >= totalDuration(s.clips) - 0.05) s.seek(0); s.setPlaying(!s.playing); };
  return (
    <div className="mtransport">
      <div className="l"><button className="ib" title="Fullscreen" onClick={onFull}><Icon name="fullscreen" size={20} /></button></div>
      <button className="ib play" title="Play / Pause" onClick={toggle}><Icon name={playing ? 'pause' : 'play'} size={20} /></button>
      <div className="r"><button className={`ib ${snapOn ? 'on' : ''}`} title="Snapping" onClick={toggleSnap}><Icon name="magnet" size={20} /></button>
        <button className="ib" title="Undo" disabled={!past.length} onClick={undo}><Icon name="undo" size={20} /></button>
        <button className="ib" title="Redo" disabled={!future.length} onClick={redo}><Icon name="redo" size={20} /></button></div>
    </div>
  );
}

// ---------- bottom toolbar: main tools, or the clip tools once a clip is selected ----------
export function MobileToolbar({ mobile, openLeft, openProps, openMini }) {
  const { clips, selected, select, splitClip, duplicate, removeClip } = useEditor();
  if (!mobile) return null;
  const sel = clips.find((c) => c.id === selected), media = sel && (sel.track === 'VIDEO' || sel.track === 'AUDIO'), visual = sel && (sel.track === 'VIDEO' || sel.track === 'IMAGE');
  const target = () => { // the clip a tool applies to: the selected one, else the main clip under the playhead
    const s = useEditor.getState(), main = (x) => x.track === 'VIDEO' || x.track === 'IMAGE';
    const c = s.clips.find((x) => x.id === s.selected) || s.clips.find((x) => main(x) && s.playhead >= x.start && s.playhead < x.start + x.duration) || s.clips.find(main);
    if (c) select(c.id); else openLeft('media');
    return c;
  };
  const B = (ic, label, onClick, o = {}) => <button key={label} title={o.title || label} className={o.danger ? 'danger' : ''} onClick={onClick}><Icon name={ic} size={21} /><span>{label}</span></button>;
  return (
    <nav className="nav">{sel ? <>
      {B('back', 'Back', () => select(null))}<i className="navsep" />
      {B('scissors', 'Split', splitClip, { title: 'Split at playhead' })}
      {B('edit', 'Edit', openProps)}
      {media && B('speed', 'Speed', () => openMini('speed'))}
      {media && B('volume', 'Volume', () => openMini('volume'))}
      {(visual || sel.kind === 'text' || sel.kind === 'sticker') && B('wand', 'Animate', () => openMini('anim'))}
      {visual && B('filter', 'Filters', () => openMini('filter'))}
      {visual && B('sun', 'Adjust', () => openMini('adjust'))}
      {B('copy', 'Duplicate', duplicate, { title: 'Duplicate clip' })}
      {B('trash', 'Delete', () => removeClip(sel.id), { title: 'Delete clip', danger: true })}
    </> : <>
      {B('edit', 'Edit', target)}
      {B('music', 'Audio', () => openLeft('audio'))}{B('type', 'Text', () => openLeft('text'))}{B('sparkles', 'Effects', () => openLeft('effects'))}
      {B('image', 'Overlay', () => openLeft('overlay'))}{B('smile', 'Stickers', () => openLeft('stickers'))}
      {B('filter', 'Filters', () => { if (target()) openMini('filter'); })}{B('sun', 'Adjust', () => { if (target()) openMini('adjust'); })}
      {B('crop', 'Ratio', () => openMini('ratio'))}
    </>}</nav>
  );
}

// ---------- small bottom sheets for the quick tools ----------
const Rng = ({ label, value, min, max, step = 0.05, onChange, unit = '' }) => (
  <label className="prop"><span>{label}<em>{Math.round(value * 100) / 100}{unit}</em></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /></label>
);
const RATIOS = [['9:16', 1080, 1920], ['16:9', 1920, 1080], ['1:1', 1080, 1080], ['4:5', 1080, 1350]];
export function MiniSheet({ kind, onClose, project, onRatio }) {
  const { clips, selected, setSpeed, updateProps } = useEditor();
  const c = clips.find((x) => x.id === selected), p = c?.props || {}, set = (k) => (v) => c && updateProps(c.id, { [k]: v });
  const Chip = ({ on, onClick, children }) => <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>;
  const TITLES = { speed: 'Speed', volume: 'Volume', anim: 'Animation', filter: 'Filters', adjust: 'Adjust', trans: 'Transition', ratio: 'Aspect ratio' };
  if (kind !== 'ratio' && !c) return null;
  return (
    <div className="mini">
      <div className="minihead"><span>{TITLES[kind]}</span><button className="ib" title="Done" onClick={onClose}><Icon name="check" size={20} /></button></div>
      {kind === 'speed' && <div className="chiprow">{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((v) => <Chip key={v} on={c.speed === v} onClick={() => setSpeed(c.id, v)}>{v}x</Chip>)}</div>}
      {kind === 'volume' && <><Rng label="Volume" value={p.volume ?? 1} min={0} max={1} onChange={set('volume')} /><Rng label="Fade in" value={p.fadeIn ?? 0} min={0} max={5} step={0.1} unit="s" onChange={set('fadeIn')} />
        <Rng label="Fade out" value={p.fadeOut ?? 0} min={0} max={5} step={0.1} unit="s" onChange={set('fadeOut')} /><div className="chiprow"><Chip on={p.muted} onClick={() => set('muted')(!p.muted)}>{p.muted ? 'Muted' : 'Mute clip'}</Chip></div></>}
      {kind === 'anim' && <div className="chiprow">{['none', 'fade', 'slide', 'zoom', 'bounce', 'pop', 'blur', ...(c.kind === 'text' ? ['typewriter'] : [])].map((a) => <Chip key={a} on={(p.anim || 'none') === a} onClick={() => set('anim')(a)}>{a}</Chip>)}</div>}
      {kind === 'filter' && <><div className="chiprow">{Object.entries(FILTERS).map(([k, f]) => <Chip key={k} on={(p.filter || 'original') === k} onClick={() => set('filter')(k)}>{f.label}</Chip>)}</div>
        {(p.filter || 'original') !== 'original' && <Rng label="Intensity" value={p.filterAmt ?? 1} min={0} max={1} onChange={set('filterAmt')} />}</>}
      {kind === 'adjust' && <><Rng label="Brightness" value={p.br ?? 1} min={0.5} max={1.5} onChange={set('br')} /><Rng label="Contrast" value={p.ct ?? 1} min={0.5} max={1.5} onChange={set('ct')} /><Rng label="Saturation" value={p.sa ?? 1} min={0} max={2} onChange={set('sa')} /></>}
      {kind === 'trans' && <><div className="chiprow">{Object.entries(TRANSITIONS).map(([k, t]) => <Chip key={k} on={(p.trans || 'none') === k} onClick={() => set('trans')(k)}>{t.label}</Chip>)}</div>
        {(p.trans || 'none') !== 'none' && <Rng label="Length" value={p.transDur ?? 0.6} min={0.2} max={2} step={0.1} unit="s" onChange={set('transDur')} />}</>}
      {kind === 'ratio' && <div className="chiprow">{RATIOS.map(([l, w, h]) => <Chip key={l} on={Math.abs(project.width / project.height - w / h) < 0.02} onClick={() => onRatio(w, h)}>{l}</Chip>)}</div>}
    </div>
  );
}

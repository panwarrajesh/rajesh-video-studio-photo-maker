import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon, Logo } from '../components/Icon.jsx';
import { drawFrame, layout, total } from '../studio/render.js';
import { MOTIONS, FX, FILTERS, TRANS, TEXT_ANIMS, PARTICLES, BACKGROUNDS, TEXT_POS, FONTS, COUNTS } from '../studio/presets.js';

const SEC = { cinematic: 'photos', audio: 'audio', text: 'text', bg: 'bg', look: 'look' };
const RATIOS = { '9:16': [9, 16], '16:9': [16, 9], '1:1': [1, 1], '4:5': [4, 5] };
const dims = (ratio, long) => { const [a, b] = RATIOS[ratio], e = (x) => Math.max(2, Math.round(x / 2) * 2); return a >= b ? [e(long), e((long * b) / a)] : [e((long * a) / b), e(long)]; };
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const mIdx = (name) => Math.max(0, MOTIONS.findIndex((m) => m.name === name));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function loadCanvas(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = mkCanvas(Math.round(im.width * k), Math.round(im.height * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const t = mkCanvas(120, Math.round((120 * c.height) / c.width)); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      URL.revokeObjectURL(url); ok({ cv: c, thumb: t.toDataURL('image/jpeg', 0.6) });
    };
    im.onerror = () => bad(new Error('Could not read image')); im.src = url;
  });
}
function chroma(src, hex, sim) { // green-screen: make pixels close to the key colour transparent
  const c = mkCanvas(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), kr = parseInt(hex.slice(1, 3), 16), kg = parseInt(hex.slice(3, 5), 16), kb = parseInt(hex.slice(5, 7), 16), thr = sim * 441;
  for (let i = 0; i < d.data.length; i += 4) { const dist = Math.hypot(d.data[i] - kr, d.data[i + 1] - kg, d.data[i + 2] - kb); if (dist < thr) d.data[i + 3] = 0; else if (dist < thr * 1.35) d.data[i + 3] = ((dist - thr) / (thr * 0.35)) * 255; }
  g.putImageData(d, 0, 0); return c;
}
function detectBeats(buf) { // energy-onset beat detection
  const d = buf.getChannelData(0), sr = buf.sampleRate, hop = 1024, e = [];
  for (let i = 0; i + hop < d.length; i += hop) { let s = 0; for (let j = 0; j < hop; j += 4) s += d[i + j] * d[i + j]; e.push(s); }
  const w = Math.round((sr / hop) * 1), beats = []; let last = -1;
  for (let i = 1; i < e.length - 1; i++) {
    let a = 0, n = 0; for (let j = Math.max(0, i - w); j < Math.min(e.length, i + w); j++) { a += e[j]; n++; }
    const t = (i * hop) / sr;
    if (e[i] > (a / n) * 1.5 && e[i] >= e[i - 1] && e[i] >= e[i + 1] && t - last > 0.3) { beats.push(t); last = t; }
  }
  return beats;
}
function whoosh(c, when, dest, nodes) {
  const len = Math.floor(c.sampleRate * 0.6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(3000, when + 0.5);
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.35, when + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
  src.connect(f); f.connect(g); g.connect(dest); src.start(when); nodes.push(src);
}
async function saveBlob(blob, name) {
  if (window.Capacitor?.isNativePlatform?.()) { // phone app: write to cache and open the share sheet (Save / WhatsApp / Drive...)
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: name, url: uri });
  } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
}

const Sel = ({ label, value, onChange, items }) => (
  <label className="prop"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
);
const Rng = ({ label, value, min, max, step = 1, onChange, unit = '' }) => (
  <label className="prop"><span>{label}<em>{Math.round(value * 100) / 100}{unit}</em></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /></label>
);
const names = (a) => a.map((x, i) => [i, x.name || x]);

export default function Studio() {
  const [slides, setSlides] = useState([]); const [sel, setSel] = useState(0); const [ver, setVer] = useState(0);
  const [cfg, setCfg] = useState({ ratio: '9:16', dur: 3.5, bg: 'Blurred Photo', bgColor: '#101828', particles: 'Sparkles', pn: 40, fit: 'cover', cine: false, bright: 1, contrast: 1, sat: 1,
    font: FONTS[1][1], textSize: 0.065, textColor: '#ffffff', textBg: false, chroma: false, key: '#00ff00', keySim: 0.35, musicVol: 0.8, voiceVol: 1, fadeIn: 1, fadeOut: 2, sfx: true, beatFx: true, every: 2, quality: 720 });
  const [music, setMusic] = useState(null); const [voice, setVoice] = useState(null); const [recording, setRecording] = useState(false);
  const [t, setT] = useState(0); const [playing, setPlaying] = useState(false); const [exp, setExp] = useState(null); const [msg, setMsg] = useState('');
  const [params] = useSearchParams(); const tool = params.get('tool');
  const [open, setOpen] = useState(() => new Set(['photos', 'slide', SEC[tool]].filter(Boolean)));
  const tg = (k) => (e) => setOpen((s) => { const n = new Set(s); if (e.target.open) n.add(k); else n.delete(k); return n; });
  useEffect(() => { if (SEC[tool]) setTimeout(() => document.getElementById(`sec-${SEC[tool]}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 300); }, [tool]);
  const origs = useRef({}), imgs = useRef({}), bgVideo = useRef(null), cv = useRef(), raf = useRef(0), rec = useRef(null), A = useRef({ ctx: null, nodes: [] });
  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));
  const cur = slides[sel], tot = useMemo(() => total(layout(slides)), [slides]);
  const up = (p) => setSlides((s) => s.map((x, i) => (i === sel ? { ...x, ...p } : x)));
  const [PW, PH] = dims(cfg.ratio, 640);

  useEffect(() => { document.fonts?.load?.('700 40px "Noto Sans Devanagari"'); document.fonts?.load?.('800 40px Manrope'); return () => stop(); }, []); // eslint-disable-line
  useEffect(() => { // green screen toggle / settings
    Object.keys(origs.current).forEach((id) => { imgs.current[id] = cfg.chroma ? chroma(origs.current[id], cfg.key, cfg.keySim) : origs.current[id]; }); setVer((v) => v + 1);
  }, [cfg.chroma, cfg.key, cfg.keySim]);

  const buildState = useCallback((W, H) => ({
    W, H, slides: layout(slides), imgs: imgs.current, bg: { type: cfg.bg, color: cfg.bgColor, video: bgVideo.current }, particles: { type: cfg.particles, n: cfg.pn }, fit: cfg.fit, cine: cfg.cine,
    adjust: cfg.bright === 1 && cfg.contrast === 1 && cfg.sat === 1 ? '' : `brightness(${cfg.bright}) contrast(${cfg.contrast}) saturate(${cfg.sat})`,
    beats: music?.beats || [], beatFx: cfg.beatFx, text: { font: cfg.font, size: cfg.textSize, color: cfg.textColor, bg: cfg.textBg }, mk: mkCanvas,
  }), [slides, cfg, music, ver]); // eslint-disable-line
  useEffect(() => { const c = cv.current; if (c) drawFrame(c.getContext('2d'), buildState(PW, PH), t); }, [t, buildState, PW, PH]);

  // ---- audio
  const actx = () => (A.current.ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function schedule(t0, dest) {
    const c = actx(), now = c.currentTime + 0.05, nodes = [];
    const play = (buf, vol, fi, fo) => {
      const src = c.createBufferSource(), g = c.createGain(); src.buffer = buf;
      g.gain.setValueAtTime(fi > 0 && t0 < fi ? vol * (t0 / fi) : vol, now);
      if (fi > 0 && t0 < fi) g.gain.linearRampToValueAtTime(vol, now + (fi - t0));
      if (fo > 0 && tot - fo > t0) { g.gain.setValueAtTime(vol, now + (tot - fo - t0)); g.gain.linearRampToValueAtTime(0, now + (tot - t0)); }
      src.connect(g); g.connect(dest); src.start(now, t0); src.stop(now + Math.max(0.1, tot - t0)); nodes.push(src);
    };
    if (music) play(music.buf, cfg.musicVol, cfg.fadeIn, cfg.fadeOut);
    if (voice) play(voice.buf, cfg.voiceVol, 0, 0);
    if (cfg.sfx) layout(slides).forEach((s, i) => { if (i && s.start >= t0) whoosh(c, now + s.start - t0, dest, nodes); });
    return nodes;
  }
  function stopAudio() { A.current.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); A.current.nodes = []; }
  function stop() { cancelAnimationFrame(raf.current); stopAudio(); bgVideo.current?.pause?.(); setPlaying(false); }
  async function play() {
    if (!slides.length) return;
    const c = actx(); await c.resume(); stopAudio();
    const start = t >= tot - 0.05 ? 0 : t; A.current.nodes = schedule(start, c.destination); bgVideo.current?.play?.().catch(() => {});
    const wall = performance.now(); setPlaying(true);
    const loop = () => { const el = start + (performance.now() - wall) / 1000; if (el >= tot) { setT(tot - 0.001); stop(); return; } setT(el); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
  }

  // ---- media
  async function addFiles(files) {
    const fresh = []; setMsg('');
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try { const { cv: c, thumb } = await loadCanvas(f), id = crypto.randomUUID(); origs.current[id] = c; imgs.current[id] = cfg.chroma ? chroma(c, cfg.key, cfg.keySim) : c;
        fresh.push({ id, name: f.name, thumb, dur: cfg.dur, motion: mIdx('Ken Burns · Normal'), fx: 'None', trans: 0, transDur: 0.7, filter: 0, text: '', anim: 'Pop', pos: 'Bottom' }); }
      catch (e) { setMsg(`${f.name}: ${e.message}`); }
    }
    setSlides((s) => [...s, ...fresh]); setVer((v) => v + 1);
  }
  async function loadAudio(file, set2, withBeats) {
    try { const buf = await actx().decodeAudioData(await file.arrayBuffer()); set2({ buf, name: file.name, beats: withBeats ? detectBeats(buf) : [] }); setMsg(''); }
    catch { setMsg('This audio file could not be decoded. Try MP3, WAV or M4A.'); }
  }
  async function toggleRec() {
    if (rec.current) { rec.current.stop(); return; }
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true }), mr = new MediaRecorder(ms), ch = [];
      mr.ondataavailable = (e) => ch.push(e.data);
      mr.onstop = async () => { ms.getTracks().forEach((x) => x.stop()); rec.current = null; setRecording(false); try { setVoice({ buf: await actx().decodeAudioData(await new Blob(ch).arrayBuffer()), name: 'Voice-over' }); } catch { setMsg('Recording failed.'); } };
      mr.start(); rec.current = mr; setRecording(true);
    } catch { setMsg('Microphone not available. Allow microphone permission (needs HTTPS or localhost), or upload a voice file instead.'); }
  }
  function syncBeats() {
    const b = music?.beats || []; if (b.length < slides.length) return setMsg('Not enough beats found in this music for all slides.');
    const marks = [0, ...b.filter((_, i) => i % cfg.every === cfg.every - 1)];
    setSlides((s) => s.map((x, i) => ({ ...x, dur: Math.max(0.8, +(((marks[i + 1] ?? marks[i] + 3) - marks[i]) || 3).toFixed(2)) })));
  }
  function autoCinematic() {
    const mo = ['Ken Burns · Normal', 'Push In · Normal', 'Pan Left · Soft', 'Zoom Out · Normal', 'Pan Right · Soft', 'Dolly · Normal', 'Drift · Normal'].map(mIdx), fx = ['Vignette', 'Light Leak', 'Film Grain', 'Glow', 'Film Burn'], tr = [0, 5, 7, 9, 10, 1];
    setSlides((s) => s.map((x, i) => ({ ...x, motion: mo[i % mo.length], trans: tr[i % tr.length], fx: fx[i % fx.length], filter: FILTERS.findIndex((f) => f.name === 'Cinematic'), dur: x.dur < 2.5 ? 3.5 : x.dur })));
    setCfg((c) => ({ ...c, cine: true, particles: 'Bokeh', pn: 30, bg: 'Blurred Photo', beatFx: true })); setMsg('Auto Cinematic applied. Add music and press "Sync slides to beats" for a beat-matched edit.');
  }
  const applyAll = () => cur && setSlides((s) => s.map((x) => ({ ...x, motion: cur.motion, fx: cur.fx, trans: cur.trans, transDur: cur.transDur, filter: cur.filter, anim: cur.anim, pos: cur.pos })));

  // ---- export (rendered in the browser, so it looks exactly like the preview)
  async function doExport() {
    if (!slides.length) return; stop(); setMsg('');
    if (!window.MediaRecorder) return setMsg('This browser cannot record video. Use Chrome or Edge.');
    const [W, H] = dims(cfg.ratio, cfg.quality === 1080 ? 1920 : cfg.quality === 720 ? 1280 : 854), canvas = mkCanvas(W, H), ctx = canvas.getContext('2d'), c = actx();
    await c.resume(); const dest = c.createMediaStreamDestination(), stream = canvas.captureStream(30);
    dest.stream.getAudioTracks().forEach((x) => stream.addTrack(x));
    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(W * H * 5) }), chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => { mr.onstop = r; }), st = buildState(W, H);
    setExp({ pct: 0, busy: true }); bgVideo.current?.play?.().catch(() => {}); mr.start(250);
    const nodes = schedule(0, dest), t0 = performance.now();
    await new Promise((ok) => { const loop = () => { const el = (performance.now() - t0) / 1000; drawFrame(ctx, st, Math.min(el, tot)); setExp({ pct: Math.min(99, Math.round((el / tot) * 100)), busy: true }); if (el < tot) requestAnimationFrame(loop); else ok(); }; loop(); });
    nodes.forEach((n) => { try { n.stop(); } catch { /* done */ } }); bgVideo.current?.pause?.(); mr.stop(); await done;
    const blob = new Blob(chunks, { type: mime.split(';')[0] }), name = `RVS-video-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
    setExp({ pct: 100, busy: false, blob, name });
  }

  return (
    <div className="studio">
      <header className="top"><Link className="ib" to="/" title="Back"><Icon name="back" /></Link><Logo /><b className="pname">Photo Video Maker</b><span className="grow" />
        <button className="btn primary" onClick={doExport} disabled={!slides.length || exp?.busy}><Icon name="download" size={16} /> {exp?.busy ? `${exp.pct}%` : 'Export video'}</button></header>
      <div className="stwrap">
        <section className="stprev">
          <canvas ref={cv} width={PW} height={PH} className="stcanvas" />
          <div className="transport">
            <button className="ib play" onClick={() => (playing ? stop() : play())} disabled={!slides.length}><Icon name={playing ? 'pause' : 'play'} size={20} /></button>
            <input type="range" min="0" max={Math.max(tot, 0.1)} step="0.01" value={Math.min(t, tot)} onChange={(e) => { if (playing) stop(); setT(+e.target.value); }} />
            <span className="time">{fmt(t)} <i>/ {fmt(tot)}</i></span>
          </div>
          {exp && !exp.busy && exp.blob && <div className="exportdone"><b>Video ready ({(exp.blob.size / 1e6).toFixed(1)} MB)</b><button className="btn primary" onClick={() => saveBlob(exp.blob, exp.name)}>{window.Capacitor?.isNativePlatform?.() ? 'Save / Share' : 'Download'}</button></div>}
          {exp?.busy && <div className="bar"><i style={{ width: `${exp.pct}%` }} /></div>}
          {msg && <p className="err">{msg}</p>}
        </section>
        <section className="stctl">
          <details id="sec-photos" open={open.has('photos')} onToggle={tg('photos')}><summary>1. Photos</summary>
            <label className="btn primary block"><Icon name="plus" size={16} /> Add photos<input hidden multiple type="file" accept="image/*" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} /></label>
            {!slides.length && <small className="muted">Add 2 or more photos, then press Auto Cinematic.</small>}
            <div className="strip">{slides.map((s, i) => <button key={s.id} className={`thumbb ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}><img src={s.thumb} alt="" /><em>{i + 1}</em></button>)}</div>
            <div className="row"><button className="btn sm" disabled={!cur || sel === 0} onClick={() => { setSlides((s) => { const a = [...s]; [a[sel - 1], a[sel]] = [a[sel], a[sel - 1]]; return a; }); setSel(sel - 1); }}>← Move</button>
              <button className="btn sm" disabled={!cur || sel >= slides.length - 1} onClick={() => { setSlides((s) => { const a = [...s]; [a[sel + 1], a[sel]] = [a[sel], a[sel + 1]]; return a; }); setSel(sel + 1); }}>Move →</button>
              <button className="btn sm danger" disabled={!cur} onClick={() => { setSlides((s) => s.filter((_, i) => i !== sel)); setSel(Math.max(0, sel - 1)); }}>Remove</button></div>
            <Rng label="Default time per photo" value={cfg.dur} min={1} max={10} step={0.5} unit="s" onChange={set('dur')} />
            <button className="btn primary block" disabled={!slides.length} onClick={autoCinematic}><Icon name="sparkles" size={16} /> Auto Cinematic video</button>
          </details>
          {cur && <details id="sec-slide" open={open.has('slide')} onToggle={tg('slide')}><summary>2. Selected photo ({sel + 1})</summary>
            <Rng label="Duration" value={cur.dur} min={0.8} max={12} step={0.1} unit="s" onChange={(v) => up({ dur: v })} />
            <Sel label={`Motion (${COUNTS.motions})`} value={cur.motion} onChange={(v) => up({ motion: +v })} items={names(MOTIONS)} />
            <Sel label={`Effect (${COUNTS.fx})`} value={cur.fx} onChange={(v) => up({ fx: v })} items={FX.map((x) => [x, x])} />
            <Sel label={`Transition in (${COUNTS.transitions})`} value={cur.trans} onChange={(v) => up({ trans: +v })} items={names(TRANS)} />
            <Rng label="Transition length" value={cur.transDur} min={0.2} max={1.5} step={0.1} unit="s" onChange={(v) => up({ transDur: v })} />
            <Sel label={`Filter (${COUNTS.filters})`} value={cur.filter} onChange={(v) => up({ filter: +v })} items={names(FILTERS)} />
            <textarea rows={2} placeholder="Text on this photo (Hindi / English) …" value={cur.text} onChange={(e) => up({ text: e.target.value })} />
            <Sel label={`Text animation (${COUNTS.textAnims})`} value={cur.anim} onChange={(v) => up({ anim: v })} items={TEXT_ANIMS.map((x) => [x, x])} />
            <Sel label="Text position" value={cur.pos} onChange={(v) => up({ pos: v })} items={TEXT_POS.map((x) => [x, x])} />
            <button className="btn sm" onClick={applyAll}>Apply this look to all photos</button>
          </details>}
          <details id="sec-text" open={open.has('text')} onToggle={tg('text')}><summary>3. Text style</summary>
            <Sel label="Font" value={cfg.font} onChange={set('font')} items={FONTS.map(([n, v]) => [v, n])} />
            <Rng label="Size" value={cfg.textSize} min={0.03} max={0.14} step={0.005} onChange={set('textSize')} />
            <div className="row"><label className="muted">Color <input type="color" value={cfg.textColor} onChange={(e) => set('textColor')(e.target.value)} /></label>
              <button className={`btn sm ${cfg.textBg ? 'primary' : ''}`} onClick={() => set('textBg')(!cfg.textBg)}>Background box</button></div>
          </details>
          <details id="sec-bg" open={open.has('bg')} onToggle={tg('bg')}><summary>4. Background, particles, green screen</summary>
            <Sel label={`Background (${COUNTS.backgrounds})`} value={cfg.bg} onChange={set('bg')} items={BACKGROUNDS.map((x) => [x, x])} />
            {cfg.bg === 'Solid Color' && <input type="color" value={cfg.bgColor} onChange={(e) => set('bgColor')(e.target.value)} />}
            {cfg.bg === 'Uploaded Video' && <label className="btn sm">Choose background video<input hidden type="file" accept="video/*" onChange={(e) => { const f = e.target.files[0]; if (!f) return; const v = document.createElement('video'); v.src = URL.createObjectURL(f); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.onloadeddata = () => setVer((x) => x + 1); bgVideo.current = v; setVer((x) => x + 1); }} /></label>}
            <Sel label={`Particles (${COUNTS.particles})`} value={cfg.particles} onChange={set('particles')} items={PARTICLES.map((x) => [x, x])} />
            <Rng label="Particle amount" value={cfg.pn} min={5} max={120} onChange={set('pn')} />
            <Sel label="Photo fit" value={cfg.fit} onChange={set('fit')} items={[['cover', 'Fill screen'], ['contain', 'Show whole photo (background visible)']]} />
            <div className="row"><button className={`btn sm ${cfg.chroma ? 'primary' : ''}`} onClick={() => set('chroma')(!cfg.chroma)}>Green screen {cfg.chroma ? 'ON' : 'OFF'}</button><input type="color" value={cfg.key} onChange={(e) => set('key')(e.target.value)} /></div>
            {cfg.chroma && <Rng label="Key similarity" value={cfg.keySim} min={0.1} max={0.7} step={0.01} onChange={set('keySim')} />}
            <small className="muted">Green screen removes the chosen colour from photos (use "Show whole photo") so the background shows behind.</small>
          </details>
          <details id="sec-look" open={open.has('look')} onToggle={tg('look')}><summary>5. Look</summary>
            <Sel label="Video size" value={cfg.ratio} onChange={set('ratio')} items={[['9:16', '9:16 Reels / Shorts / TikTok'], ['16:9', '16:9 YouTube'], ['1:1', '1:1 Instagram post'], ['4:5', '4:5 Instagram portrait']]} />
            <button className={`btn sm ${cfg.cine ? 'primary' : ''}`} onClick={() => set('cine')(!cfg.cine)}>Cinematic bars + grain {cfg.cine ? 'ON' : 'OFF'}</button>
            <Rng label="Brightness" value={cfg.bright} min={0.5} max={1.6} step={0.05} onChange={set('bright')} />
            <Rng label="Contrast" value={cfg.contrast} min={0.5} max={1.8} step={0.05} onChange={set('contrast')} />
            <Rng label="Saturation" value={cfg.sat} min={0} max={2} step={0.05} onChange={set('sat')} />
          </details>
          <details id="sec-audio" open={open.has('audio')} onToggle={tg('audio')}><summary>6. Audio & beat sync</summary>
            <label className="btn sm"><Icon name="plus" size={14} /> Music (MP3 / WAV / M4A)<input hidden type="file" accept="audio/*" onChange={(e) => e.target.files[0] && loadAudio(e.target.files[0], setMusic, true)} /></label>
            {music && <small className="muted">{music.name} · {music.beats.length} beats found <button className="btn sm danger" onClick={() => setMusic(null)}>remove</button></small>}
            <Rng label="Music volume" value={cfg.musicVol} min={0} max={1} step={0.05} onChange={set('musicVol')} />
            <Rng label="Fade in" value={cfg.fadeIn} min={0} max={5} step={0.5} unit="s" onChange={set('fadeIn')} />
            <Rng label="Fade out" value={cfg.fadeOut} min={0} max={6} step={0.5} unit="s" onChange={set('fadeOut')} />
            <div className="row"><Sel label="Change photo every" value={cfg.every} onChange={(v) => set('every')(+v)} items={[[1, '1 beat'], [2, '2 beats'], [4, '4 beats'], [8, '8 beats']]} />
              <button className="btn sm primary" disabled={!music || !slides.length} onClick={syncBeats}>Sync slides to beats</button></div>
            <button className={`btn sm ${cfg.beatFx ? 'primary' : ''}`} onClick={() => set('beatFx')(!cfg.beatFx)}>Beat-reactive effects {cfg.beatFx ? 'ON' : 'OFF'}</button>
            <div className="row"><button className={`btn sm ${recording ? 'danger' : ''}`} onClick={toggleRec}>{recording ? '■ Stop recording' : '● Record voice-over'}</button>
              <label className="btn sm">Upload voice<input hidden type="file" accept="audio/*" onChange={(e) => e.target.files[0] && loadAudio(e.target.files[0], setVoice, false)} /></label></div>
            {voice && <small className="muted">{voice.name} <button className="btn sm danger" onClick={() => setVoice(null)}>remove</button></small>}
            <Rng label="Voice volume" value={cfg.voiceVol} min={0} max={1.5} step={0.05} onChange={set('voiceVol')} />
            <button className={`btn sm ${cfg.sfx ? 'primary' : ''}`} onClick={() => set('sfx')(!cfg.sfx)}>Whoosh sound on transitions {cfg.sfx ? 'ON' : 'OFF'}</button>
          </details>
          <details id="sec-export" open={open.has('export')} onToggle={tg('export')}><summary>7. Export</summary>
            <Sel label="Quality" value={cfg.quality} onChange={(v) => set('quality')(+v)} items={[[480, '480p (fast)'], [720, '720p'], [1080, '1080p (slow on phones)']]} />
            <small className="muted">Export plays the video in real time while recording it, so keep this screen open until it finishes. Needs Chrome / Edge / Android app.</small>
          </details>
        </section>
      </div>
    </div>
  );
}

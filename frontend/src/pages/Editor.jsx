import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { api, upload, fileUrl } from '../services/api.js';
import { useEditor, totalDuration, TEXT_DEFAULTS, evalProp, evalProps, kfTimes, DEFAULT_TRACKS } from '../store/editor.js';
import { useShortcuts } from '../hooks/useShortcuts.js';
import ExportDialog from '../features/ExportDialog.jsx';
import AutoCaptions from '../features/AutoCaptions.jsx';
import EditorBeatMaker from '../features/EditorBeatMaker.jsx';
import EditorVoiceover from '../features/EditorVoiceover.jsx';
import EditorAiStudio from '../features/EditorAiStudio.jsx';
import EditorLooks from '../features/EditorLooks.jsx';
import EditorStickers, { PRO_STICKERS } from '../features/EditorStickers.jsx';
import EditorEffectsPanel from '../features/EditorEffectsPanel.jsx';
import EditorAudioFx from '../features/EditorAudioFx.jsx';
import EditorTemplates from '../features/EditorTemplates.jsx';
import { useAutosave } from '../hooks/useAutosave.js';
import { Icon, Logo } from '../components/Icon.jsx';
import { MobileTimeline, MobileTransport, MobileToolbar, MiniSheet } from '../editor/Mobile.jsx';
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
  if (!clip) {
    if (!el.paused) el.pause();
    return;
  }
  const inRange = t >= clip.start && t < clip.start + clip.duration;
  if (!inRange) {
    if (!el.paused) el.pause();
    return;
  }

  const q = evalProps(clip, t);
  const fade = Math.min(1, q.fadeIn > 0 ? (t - clip.start) / q.fadeIn : 1, q.fadeOut > 0 ? (clip.start + clip.duration - t) / q.fadeOut : 1);
  const targetVol = q.muted || muted ? 0 : Math.max(0, Math.min(1, q.volume * fade));
  if (Math.abs(el.volume - targetVol) > 0.05) el.volume = targetVol;
  if (el.playbackRate !== clip.speed) el.playbackRate = clip.speed;

  const want = clip.trimIn + (t - clip.start) * clip.speed;
  if (!playing) {
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - want) > 0.08) {
      try { el.currentTime = want; } catch {}
    }
  } else {
    // While playing: let playback run naturally. Only correct if drift exceeds 0.6s
    if (Math.abs(el.currentTime - want) > 0.6) {
      try { el.currentTime = want; } catch {}
    }
    if (el.paused) {
      try { el.currentTime = want; } catch {}
      el.play().catch(() => {});
    }
  }
}

function MediaPanel({ projectId, setErr, onAdded, only }) {
  const { media, setMedia, addClip, removeByMedia } = useEditor();
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  async function send(files) {
    files = [...files].filter((f) => /^(image|video|audio)\//.test(f.type) || /\.(mp4|webm|mov|mp3|wav|png|jpg|jpeg|webp)$/i.test(f.name));
    if (!files.length) return;
    setBusy(true); setErr('');
    for (const f of files) {
      const d = await getDuration(f);
      const m = {
        id: `loc-m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId,
        name: f.name,
        type: f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : 'audio',
        url: URL.createObjectURL(f),
        duration: d || (f.type.startsWith('image/') ? 5 : 5),
        size: f.size
      };
      const updatedMedia = [m, ...useEditor.getState().media];
      setMedia(updatedMedia);
      try { localStorage.setItem(`rvs_media_${projectId}`, JSON.stringify(updatedMedia)); } catch {}
      // AUTOMATICALLY add clip straight to timeline instantly!
      addClip(m);
      onAdded?.();
    }
    setBusy(false);
  }
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { setErr(e.message); } };
  const list = media.filter((m) => (!only || m.type === only) && m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="tabbody" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); send([...e.dataTransfer.files]); }}>
      <button
        type="button"
        className="btn primary"
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: '13px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: 'none',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
        }}
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
      >
        <span>📸 {busy ? 'Uploading & Adding to Video…' : '+ 1-Tap Pick Photo / Video from Phone'}</span>
      </button>
      <input
        ref={fileInputRef}
        hidden
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        onChange={(e) => { send([...e.target.files]); e.target.value = ''; }}
      />
      <input placeholder="Search added media…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: '8px' }} />
      <div className="medialist">{list.map((m) => (
        <div key={m.id} className="mitem"><b title={m.name}>{m.name}</b>
          <small className="muted">{m.type} · {size(m.size)}{m.duration ? ` · ${m.duration.toFixed(1)}s` : ''}</small>
          <div className="row">
            <button className="btn sm" onClick={() => { addClip(m); onAdded?.(); }}>Add to track</button>
            <button className="btn sm" onClick={wrap(async () => { const n = prompt('Rename', m.name); if (n) { const u = await api(`/media/${m.id}`, { method: 'PUT', body: { name: n } }); setMedia(media.map((x) => (x.id === m.id ? u : x))); } })}>Rename</button>
            <button className="btn sm danger" onClick={wrap(async () => { if (!confirm('Delete this media?')) return; await api(`/media/${m.id}`, { method: 'DELETE' }); removeByMedia(m.id); setMedia(media.filter((x) => x.id !== m.id)); })}>Delete</button>
          </div></div>))}
        {!list.length && <small className="muted">Tap green button above to pick photos or videos from phone.</small>}</div>
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
const FONTS = [
  ['Poppins (Modern Hindi & English)', 'Poppins, sans-serif'],
  ['Mukta (Clean Hindi Sans)', 'Mukta, sans-serif'],
  ['Noto Sans Devanagari (Hindi Bold)', '"Noto Sans Devanagari", sans-serif'],
  ['Yatra One (Royal Hindi Calligraphy)', '"Yatra One", cursive'],
  ['Rozha One (Royal Wedding / Headline)', '"Rozha One", serif'],
  ['Tiro Devanagari (Classic Hindi)', '"Tiro Devanagari Hindi", serif'],
  ['Anton (Viral Shorts & Reels)', 'Anton, sans-serif'],
  ['Bebas Neue (Cinematic Title)', '"Bebas Neue", sans-serif'],
  ['Cinzel (Epic Luxury / Gold)', 'Cinzel, serif'],
  ['Playfair Display (Fashion / Elegant)', '"Playfair Display", serif'],
  ['Caveat (Handwriting & Shayari)', 'Caveat, cursive'],
  ['Inter (Clean Tech)', 'Inter, system-ui, sans-serif'],
  ['Impact (Meme Bold)', 'Impact, sans-serif'],
];
const Shape = ({ shape, color }) => <svg viewBox="0 0 100 100" width="100%" height="100%"><path d={SHAPES[shape]} fill={color} /></svg>;
const bounce = (u) => 1 - Math.abs(Math.cos(u * 3 * Math.PI)) * (1 - u);

function animFx(kind, u) {
  const f = { o: 1, x: 0, y: 0, s: 1, blur: 0 };
  if (u >= 1) return f;
  if (kind === 'fade') f.o = u;
  if (kind === 'slide') { f.x = (1 - u) * -60; f.o = u; }
  if (kind === 'slideRight') { f.x = (1 - u) * 60; f.o = u; }
  if (kind === 'zoom') { f.s = 0.3 + 0.7 * u; f.o = u; }
  if (kind === 'bounce') f.y = (1 - bounce(u)) * -80;
  if (kind === 'pop') f.s = u < 0.6 ? (u / 0.6) * 1.25 : 1.25 - 0.25 * ((u - 0.6) / 0.4);
  if (kind === 'blur') { f.blur = (1 - u) * 16; f.o = u; }
  if (kind === 'drop') { f.y = (1 - u) * -100; f.o = Math.min(1, u * 2); f.s = u < 0.8 ? 1.08 : 1; }
  if (kind === 'pulse') { f.s = 1 + Math.sin(u * Math.PI * 4) * 0.08; }
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

function buildTextShadow(p) {
  const shadows = [];
  if (p.glow > 0) {
    const col = p.glowColor || '#00f0ff';
    shadows.push(`0 0 ${p.glow}px ${col}`, `0 0 ${p.glow * 2}px ${col}`);
  }
  if (p.stylePreset === 'neon') {
    const col = p.glowColor || '#00f0ff';
    shadows.push('0 0 5px #ffffff', `0 0 12px ${col}`, `0 0 25px ${col}`, `0 0 40px ${col}`);
  } else if (p.stylePreset === '3d') {
    shadows.push('2px 2px 0px #000', '4px 4px 0px #1c1917', '6px 6px 0px #292524', '8px 8px 12px rgba(0,0,0,0.85)');
  } else if (p.stylePreset === 'glitch') {
    shadows.push('-3px 0 #ff0055', '3px 0 #00ffff', '0 2px 8px rgba(0,0,0,0.8)');
  } else if (p.stylePreset === 'gold') {
    shadows.push('0 2px 4px rgba(0,0,0,0.8)', '0 0 14px rgba(255,215,0,0.6)');
  } else if (p.stylePreset === 'fire') {
    shadows.push('0 0 8px #ff4500', '0 0 16px #ff8c00', '0 0 28px #ffd700');
  } else if (p.shadow) {
    shadows.push('0 2px 8px rgba(0,0,0,0.85)');
  }
  return shadows.length ? shadows.join(', ') : 'none';
}

function Layer({ c, t, isSelected, onSelect }) {
  const p = evalProps(c, t), st = { ...vstyle(c, t, true), left: `${50 + p.x / 2}%`, top: `${50 + p.y / 2}%` };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect?.(c.id);
    const startX = e.clientX, startY = e.clientY;
    const origX = p.x || 0, origY = p.y || 0;
    const stage = e.currentTarget.closest('.stage');
    const stageWidth = stage ? stage.clientWidth : 300;
    const stageHeight = stage ? stage.clientHeight : 500;

    const onPointerMove = (ev) => {
      const dx = ((ev.clientX - startX) / stageWidth) * 200;
      const dy = ((ev.clientY - startY) / stageHeight) * 200;
      useEditor.getState().updateProps(c.id, { x: Math.round(origX + dx), y: Math.round(origY + dy) });
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (c.kind === 'sticker') {
    const sData = p.stickerData || PRO_STICKERS.find((x) => x.id === p.shape || x.id === c.stickerId || x.id === p.stickerId);
    if (sData?.type === 'badge') {
      return (
        <div
          className={`ovl ${isSelected ? 'ovl-selected' : ''}`}
          style={{
            ...st,
            pointerEvents: 'auto',
            cursor: 'grab',
            touchAction: 'none',
            background: sData.bg,
            color: sData.color,
            border: sData.border,
            borderRadius: sData.borderRadius || '16px',
            padding: sData.padding || '6px 14px',
            fontSize: `${p.fontSize || 3.8}cqw`,
            fontWeight: sData.fontWeight || '800',
            boxShadow: sData.boxShadow,
            whiteSpace: 'nowrap',
          }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(c.id); }}
          onPointerDown={handlePointerDown}
        >
          {sData.content || p.label || '⭐ STICKER'}
        </div>
      );
    } else if (sData?.type === 'svg') {
      return (
        <div
          className={`ovl ${isSelected ? 'ovl-selected' : ''}`}
          style={{ ...st, width: '22cqw', height: '22cqw', pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(c.id); }}
          onPointerDown={handlePointerDown}
        >
          <svg viewBox={sData.viewBox || '0 0 100 100'} width="100%" height="100%" style={{ filter: sData.filter }}>
            <path d={sData.path} fill={sData.fill || p.color || 'none'} stroke={sData.stroke} strokeWidth={sData.strokeWidth} />
          </svg>
        </div>
      );
    }
    return (
      <div
        className={`ovl ${isSelected ? 'ovl-selected' : ''}`}
        style={{ ...st, width: '20cqw', height: '20cqw', pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(c.id); }}
        onPointerDown={handlePointerDown}
      >
        <Shape shape={p.shape || 'star'} color={p.color || '#ffb020'} />
      </div>
    );
  }
  const n = (p.text || '').length;
  const text = p.anim === 'typewriter'
    ? p.text.slice(0, Math.ceil(n * Math.min(1, (t - c.start) / Math.max(0.3, n * 0.06))))
    : (p.text ?? '');

  const textShadow = buildTextShadow(p);
  const isHook = p.stylePreset === 'hook';
  const isSubtitle = p.stylePreset === 'subtitles';
  const isNews = p.stylePreset === 'news';
  const isGold = p.stylePreset === 'gold';

  let bg = p.bg || 'transparent';
  let color = p.color || '#ffffff';
  let padding = p.bg ? (p.bgPadding || '0.2em 0.5em') : 0;
  let borderRadius = p.bg ? `${p.bgRadius ?? 8}px` : 0;
  let borderLeft = undefined;
  let bgClip = undefined;
  let textFillColor = undefined;
  let bgImage = undefined;

  if (isHook) {
    bg = '#ffe600';
    color = '#000000';
    padding = '0.25em 0.65em';
    borderRadius = '10px';
  } else if (isSubtitle) {
    bg = 'rgba(10, 15, 25, 0.85)';
    padding = '0.3em 0.8em';
    borderRadius = '8px';
  } else if (isNews) {
    bg = 'linear-gradient(90deg, #dc2626, #991b1b)';
    padding = '0.25em 0.8em';
    borderLeft = '5px solid #facc15';
    borderRadius = '4px';
  }

  if (isGold) {
    bgImage = 'linear-gradient(135deg, #fff7b2 0%, #ffd700 40%, #ff8c00 100%)';
    bgClip = 'text';
    textFillColor = 'transparent';
  } else if (p.gradient) {
    bgImage = p.gradient;
    bgClip = 'text';
    textFillColor = 'transparent';
  }

  return (
    <div
      className={`ovl ${isSelected ? 'ovl-selected' : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect?.(c.id); }}
      onPointerDown={handlePointerDown}
      style={{
        ...st,
        fontFamily: p.fontFamily,
        fontSize: `${p.fontSize}cqw`,
        color,
        background: bg,
        backgroundImage: bgImage,
        WebkitBackgroundClip: bgClip,
        WebkitTextFillColor: textFillColor,
        padding,
        borderRadius,
        borderLeft,
        fontWeight: p.bold ? 700 : 400,
        fontStyle: p.italic ? 'italic' : 'normal',
        textDecoration: p.underline ? 'underline' : 'none',
        textAlign: p.align || 'center',
        letterSpacing: `${p.letterSpacing || 0}px`,
        lineHeight: p.lineHeight || 1.2,
        textShadow,
        WebkitTextStroke: p.stroke ? `${p.stroke}px ${p.strokeColor}` : undefined,
        whiteSpace: 'pre-wrap',
        pointerEvents: 'auto',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      {text}
    </div>
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

const adjCss = (p) => ((p.br ?? 1) === 1 && (p.ct ?? 1) === 1 && (p.sa ?? 1) === 1 ? '' : `brightness(${p.br ?? 1}) contrast(${p.ct ?? 1}) saturate(${p.sa ?? 1})`);
function clipStyle(c, t) {
  if (!c) return {};
  const st = vstyle(c, t), p = c.props, x = transitionFx(p.trans, t - c.start, p.transDur);
  const f = [st.filter, filterCss(p.filter, p.filterAmt), adjCss(p), x?.filter].filter(Boolean).join(' ') || undefined;
  if (!x) return { ...st, filter: f };
  return { ...st, filter: f, opacity: st.opacity * (x.opacity ?? 1), clipPath: x.clipPath || st.clipPath, transform: `${x.transform || ''} ${st.transform}` };
}

const TABS = [
  ['media', 'film', '📸 Media'],
  ['effects', 'sparkles', '✨ Pro FX'],
  ['stickers', 'smile', '⭐ Stickers'],
  ['templates', 'layers', '⚡ Templates'],
  ['soundfx', 'volume', '🎛️ Audio FX'],
  ['beatmaker', 'music', '🎵 Beat DAW'],
  ['voiceover', 'mic', '🎙️ Voiceover'],
  ['captions', 'type', '🎤 Captions'],
  ['text', 'type', '🇮🇳 Hindi Text'],
  ['looks', 'filter', '🎨 Looks'],
  ['ailab', 'sparkles', '🤖 AI Lab'],
];
const TEXT_PRESETS = [
  {
    category: '🇮🇳 हिंदी टाइटल्स',
    items: [
      {
        name: 'नमस्ते 🙏 (शाही गोल्ड)',
        preview: 'नमस्ते 🙏',
        previewStyle: { fontFamily: '"Yatra One", cursive', color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.6)' },
        props: { text: 'नमस्ते 🙏', fontFamily: '"Yatra One", cursive', fontSize: 8.5, color: '#ffd700', stylePreset: 'gold', bold: true, anim: 'zoom' },
      },
      {
        name: 'शुभ विवाह 💍 (Royal Wedding)',
        preview: 'शुभ विवाह ❤️',
        previewStyle: { fontFamily: '"Rozha One", serif', color: '#ffffff', background: '#991b1b', padding: '2px 8px', borderRadius: '6px' },
        props: { text: 'शुभ विवाह ❤️', fontFamily: '"Rozha One", serif', fontSize: 7, color: '#ffffff', stylePreset: 'none', bg: '#991b1b', bgRadius: 8, bold: true, anim: 'fade' },
      },
      {
        name: 'प्यारी यादें 💖 (Romantic / Shayari)',
        preview: 'प्यारी यादें 💖',
        previewStyle: { fontFamily: 'Caveat, cursive', color: '#ff758c', textShadow: '0 0 10px #ff758c' },
        props: { text: 'प्यारी यादें 💖', fontFamily: 'Caveat, cursive', fontSize: 9, color: '#ff758c', stylePreset: 'neon', glow: 12, glowColor: '#ff758c', bold: true, anim: 'slide' },
      },
      {
        name: 'नया धमाका 🔥 (Viral Reel)',
        preview: 'नया धमाका 🔥',
        previewStyle: { fontFamily: 'Anton, sans-serif', color: '#ff3b30', textShadow: '0 0 12px #ff4500' },
        props: { text: 'नया धमाका 🔥', fontFamily: 'Anton, sans-serif', fontSize: 8.5, color: '#ffffff', stylePreset: 'fire', bold: true, stroke: 1.5, strokeColor: '#000000', anim: 'pop' },
      },
      {
        name: '🔴 ब्रेकिंग न्यूज़ (Alert)',
        preview: '🔴 ब्रेकिंग न्यूज़',
        previewStyle: { fontFamily: '"Noto Sans Devanagari", sans-serif', background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderLeft: '4px solid #facc15' },
        props: { text: '🔴 ब्रेकिंग न्यूज़ : आज का बड़ा अपडेट', fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: 5.5, stylePreset: 'news', bold: true, anim: 'slide' },
      },
      {
        name: '॥ जय श्री राम ॥ 🚩',
        preview: 'जय श्री राम 🚩',
        previewStyle: { fontFamily: '"Yatra One", cursive', color: '#ff7700', textShadow: '2px 2px 0px #000' },
        props: { text: '॥ जय श्री राम ॥ 🚩', fontFamily: '"Yatra One", cursive', fontSize: 8, color: '#ff7700', stylePreset: '3d', bold: true, stroke: 1, strokeColor: '#7c2d12', anim: 'drop' },
      },
      {
        name: 'शायरी / विचार ✍️ (Quote)',
        preview: 'कुछ अनकहे शब्द... ✍️',
        previewStyle: { fontFamily: 'Mukta, sans-serif', color: '#e2e8f0', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '6px' },
        props: { text: 'कुछ अनकहे शब्द...\nजो दिल को छू जाएं ✍️', fontFamily: 'Mukta, sans-serif', fontSize: 5, color: '#ffffff', stylePreset: 'subtitles', bold: true, align: 'center', anim: 'typewriter' },
      },
    ],
  },
  {
    category: '⚡ Viral Reels & Shorts',
    items: [
      {
        name: 'WAIT FOR IT... 😱 (Hook)',
        preview: 'WAIT FOR IT... 😱',
        previewStyle: { fontFamily: 'Anton, sans-serif', background: '#ffe600', color: '#000000', padding: '2px 8px', borderRadius: '6px' },
        props: { text: 'WAIT FOR IT... 😱', fontFamily: 'Anton, sans-serif', fontSize: 8, stylePreset: 'hook', bold: true, anim: 'pop' },
      },
      {
        name: 'TRENDING NOW ⚡ (Neon)',
        preview: 'TRENDING ⚡',
        previewStyle: { fontFamily: 'Poppins, sans-serif', color: '#ffffff', textShadow: '0 0 12px #00f0ff' },
        props: { text: 'TRENDING NOW ⚡', fontFamily: 'Poppins, sans-serif', fontSize: 7, color: '#ffffff', stylePreset: 'neon', glow: 15, glowColor: '#00f0ff', bold: true, anim: 'pulse' },
      },
      {
        name: 'CINEMATIC VIBES ✨ (Movie)',
        preview: 'THE JOURNEY ✨',
        previewStyle: { fontFamily: 'Cinzel, serif', color: '#ffd700', letterSpacing: '2px' },
        props: { text: 'THE JOURNEY ✨', fontFamily: 'Cinzel, serif', fontSize: 7, stylePreset: 'gold', letterSpacing: 4, bold: true, anim: 'blur' },
      },
      {
        name: 'GLITCH VIBES 👾',
        preview: 'ERROR 404 👾',
        previewStyle: { fontFamily: 'Impact, sans-serif', color: '#ffffff', textShadow: '-2px 0 #ff0055, 2px 0 #00ffff' },
        props: { text: 'ERROR 404 👾', fontFamily: 'Impact, sans-serif', fontSize: 7.5, color: '#ffffff', stylePreset: 'glitch', bold: true, anim: 'bounce' },
      },
      {
        name: 'PRO CAPTION / SUBTITLE 💬',
        preview: 'Clean Captions 💬',
        previewStyle: { fontFamily: 'Poppins, sans-serif', background: 'rgba(0,0,0,0.8)', color: '#ffffff', padding: '2px 8px', borderRadius: '6px' },
        props: { text: 'Type your captions here...', fontFamily: 'Poppins, sans-serif', fontSize: 5, color: '#ffffff', stylePreset: 'subtitles', bold: true, anim: 'fade' },
      },
      {
        name: 'SUBSCRIBE 🔔 (YouTube)',
        preview: 'SUBSCRIBE 🔔',
        previewStyle: { fontFamily: 'Poppins, sans-serif', background: '#e11d48', color: '#ffffff', padding: '2px 10px', borderRadius: '99px' },
        props: { text: 'SUBSCRIBE 🔔', fontFamily: 'Poppins, sans-serif', fontSize: 5.5, color: '#ffffff', bg: '#e11d48', bgRadius: 99, bgPadding: '0.3em 0.8em', bold: true, anim: 'pop' },
      },
    ],
  },
  {
    category: '📝 Basic Text',
    items: [
      {
        name: 'Heading (शीर्षक)',
        preview: 'Large Heading',
        previewStyle: { fontFamily: 'Poppins, sans-serif', fontSize: '16px', fontWeight: 'bold' },
        props: { text: 'Heading', fontFamily: 'Poppins, sans-serif', fontSize: 9, bold: true },
      },
      {
        name: 'Subtitle (उपशीर्षक)',
        preview: 'Subtitle Text',
        previewStyle: { fontFamily: 'Poppins, sans-serif', fontSize: '13px' },
        props: { text: 'Subtitle', fontFamily: 'Poppins, sans-serif', fontSize: 5.5, bold: false },
      },
      {
        name: 'Body / Paragraph',
        preview: 'Body paragraph text',
        previewStyle: { fontFamily: 'Mukta, sans-serif', fontSize: '12px' },
        props: { text: 'Add your text here...', fontFamily: 'Mukta, sans-serif', fontSize: 4, bold: false },
      },
    ],
  },
];

function LeftPanel({ tab, setTab, projectId, setErr, onAdded }) {
  const addLayer = useEditor((x) => x.addLayer);
  const [textCat, setTextCat] = useState(0);
  const add = (a) => { addLayer(a); onAdded(); };
  return (
    <div className="panel left">
      <div className="tabs">{TABS.map(([k, ic, l]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}><Icon name={ic} size={18} /><span>{l}</span></button>)}</div>
      <div className="tabcontent">
        {tab === 'media' && <MediaPanel projectId={projectId} setErr={setErr} onAdded={onAdded} />}
        {tab === 'beatmaker' && <EditorBeatMaker projectId={projectId} onClose={() => setTab('media')} />}
        {tab === 'voiceover' && <EditorVoiceover projectId={projectId} onClose={() => setTab('media')} />}
        {tab === 'captions' && <AutoCaptions projectId={projectId} onClose={() => setTab('media')} />}
        {tab === 'looks' && <EditorLooks />}
        {tab === 'ailab' && <EditorAiStudio projectId={projectId} onClose={() => setTab('media')} />}
        {tab === 'audio' && <MediaPanel only="AUDIO" projectId={projectId} setErr={setErr} onAdded={onAdded} />}
        {tab === 'overlay' && <MediaPanel only="IMAGE" projectId={projectId} setErr={setErr} onAdded={onAdded} />}
        {tab === 'text' && (
          <div className="tabbody">
            <div className="text-tabs-head">
              {['🇮🇳 हिंदी टाइटल्स', '⚡ Reels & Hooks', '📝 Basic Text'].map((t, i) => (
                <button
                  key={t}
                  className={`text-cat-btn ${textCat === i ? 'active' : ''}`}
                  onClick={() => setTextCat(i)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '4px 0 8px 0' }}>
              <button
                type="button"
                className="btn sm"
                style={{ fontSize: '11px', padding: '6px 2px', background: 'var(--s2)', border: '1px solid var(--line)' }}
                onClick={() => add({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, text: 'मुख्य शीर्षक', fontSize: 8.5, y: -26, bold: true })}
              >
                👆 ऊपर Line 1
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ fontSize: '11px', padding: '6px 2px', background: 'var(--s2)', border: '1px solid var(--line)' }}
                onClick={() => add({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, text: 'उपशीर्षक / नई लाइन', fontSize: 5.5, y: 24, bold: false })}
              >
                👇 नीचे Line 2
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ fontSize: '11px', padding: '6px 2px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', fontWeight: 700 }}
                onClick={() => {
                  add({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, text: 'मुख्य शीर्षक (Line 1)', fontSize: 8, y: -15, bold: true });
                  setTimeout(() => {
                    useEditor.getState().addLayer({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, text: 'नीचे की लाइन (Line 2)', fontSize: 5.5, y: 18, color: '#e2e8f0', bold: false });
                  }, 100);
                }}
              >
                📜 2-Lines Pack
              </button>
            </div>
            <div className="text-grid">
              {TEXT_PRESETS[textCat].items.map((item) => (
                <div
                  key={item.name}
                  className="text-tpl-card"
                  onClick={() => add({ track: 'TEXT', kind: 'text', ...TEXT_DEFAULTS, ...item.props })}
                >
                  <div>
                    <div className="text-tpl-preview" style={item.previewStyle}>
                      {item.preview}
                    </div>
                    <div className="text-tpl-name">{item.name}</div>
                  </div>
                  <button className="btn sm primary" style={{ pointerEvents: 'none' }}>+ Add</button>
                </div>
              ))}
            </div>
            <small className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
              Text timeline par playhead par add hoga. Properties se font, color & effects edit karein.
            </small>
          </div>
        )}
        {tab === 'stickers' && (
          <EditorStickers
            onAddSticker={(s) => {
              add({
                track: 'OVERLAY',
                kind: 'sticker',
                stickerId: s.id,
                label: s.content || s.name,
                shape: s.id,
                color: s.color || '#ffb020',
                props: {
                  stickerData: s,
                  label: s.content || s.name,
                  color: s.color || '#ffb020',
                },
              });
            }}
          />
        )}
        {tab === 'effects' && (
          <EditorEffectsPanel
            onAddEffect={(effKey) => {
              add({
                track: 'EFFECTS',
                kind: 'effect',
                effect: effKey,
                intensity: 0.7,
                duration: 3,
              });
            }}
          />
        )}
        {tab === 'templates' && <EditorTemplates />}
        {tab === 'soundfx' && <EditorAudioFx projectId={projectId} />}
      </div>
    </div>
  );
}

function AudioTrackPlayer({ clip, media, playhead, playing, muted }) {
  const aRef = useRef();
  const m = media.find((x) => x.id === clip.mediaId);
  const src = m ? fileUrl(m.url) : undefined;
  useEffect(() => {
    sync(aRef.current, clip, playhead, playing, muted);
  });
  return <audio ref={aRef} src={src} preload="auto" playsInline />;
}

function Preview() {
  const { clips, media, playhead, playing, tracks: tk, selected } = useEditor();
  const v = useRef(), stage = useRef();
  
  const getMedia = (c) => c && media.find((x) => x.id === c.mediaId);
  const url = (c) => { const m = getMedia(c); return m ? fileUrl(m.url) : undefined; };

  const at = (track) => !tk[track]?.hidden && clips.find((c) => c.track === track && playhead >= c.start && playhead < c.start + c.duration);
  const vc = at('VIDEO'), ic = at('IMAGE');

  const vm = getMedia(vc);
  const isVideoReallyImage = vm && (vm.type === 'image' || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(vm.name || vm.url));
  const activeVideoClip = isVideoReallyImage ? null : vc;
  const activeImageClip = isVideoReallyImage ? vc : ic;

  // Keep audio elements mounted and preloaded for instant responsive zero-stutter playback
  const audioClips = !tk.AUDIO?.hidden
    ? clips.filter((c) => c.track === 'AUDIO' || c.track === 'audio')
    : [];

  useEffect(() => {
    if (activeVideoClip) {
      sync(v.current, activeVideoClip, playhead, playing, tk.VIDEO?.muted);
    }
  });

  const fx = composeEffects(clips.filter((c) => c.kind === 'effect' && !tk.EFFECTS?.hidden && playhead >= c.start && playhead < c.start + c.duration), playhead);
  return (<>
    <FxDefs rgb={fx.rgb} mblur={fx.mblur} distort={fx.distort} />
    <div ref={stage} className="stage" style={{ filter: fx.filters.join(' ') || undefined, transform: fx.transforms.join(' ') || undefined }}>
      <video
        ref={v}
        src={url(activeVideoClip)}
        className="vid"
        style={{ display: activeVideoClip ? 'block' : 'none', ...clipStyle(activeVideoClip, playhead) }}
        playsInline
        onLoadedData={() => sync(v.current, activeVideoClip, useEditor.getState().playhead, useEditor.getState().playing)}
      />
      {!activeVideoClip && activeImageClip && (
        <img
          className="vid"
          style={clipStyle(activeImageClip, playhead)}
          src={url(activeImageClip)}
          alt=""
        />
      )}
      {clips.filter((c) => (c.kind === 'text' || c.kind === 'sticker') && !tk[c.track]?.hidden && playhead >= c.start && playhead < c.start + c.duration).map((c) => (
        <Layer key={c.id} c={c} t={playhead} isSelected={selected === c.id} onSelect={(cid) => useEditor.getState().select(cid)} />
      ))}
      {fx.overlays.map((o, i) => <div key={i} className="ovfx" style={o} />)}
      {fx.pixel > 0 && <Pixelate stage={stage} size={fx.pixel} />}
    </div>
    {audioClips.map((c) => (
      <AudioTrackPlayer key={c.id} clip={c} media={media} playhead={playhead} playing={playing} muted={tk.AUDIO?.muted} />
    ))}
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

const PANEL_DEFAULT = { lw: 320, rw: 300, th: 250 }, PANEL_LIMIT = { lw: [220, 520], rw: [240, 520], th: [160, 520] };
function usePanels() { // resizable side panels + timeline height (desktop), remembered between visits
  const [p, setP] = useState(() => { try { return { ...PANEL_DEFAULT, ...JSON.parse(localStorage.getItem('rvs_panels')) }; } catch { return PANEL_DEFAULT; } });
  useEffect(() => { try { localStorage.setItem('rvs_panels', JSON.stringify(p)); } catch { /* storage blocked */ } }, [p]);
  const drag = (key, dir) => (e) => {
    e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, v0 = p[key], [lo, hi] = PANEL_LIMIT[key];
    const mv = (ev) => { const d = key === 'th' ? y0 - ev.clientY : dir * (ev.clientX - x0); setP((q) => ({ ...q, [key]: Math.min(hi, Math.max(lo, v0 + d)) })); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  return { p, drag, reset: (key) => () => setP((q) => ({ ...q, [key]: PANEL_DEFAULT[key] })) };
}

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
            {mobile && t === 'VIDEO' && <button className="plusbtn" title="Add media" style={{ left: Math.max(0, ...clips.filter((c) => c.track === 'VIDEO').map((c) => c.start + c.duration)) * zoom + 8 }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAdd('media'); }}><Icon name="plus" size={20} /></button>}
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

  const EMOJIS = ['🔥', '⚡', '❤️', '🙏', '👑', '🚩', '🔔', '😱', '✨', '🎬', '💬', '🔴'];
  const SWATCHES = ['#ffffff', '#ffd700', '#00f0ff', '#ff0055', '#ffe600', '#22c55e', '#a855f7', '#000000'];
  const STYLES = [
    ['none', 'Standard'],
    ['neon', '⚡ Neon'],
    ['gold', '👑 Gold'],
    ['3d', '🧱 3D Block'],
    ['hook', '💬 Hook'],
    ['subtitles', '📺 Subtitle'],
    ['fire', '🔥 Fire'],
    ['glitch', '👾 Glitch'],
  ];

  return (
    <div className="stack" style={{ gap: 10 }}>
      {/* 0. Quick Multi-Line & Add Line Below */}
      <div className="prop-card" style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <b style={{ fontSize: '12px', color: '#38bdf8' }}>➕ नीचे नई लाइन (Add Line Below)</b>
        </div>
        <button
          type="button"
          className="btn sm primary"
          style={{ width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px' }}
          onClick={() => {
            const curY = p.y || 0;
            useEditor.getState().addLayer({
              track: 'TEXT',
              kind: 'text',
              ...TEXT_DEFAULTS,
              text: 'नीचे दूसरी लाइन',
              y: curY >= 0 ? curY + 22 : curY + 26,
              fontSize: Math.max(4, (p.fontSize || 7) * 0.75),
              fontFamily: p.fontFamily || 'Poppins, sans-serif',
              stylePreset: p.stylePreset === 'gold' ? 'gold' : 'none',
              color: '#ffffff',
            });
          }}
        >
          + नीचे दूसरी लाइन जोड़ें (Line 2 Below)
        </button>
        <div className="row" style={{ marginTop: 6, gap: 4 }}>
          <button type="button" className="btn sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => set('y')(-28)}>👆 ऊपर (Top)</button>
          <button type="button" className="btn sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => set('y')(0)}>⬌ बीच में (Center)</button>
          <button type="button" className="btn sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => set('y')(30)}>👇 नीचे (Bottom)</button>
        </div>
      </div>

      {/* 1. Text Content */}
      <div className="prop-card">
        <div className="prop-card-header">✏️ Text Content / शब्द</div>
        <textarea
          rows={3}
          value={p.text || ''}
          placeholder="Type in Hindi or English (Enter दबाकर अगली लाइन लिखें)"
          onChange={(e) => set('text')(e.target.value)}
          style={{ width: '100%', fontSize: 14 }}
        />
        <small className="muted" style={{ display: 'block', margin: '2px 0 6px 0', fontSize: '10.5px' }}>
          💡 Enter दबाकर 2 या 3 लाइनें लिख सकते हैं — स्क्रीन पर एक के नीचे एक अलग लाइन में दिखेंगी।
        </small>
        <div className="emoji-toolbar">
          {EMOJIS.map((em) => (
            <button key={em} className="emoji-btn" onClick={() => set('text')((p.text || '') + em)}>
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Text Effects (1-Click) */}
      <div className="prop-card">
        <div className="prop-card-header">✨ Text FX & Styles (1-Click)</div>
        <div className="style-grid">
          {STYLES.map(([id, label]) => (
            <button
              key={id}
              className={`style-badge ${(p.stylePreset || 'none') === id ? 'on' : ''}`}
              onClick={() => set('stylePreset')(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Typography */}
      <div className="prop-card">
        <div className="prop-card-header">🔤 Font & Typography</div>
        <label className="prop">
          <span>Font Style</span>
          <select value={p.fontFamily} onChange={(e) => set('fontFamily')(e.target.value)}>
            {FONTS.map(([n, v]) => <option key={n} value={v}>{n}</option>)}
          </select>
        </label>
        <Slider label="Font Size" value={p.fontSize} min={2} max={30} step={0.5} onChange={set('fontSize')} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 4 }}>
            {tog('bold', 'B')}
            {tog('italic', 'I')}
            {tog('underline', 'U')}
            {tog('shadow', '🌑 Drop')}
          </div>
          <div className="seg">
            {['left', 'center', 'right'].map((a) => (
              <button key={a} className={(p.align || 'center') === a ? 'on' : ''} onClick={() => set('align')(a)}>
                {a === 'left' ? '⬅' : a === 'center' ? '⬌' : '➡'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Color & Glow */}
      <div className="prop-card">
        <div className="prop-card-header">🎨 Color, Glow & Outline</div>
        <div className="row">
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Color: <input type="color" value={p.color || '#ffffff'} onChange={(e) => set('color')(e.target.value)} />
          </label>
          <div className="swatches">
            {SWATCHES.map((sw) => (
              <div key={sw} className="swatch" style={{ background: sw }} onClick={() => set('color')(sw)} />
            ))}
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <Slider label="Glow (चमक)" value={p.glow || 0} min={0} max={30} step={1} onChange={set('glow')} />
          </div>
          <input type="color" title="Glow color" value={p.glowColor || '#00f0ff'} onChange={(e) => set('glowColor')(e.target.value)} />
        </div>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Slider label="Outline / Stroke" value={p.stroke || 0} min={0} max={8} step={0.5} onChange={set('stroke')} />
          </div>
          <input type="color" title="Stroke color" value={p.strokeColor || '#000000'} onChange={(e) => set('strokeColor')(e.target.value)} />
        </div>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Background Box: <input type="color" value={p.bg || '#000000'} onChange={(e) => set('bg')(e.target.value)} />
          </label>
          <button className="btn sm" onClick={() => set('bg')('')}>No Box</button>
        </div>
      </div>

      {/* 5. Animation */}
      <div className="prop-card">
        <div className="prop-card-header">🎬 Text Animation / इफ़ेक्ट</div>
        <label className="prop">
          <span>Animation Effect</span>
          <select value={p.anim || 'none'} onChange={(e) => set('anim')(e.target.value)}>
            {[
              ['none', 'None (स्थिर)'],
              ['typewriter', 'Typewriter (टाइपराइटर)'],
              ['fade', 'Smooth Fade (धीरे-धीरे आना)'],
              ['slide', 'Slide Left (बायें से आना)'],
              ['slideRight', 'Slide Right (दायें से आना)'],
              ['zoom', 'Zoom Pop (उछल कर आना)'],
              ['bounce', 'Bounce In (कूदता हुआ)'],
              ['blur', 'Cinematic Blur In'],
              ['pulse', 'Continuous Pulse (धड़कना)'],
              ['drop', 'Drop from Top (ऊपर से गिरना)'],
            ].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <Slider label="Letter Spacing" value={p.letterSpacing || 0} min={-2} max={20} onChange={set('letterSpacing')} />
        <Slider label="Line Height" value={p.lineHeight || 1.2} min={0.8} max={2.5} step={0.1} onChange={set('lineHeight')} />
      </div>
    </div>
  );
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
  const loc = useLocation(), navigate = useNavigate(), addRef = useRef(new URLSearchParams(loc.search).get('add'));
  const queryTab = new URLSearchParams(loc.search).get('tab');
  const [p, setP] = useState(null); const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [showExport, setShowExport] = useState(false);
  const panels = usePanels(); const mobile = useMobile();
  const [tab, setTab] = useState(queryTab || 'media');
  const [mini, setMini] = useState(null); const wrapRef = useRef();
  const [sheet, setSheet] = useState(queryTab ? 'left' : null);
  const [ready, setReady] = useState(false); const [recover, setRecover] = useState(null);
  const { playing, playhead, clips, zoom, selected, setPlaying, seek, setZoom, removeClip, setMedia, splitClip, past, future, undo, redo, duplicate, addMarker, updateProps } = useEditor();

  useEffect(() => {
    useEditor.setState({ clips: [], past: [], future: [], tracks: DEFAULT_TRACKS(), markers: [], playhead: 0, playing: false, selected: null });
    setReady(false); setRecover(null);

    const isLocalProj = String(id).startsWith('local-');
    if (isLocalProj) {
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      const proj = local.find((x) => x.id === id) || { id, name: 'Offline Project', width: 1080, height: 1920, fps: 30, duration: 5, updatedAt: new Date().toISOString(), isLocal: true };
      const savedMedia = JSON.parse(localStorage.getItem(`rvs_media_${id}`) || '[]');
      const b = JSON.parse(localStorage.getItem(`rvs_backup_${id}`) || 'null');
      setP(proj); setMedia(savedMedia);
      useEditor.setState({
        clips: b?.clips || proj.clips || loadClips(proj),
        tracks: b?.tracks || proj.tracks || loadTracks(proj),
        markers: b?.markers || proj.markers || [],
        past: [],
        future: []
      });
      setReady(true);
      return;
    }

    Promise.all([api(`/projects/${id}`), api(`/media?projectId=${id}`)]).then(([proj, m]) => {
      setP(proj); setMedia(m);
      useEditor.setState({ clips: loadClips(proj), tracks: loadTracks(proj), markers: proj.markers || [], past: [], future: [] });
      try { // unsaved local backup newer than the server copy -> offer recovery
        const b = JSON.parse(localStorage.getItem(`rvs_backup_${id}`));
        if (b?.clips && new Date(b.at) > new Date(proj.updatedAt)) setRecover(b);
      } catch { /* ignore */ }
      setReady(true);
    }).catch((e) => {
      console.warn('Could not load project from server, attempting offline restore:', e);
      const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
      const proj = cached.find((x) => x.id === id) || { id, name: 'Offline Video', width: 1080, height: 1920, fps: 30, duration: 5 };
      const b = JSON.parse(localStorage.getItem(`rvs_backup_${id}`) || 'null');
      const savedMedia = JSON.parse(localStorage.getItem(`rvs_media_${id}`) || '[]');
      setP(proj); setMedia(savedMedia);
      useEditor.setState({ clips: b?.clips || loadClips(proj), tracks: b?.tracks || loadTracks(proj), markers: b?.markers || proj.markers || [], past: [], future: [] });
      setReady(true);
      setNote('Offline mode: Local project backup loaded.');
    });
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
  const changeRatio = async (w, h) => {
    if (String(id).startsWith('local-')) {
      setP((x) => ({ ...x, width: w, height: h }));
      try {
        const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
        const item = local.find((x) => x.id === id);
        if (item) { item.width = w; item.height = h; localStorage.setItem('rvs_local_projects', JSON.stringify(local)); }
      } catch {}
      return;
    }
    try { await api(`/projects/${id}`, { method: 'PUT', body: { width: w, height: h } }); setP((x) => ({ ...x, width: w, height: h })); } catch (e) { setErr(e.message); }
  };
  const openLeft = (tb) => { setMini(null); setTab(tb); setSheet('left'); };
  const openMini = (k) => { setSheet(null); setMini(k); };
  const ratioLabel = (w, h) => { const r = w / h, hit = [['9:16', 9 / 16], ['16:9', 16 / 9], ['1:1', 1], ['4:5', 0.8]].find(([, v]) => Math.abs(r - v) < 0.03); return hit ? hit[0] : `${w}×${h}`; };
  useEffect(() => { // coming from "New video": put the picked media on the timeline (after autosave has its baseline, so it gets saved)
    if (!ready || !addRef.current) return;
    const st = useEditor.getState();
    addRef.current.split(',').forEach((mid) => { const m = st.media.find((x) => x.id === mid); if (m) useEditor.getState().addClip(m); });
    useEditor.setState({ selected: null }); addRef.current = null; navigate(loc.pathname, { replace: true });
  }, [ready]); // eslint-disable-line
  const step = (n) => () => { const st = useEditor.getState(); st.seek(st.playhead + n / (p?.fps || 30)); };
  useShortcuts({
    left: step(-1), right: step(1), 'shift+left': step(-(p?.fps || 30)), 'shift+right': step(p?.fps || 30),
    'mod+s': saveNow,
  });

  if (err && !p) return <div className="center"><p className="err">{err}</p><Link to="/">Back</Link></div>;
  if (!p) return <div className="center">Loading…</div>;
  const dur = totalDuration(clips); const selClip = clips.find((c) => c.id === selected);
  return (
    <div className="editor" style={{ '--lw': `${panels.p.lw}px`, '--rw': `${panels.p.rw}px`, '--th': `${panels.p.th}px` }}>
      <i className="split v l" title="Drag to resize (double-click to reset)" onPointerDown={panels.drag('lw', 1)} onDoubleClick={panels.reset('lw')} />
      <i className="split v r" title="Drag to resize (double-click to reset)" onPointerDown={panels.drag('rw', -1)} onDoubleClick={panels.reset('rw')} />
      <i className="split h" title="Drag to resize (double-click to reset)" onPointerDown={panels.drag('th', 1)} onDoubleClick={panels.reset('th')} />
      <header className="top etop">
        <Link className="ib" to="/" title="Back to projects"><Icon name="back" /></Link>
        <span className="brandmark"><Logo /></span><b className="pname">{p.name}</b>
        <span className={`savechip save-${status}`}>{{ saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved', error: 'Retrying…' }[status]}</span>
        {err && <span className="err">{err}</span>}
        {recover && <span className="recover">Unsaved changes found ({new Date(recover.at).toLocaleTimeString()}){' '}
          <button className="btn sm primary" onClick={() => { useEditor.setState({ clips: recover.clips, tracks: recover.tracks || DEFAULT_TRACKS(), markers: recover.markers || [] }); setRecover(null); }}>Restore</button>{' '}
          <button className="btn sm" onClick={() => { localStorage.removeItem(`rvs_backup_${id}`); setRecover(null); }}>Discard</button></span>}
        <span className="grow" /><span className="muted res">{p.fps}fps</span>
        <button
          type="button"
          className="btn sm"
          onClick={() => { setMini(null); setSheet(sheet === 'left' ? null : 'left'); }}
          style={{
            background: sheet === 'left' ? 'var(--grad)' : 'var(--s2)',
            border: '1px solid var(--line)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 9px',
            borderRadius: '16px',
            cursor: 'pointer',
          }}
          title="Open all editing tools"
        >
          <span>🛠️ Tools</span>
        </button>
        <button className="chip ratio" title="Aspect ratio" onClick={() => openMini('ratio')}>{ratioLabel(p.width, p.height)} ▾</button>
        <button className="btn primary" onClick={() => setShowExport(true)}><Icon name="download" size={16} /> Export</button>
      </header>
      <div className={`zl ${sheet === 'left' ? 'open' : ''}`}><button className="ib sheet-x" onClick={() => setSheet(null)}><Icon name="close" /></button><LeftPanel tab={tab} setTab={setTab} projectId={id} setErr={setErr} onAdded={() => { if (mobile) setSheet(null); }} /></div>
      <section className="preview">
        <div className="canvaswrap" ref={wrapRef} onClick={() => { if (!playing && playhead >= dur) seek(0); setPlaying(!playing); }}><div className="canvas" style={{ aspectRatio: `${p.width}/${p.height}`, '--ar': p.width / p.height }}><Preview /></div></div>
        {mobile ? <MobileTransport onFull={() => wrapRef.current?.requestFullscreen?.()} /> : (
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
        </div>)}
      </section>
      <div className={`zr ${sheet === 'props' ? 'open' : ''}`}><button className="ib sheet-x" onClick={() => setSheet(null)}><Icon name="close" /></button><Props /></div>
      {mobile
        ? <footer className="timeline"><MobileTimeline Wave={Wave} onAdd={openLeft} onTrans={(cid) => { useEditor.getState().select(cid); openMini('trans'); }} /></footer>
        : <footer className="timeline"><Timeline onAdd={openLeft} /></footer>}
      {showExport && <ExportDialog project={p} onClose={() => setShowExport(false)} />}
      {mini && <MiniSheet kind={mini} project={p} onRatio={changeRatio} onClose={() => setMini(null)} />}
      {sheet && <div className="backdrop" onClick={() => setSheet(null)} />}
      <MobileToolbar mobile={mobile} openLeft={openLeft} openProps={() => { setMini(null); setSheet(sheet === 'props' ? null : 'props'); }} openMini={openMini} />
    </div>
  );
}

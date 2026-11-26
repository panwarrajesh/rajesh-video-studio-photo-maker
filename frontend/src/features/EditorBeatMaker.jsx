import { useState, useRef, useEffect } from 'react';
import { useEditor } from '../store/editor.js';
import { upload } from '../services/api.js';

function playDrumSound(ctx, type, time = 0) {
  const t = time || ctx.currentTime;
  if (type === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  } else if (type === 'snare') {
    const len = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.2);
  } else if (type === 'hihat') {
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.06);
  } else if (type === '808') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.7);
  } else if (type === 'clap') {
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.18);
  }
}

export default function EditorBeatMaker({ projectId, onClose }) {
  const { addClip, setMedia } = useEditor();
  const audioCtxRef = useRef(null);
  const [bpm, setBpm] = useState(130);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const TRACKS = ['kick', 'snare', 'hihat', '808', 'clap'];
  const [grid, setGrid] = useState({
    kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    '808': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    clap:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  });

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const toggleStep = (track, sIdx) => {
    setGrid((prev) => {
      const row = [...prev[track]];
      row[sIdx] = row[sIdx] ? 0 : 1;
      return { ...prev, [track]: row };
    });
  };

  useEffect(() => {
    if (!playing) return;
    const intervalMs = (60 / bpm / 4) * 1000;
    const timer = setInterval(() => {
      setStep((prev) => {
        const next = (prev + 1) % 16;
        const ctx = getAudioCtx();
        TRACKS.forEach((t) => {
          if (grid[t]?.[next]) playDrumSound(ctx, t);
        });
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, bpm, grid]);

  // Insert beat directly into video editor timeline
  const handleInsertTimeline = async () => {
    setBusy(true);
    setMsg('Synthesizing beat loop…');
    try {
      const offlineCtx = new OfflineAudioContext(2, 44100 * 8, 44100);
      const stepDur = 60 / bpm / 4;
      for (let loop = 0; loop < 4; loop++) {
        for (let s = 0; s < 16; s++) {
          const time = (loop * 16 + s) * stepDur;
          TRACKS.forEach((t) => {
            if (grid[t]?.[s]) playDrumSound(offlineCtx, t, time);
          });
        }
      }
      const rendered = await offlineCtx.startRendering();
      const wavBlob = bufferToWave(rendered, rendered.length);

      setMsg('Adding to audio track…');
      let m = null;
      if (!String(projectId).startsWith('local-')) {
        try {
          const file = new File([wavBlob], `Beat-${bpm}BPM.wav`, { type: 'audio/wav' });
          const fd = new FormData();
          fd.append('projectId', projectId);
          fd.append('duration', rendered.duration);
          fd.append('file', file);
          m = await upload('/media/upload', fd);
        } catch (e) {
          console.warn('Server upload failed, using local beat audio:', e);
        }
      }

      if (!m) {
        m = {
          id: `beat-${Date.now()}-${bpm}bpm`,
          projectId,
          name: `Beat-${bpm}BPM.wav`,
          type: 'audio',
          url: URL.createObjectURL(wavBlob),
          duration: rendered.duration || 4,
          size: wavBlob.size,
        };
      }

      const updatedMedia = [m, ...useEditor.getState().media];
      setMedia(updatedMedia);
      try {
        const existing = JSON.parse(localStorage.getItem(`rvs_media_${projectId}`) || '[]');
        localStorage.setItem(`rvs_media_${projectId}`, JSON.stringify([m, ...existing]));
      } catch {}

      addClip(m);
      setMsg('✅ Beat added to timeline!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels, length = len * numOfChan * 2 + 44, buffer = new ArrayBuffer(length), view = new DataView(buffer), channels = [];
    let i, sample, offset = 0, pos = 0;
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true); pos += 2;
      }
      offset++;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  return (
    <div className="tabbody" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ fontSize: '14px' }}>🎵 Beat Maker (DAW)</b>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn sm"
            style={{ background: playing ? 'var(--danger)' : '#10b981', color: '#fff', border: 'none', padding: '4px 10px' }}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? '⏸️' : '▶️ Play'}
          </button>
          <button className="btn sm primary" onClick={handleInsertTimeline} disabled={busy}>
            {busy ? 'Adding…' : '➕ Add to Video'}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: '11px', color: msg.startsWith('✅') ? '#34d399' : '#ff6370', fontWeight: 700 }}>{msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700 }}>Tempo:</span>
        <input type="range" min="80" max="180" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', fontWeight: 800 }}>{bpm} BPM</span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        {TRACKS.map((t) => (
          <div key={t} className="step-seq-row" style={{ marginBottom: '4px' }}>
            <span style={{ width: '50px', fontSize: '11px', textTransform: 'capitalize', fontWeight: 700 }}>
              {t}
            </span>
            {grid[t]?.map((val, idx) => (
              <button
                key={idx}
                className={`step-seq-btn ${val ? 'on' : ''} ${step === idx && playing ? 'cur' : ''}`}
                style={{ width: '22px', height: '24px' }}
                onClick={() => toggleStep(t, idx)}
              />
            ))}
          </div>
        ))}
      </div>
      <small className="muted" style={{ fontSize: '11px' }}>
        Step grid tap karein aur "➕ Add to Video" dabayein — beat timeline me audio track par auto-sync ho jayegi.
      </small>
    </div>
  );
}

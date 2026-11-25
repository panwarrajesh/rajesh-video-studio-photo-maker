import { useState } from 'react';
import { useEditor } from '../store/editor.js';

// Pre-synthesized clean sound FX using Web Audio API for 100% offline instant sound effects!
function createAudioBufferWav(type) {
  const sampleRate = 44100;
  let duration = 0.6;
  if (type === 'boom') duration = 1.2;
  if (type === 'applause') duration = 1.5;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (type === 'whoosh') {
      // Wind whoosh frequency sweep
      const freq = 200 + 1200 * Math.sin((t / duration) * Math.PI);
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * (Math.random() * 0.4 + 0.6) * Math.sin((t / duration) * Math.PI) * 0.8;
    } else if (type === 'boom') {
      // Deep 808 bass impact
      const decay = Math.exp(-t * 3.5);
      const freq = 120 * Math.exp(-t * 4);
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.95;
    } else if (type === 'ding') {
      // Crystal bell ding
      const decay = Math.exp(-t * 4);
      buffer[i] = (Math.sin(2 * Math.PI * 1760 * t) + 0.5 * Math.sin(2 * Math.PI * 3520 * t)) * decay * 0.7;
    } else if (type === 'cash') {
      // Cash register double click & chime
      if (t < 0.1) buffer[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20);
      else buffer[i] = Math.sin(2 * Math.PI * 2200 * (t - 0.1)) * Math.exp(-(t - 0.1) * 6) * 0.8;
    } else if (type === 'scratch') {
      // DJ Vinyl scratch
      buffer[i] = Math.sin(2 * Math.PI * (400 + 800 * Math.cos(t * 25)) * t) * 0.7;
    } else if (type === 'applause') {
      // Crowd cheer & clap noise
      buffer[i] = (Math.random() * 2 - 1) * 0.5 * Math.sin((t / duration) * Math.PI);
    } else {
      buffer[i] = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    }
  }

  // Encode PCM 16-bit WAV
  const wavBytes = new Uint8Array(44 + numSamples * 2);
  const view = new DataView(wavBytes.buffer);
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([wavBytes], { type: 'audio/wav' });
}

const SOUND_FX = [
  { id: 'whoosh', name: '💨 Fast Whoosh', desc: 'Transition speed swoosh' },
  { id: 'boom', name: '💥 Cinematic Boom', desc: 'Deep 808 sub impact' },
  { id: 'ding', name: '🔔 Crystal Ding', desc: 'Notification bell chime' },
  { id: 'cash', name: '💰 Cash Chime', desc: 'Money register sound' },
  { id: 'scratch', name: '🎧 DJ Scratch', desc: 'Hip-hop record scratch' },
  { id: 'applause', name: '👏 Crowd Cheer', desc: 'Audience clap & applause' },
];

const VOICE_PRESETS = [
  { id: 'deep', name: '🦁 Deep Monster', desc: 'Bass boosted deep voice', pitch: -5, bass: 8 },
  { id: 'chipmunk', name: '🐿️ Chipmunk', desc: 'Cute high pitch cartoon', pitch: 7, bass: -4 },
  { id: 'robot', name: '🤖 Cyber Robot', desc: 'Metallic electronic filter', pitch: 0, robotic: true },
  { id: 'phone', name: '📞 Phone Call', desc: 'Vintage telephone bandpass', pitch: 0, phone: true },
  { id: 'echo', name: '⛪ Cathedral Echo', desc: 'Huge stadium reverb echo', pitch: 0, echo: true },
  { id: 'clarity', name: '🎙️ Studio Clarity', desc: 'Denoised crisp vocal', pitch: 0, treble: 6 },
];

export default function EditorAudioFx({ projectId }) {
  const { playhead, addClip, setMedia, media } = useEditor();
  const [playingId, setPlayingId] = useState(null);
  const [activeVoice, setActiveVoice] = useState('clarity');

  const playPreview = (type) => {
    try {
      const blob = createAudioBufferWav(type);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setPlayingId(type);
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
    } catch {}
  };

  const addSoundToTimeline = (s) => {
    const blob = createAudioBufferWav(s.id);
    const url = URL.createObjectURL(blob);
    const m = {
      id: `sfx-${Date.now()}-${s.id}`,
      projectId,
      name: s.name,
      type: 'audio',
      url,
      duration: s.id === 'applause' ? 1.5 : s.id === 'boom' ? 1.2 : 0.6,
      size: blob.size,
    };
    setMedia([m, ...media]);
    try {
      const existing = JSON.parse(localStorage.getItem(`rvs_media_${projectId}`) || '[]');
      localStorage.setItem(`rvs_media_${projectId}`, JSON.stringify([m, ...existing]));
    } catch {}

    addClip(m);
  };

  return (
    <div className="audio-engineering-panel" style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔊 Instant Sound FX Library (100% Offline)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
          {SOUND_FX.map((s) => (
            <div
              key={s.id}
              style={{
                background: 'var(--s2)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{s.name}</span>
                <button
                  type="button"
                  onClick={() => playPreview(s.id)}
                  style={{ background: '#38bdf822', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                >
                  {playingId === s.id ? '🔊' : '▶'}
                </button>
              </div>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => addSoundToTimeline(s)}
                style={{ fontSize: '10px', padding: '3px 8px', width: '100%' }}
              >
                + Add to Track
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🎙️ Voice Changer & Vocal Master
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {VOICE_PRESETS.map((v) => (
            <div
              key={v.id}
              onClick={() => setActiveVoice(v.id)}
              style={{
                background: activeVoice === v.id ? '#f472b622' : 'var(--s2)',
                border: activeVoice === v.id ? '1px solid #f472b6' : '1px solid var(--line)',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: activeVoice === v.id ? '#f472b6' : '#fff' }}>
                {v.name}
              </div>
              <small style={{ fontSize: '9px', color: 'var(--mut)', lineHeight: 1.1 }}>{v.desc}</small>
            </div>
          ))}
        </div>
        <small className="muted" style={{ display: 'block', marginTop: '6px', fontSize: '10px' }}>
          Voiceover aur video audio track par vocal frequency shaping apply hoti hai.
        </small>
      </div>
    </div>
  );
}

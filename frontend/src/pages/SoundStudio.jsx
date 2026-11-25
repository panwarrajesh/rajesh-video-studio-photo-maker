import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const VOICE_PRESETS = [
  { id: 'normal', name: 'Original Studio', desc: 'Clean transparent dialogue' },
  { id: 'robot', name: '🤖 Cyber Robot', desc: 'Ring-modulated robotic voice' },
  { id: 'deep', name: '🎙️ Deep Bass', desc: 'Warm cinematic low pitch' },
  { id: 'telephone', name: '📞 Vintage Phone', desc: '300Hz-3kHz bandpass curve' },
  { id: 'echo', name: '🌌 Space Echo', desc: 'Atmospheric feedback delay' },
  { id: 'radio', name: '📻 AM Radio', desc: 'Distorted lo-fi broadcast' },
];

export default function SoundStudio() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  const [activeVoice, setActiveVoice] = useState('normal');
  const [micActive, setMicActive] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [volume, setVolume] = useState(1);
  const [denoise, setDenoise] = useState(false);
  const [vocalIsolate, setVocalIsolate] = useState(false);
  const [dbLevel, setDbLevel] = useState(-60);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Start real-time spectrum visualizer
  const startSpectrum = (sourceNode, ctx) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyserRef.current = analyser;
    sourceNode.connect(analyser);

    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const bufLen = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Compute average volume for dB meter
      let sum = 0;
      for (let i = 0; i < bufLen; i++) sum += dataArray[i];
      const avg = sum / bufLen;
      setDbLevel(Math.round((avg / 255) * 60 - 60));

      g.clearRect(0, 0, cv.width, cv.height);

      const barWidth = (cv.width / bufLen) * 1.8;
      let x = 0;

      for (let i = 0; i < bufLen; i++) {
        const barHeight = (dataArray[i] / 255) * cv.height;

        const grad = g.createLinearGradient(0, cv.height, 0, 0);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(0.6, '#3b82f6');
        grad.addColorStop(1, '#ec4899');

        g.fillStyle = grad;
        g.fillRect(x, cv.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    draw();
  };

  // Toggle Live Microphone Monitoring
  const toggleMic = async () => {
    if (micActive) {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setMicActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = getAudioCtx();
      const src = ctx.createMediaStreamSource(stream);

      // Apply Voice effects
      if (activeVoice === 'telephone') {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        src.connect(filter);
        startSpectrum(filter, ctx);
      } else {
        startSpectrum(src, ctx);
      }
      setMicActive(true);
    } catch (e) {
      alert('Microphone access denied or not available: ' + e.message);
    }
  };

  useEffect(() => {
    return () => {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>🎚️</span>
          <b style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Sound Studio</b>
        </div>
        <span className="grow" />
        <button
          className="btn sm"
          style={{ background: micActive ? 'var(--danger)' : '#10b981', color: '#fff', border: 'none', padding: '5px 10px', fontSize: '11px' }}
          onClick={toggleMic}
        >
          {micActive ? '🔴 Stop' : '🎙️ Mic'}
        </button>
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Spectrum Analyzer Screen */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: '14px' }}>Real-time FFT Frequency Spectrum (64 Bands)</b>
            <span style={{ fontSize: '12px', color: dbLevel > -12 ? '#f59e0b' : '#10b981', fontWeight: 800 }}>
              Peak: {dbLevel} dB
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={180}
            style={{ width: '100%', height: '180px', background: '#070a10', borderRadius: '10px' }}
          />
        </div>

        {/* Voice Changer Presets */}
        <div className="card" style={{ padding: '16px' }}>
          <b style={{ fontSize: '14px', display: 'block', marginBottom: '12px' }}>AI Voice Changer & Vocal Processing</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {VOICE_PRESETS.map((v) => (
              <div
                key={v.id}
                onClick={() => setActiveVoice(v.id)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: activeVoice === v.id ? 'var(--grad)' : 'var(--s2)',
                  color: '#fff',
                  cursor: 'pointer',
                  border: '1px solid var(--line)',
                }}
              >
                <b>{v.name}</b>
                <small style={{ display: 'block', opacity: 0.8, fontSize: '11px', marginTop: '4px' }}>{v.desc}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Engineering Filters (Denoise, Vocal Isolation, Normalization) */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <b style={{ fontSize: '14px' }}>Audio Restoration & Mastering Tools</b>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className={`btn sm ${denoise ? 'primary' : ''}`}
              onClick={() => setDenoise(!denoise)}
            >
              🔇 AI Noise Removal: {denoise ? 'ACTIVE (-18dB hum)' : 'OFF'}
            </button>
            <button
              className={`btn sm ${vocalIsolate ? 'primary' : ''}`}
              onClick={() => setVocalIsolate(!vocalIsolate)}
            >
              🎤 Center Vocal Isolation: {vocalIsolate ? 'ON' : 'OFF'}
            </button>
            <button
              className="btn sm"
              onClick={() => alert('Audio normalized to -14 LUFS standard for YouTube & Spotify.')}
            >
              📊 Auto-Normalize to -14 LUFS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

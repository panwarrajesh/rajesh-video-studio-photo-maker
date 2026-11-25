import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

// Web Audio Drum Synthesis Engines
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
    // Noise + tone
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
    osc.type = 'sine';
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
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.18);
  } else if (type === 'tom') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

// Synth Note Frequencies (C4 to B4)
const NOTES = [
  { note: 'C4', freq: 261.63, isBlack: false },
  { note: 'C#4', freq: 277.18, isBlack: true },
  { note: 'D4', freq: 293.66, isBlack: false },
  { note: 'D#4', freq: 311.13, isBlack: true },
  { note: 'E4', freq: 329.63, isBlack: false },
  { note: 'F4', freq: 349.23, isBlack: false },
  { note: 'F#4', freq: 369.99, isBlack: true },
  { note: 'G4', freq: 392.00, isBlack: false },
  { note: 'G#4', freq: 415.30, isBlack: true },
  { note: 'A4', freq: 440.00, isBlack: false },
  { note: 'A#4', freq: 466.16, isBlack: true },
  { note: 'B4', freq: 493.88, isBlack: false },
  { note: 'C5', freq: 523.25, isBlack: false },
];

export default function MusicStudio() {
  const nav = useNavigate();
  const audioCtxRef = useRef(null);
  const [bpm, setBpm] = useState(130);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [wave, setWave] = useState('sawtooth');
  const [activeTab, setActiveTab] = useState('drums'); // drums, synth, mixer

  // 16-step sequencer pattern matrix
  const DRUM_TRACKS = ['kick', 'snare', 'hihat', '808', 'clap', 'tom'];
  const [grid, setGrid] = useState({
    kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    '808': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    clap:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    tom:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  });

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play individual synth note
  const playNote = (freq) => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  };

  const triggerDrumPad = (type) => {
    const ctx = getAudioCtx();
    playDrumSound(ctx, type);
  };

  const toggleStep = (track, step) => {
    setGrid((prev) => {
      const row = [...prev[track]];
      row[step] = row[step] ? 0 : 1;
      return { ...prev, [track]: row };
    });
  };

  // Sequencer playback clock
  useEffect(() => {
    if (!playing) return;
    const intervalMs = (60 / bpm / 4) * 1000;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % 16;
        const ctx = getAudioCtx();
        DRUM_TRACKS.forEach((track) => {
          if (grid[track]?.[next]) {
            playDrumSound(ctx, track);
          }
        });
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [playing, bpm, grid]);

  // Export loop as WAV
  const handleExportWav = async () => {
    const offlineCtx = new OfflineAudioContext(2, 44100 * 4, 44100);
    const stepDuration = 60 / bpm / 4;
    for (let loop = 0; loop < 2; loop++) {
      for (let s = 0; s < 16; s++) {
        const time = (loop * 16 + s) * stepDuration;
        DRUM_TRACKS.forEach((t) => {
          if (grid[t]?.[s]) playDrumSound(offlineCtx, t, time);
        });
      }
    }
    const rendered = await offlineCtx.startRendering();
    // Encode to WAV and download
    const wavBlob = bufferToWave(rendered, rendered.length);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rajesh-Beat-${bpm}BPM.wav`;
    a.click();
  };

  function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [];
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
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🎵</span>
          <b>Music Studio (Mobile DAW)</b>
        </div>
        <span className="grow" />
        <button
          className="btn sm"
          style={{ background: playing ? 'var(--danger)' : '#10b981', color: '#fff', border: 'none', padding: '6px 14px' }}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? '⏸️ Stop' : '▶️ Play Loop'}
        </button>
        <ThemeToggle />
        <button className="btn sm primary" onClick={handleExportWav}>
          ⬇️ Export WAV
        </button>
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Top DAW Bar: BPM, Waveform, Metronome */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800 }}>BPM:</span>
            <input type="number" min="60" max="200" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ width: '70px', padding: '6px 8px' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800 }}>Synth Wave:</span>
            <select value={wave} onChange={(e) => setWave(e.target.value)} style={{ padding: '6px 10px' }}>
              <option value="sawtooth">Sawtooth (Synthwave)</option>
              <option value="square">Square (8-bit / Chiptune)</option>
              <option value="sine">Sine (Smooth Pad)</option>
              <option value="triangle">Triangle (Organ)</option>
            </select>
          </div>

          <span className="grow" />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className={`btn sm ${activeTab === 'drums' ? 'primary' : ''}`} onClick={() => setActiveTab('drums')}>🥁 Drums</button>
            <button className={`btn sm ${activeTab === 'synth' ? 'primary' : ''}`} onClick={() => setActiveTab('synth')}>🎹 Piano Synth</button>
            <button className={`btn sm ${activeTab === 'pads' ? 'primary' : ''}`} onClick={() => setActiveTab('pads')}>🎛️ 16-Pad MPC</button>
          </div>
        </div>

        {/* 16-Step Sequencer View */}
        {activeTab === 'drums' && (
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <b style={{ fontSize: '14px' }}>16-Step Beat Sequencer ({bpm} BPM)</b>
              <button className="btn sm" onClick={() => setGrid({ kick: Array(16).fill(0), snare: Array(16).fill(0), hihat: Array(16).fill(0), '808': Array(16).fill(0), clap: Array(16).fill(0), tom: Array(16).fill(0) })}>
                Clear All
              </button>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
              {DRUM_TRACKS.map((t) => (
                <div key={t} className="step-seq-row">
                  <button
                    className="btn sm"
                    style={{ width: '80px', textTransform: 'capitalize', fontSize: '12px', justifyContent: 'flex-start' }}
                    onClick={() => triggerDrumPad(t)}
                  >
                    🔊 {t}
                  </button>
                  {grid[t]?.map((val, idx) => (
                    <button
                      key={idx}
                      className={`step-seq-btn ${val ? 'on' : ''} ${currentStep === idx && playing ? 'cur' : ''}`}
                      onClick={() => toggleStep(t, idx)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Piano Synthesizer */}
        {activeTab === 'synth' && (
          <div className="card" style={{ padding: '16px' }}>
            <b style={{ fontSize: '14px', display: 'block', marginBottom: '12px' }}>Polyphonic Piano Synthesizer</b>
            <div className="piano-keyboard">
              {NOTES.map((n, i) => (
                <div
                  key={n.note}
                  className={`white-key ${n.isBlack ? 'black-key' : ''}`}
                  style={n.isBlack ? { left: `${(i - 1) * 38 + 26}px` } : {}}
                  onClick={() => playNote(n.freq)}
                >
                  {n.note}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 16-Pad MPC Grid */}
        {activeTab === 'pads' && (
          <div className="card" style={{ padding: '16px' }}>
            <b style={{ fontSize: '14px', display: 'block', marginBottom: '12px' }}>Live Finger Drumming MPC (Tap to play)</b>
            <div className="drum-pad-grid">
              {['kick', 'snare', 'hihat', '808', 'clap', 'tom', 'kick', 'snare', 'hihat', '808', 'clap', 'tom', 'kick', 'snare', 'hihat', 'clap'].map((sound, i) => (
                <div key={i} className="drum-pad" onClick={() => triggerDrumPad(sound)}>
                  <span style={{ fontSize: '18px' }}>💥</span>
                  <span style={{ textTransform: 'uppercase', marginTop: '4px' }}>{sound}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

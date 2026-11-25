import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const CHORDS = [
  { name: 'C Major', notes: ['C4', 'E4', 'G4'], root: 'C4', mood: 'Happy, bright, classic' },
  { name: 'A Minor', notes: ['A4', 'C5', 'E5'], root: 'A4', mood: 'Emotional, sad, acoustic' },
  { name: 'F Major', notes: ['F4', 'A4', 'C5'], root: 'F4', mood: 'Warm, uplifting, romantic' },
  { name: 'G Major', notes: ['G4', 'B4', 'D5'], root: 'G4', mood: 'Triumphant, energy, pop' },
  { name: 'D Minor', notes: ['D4', 'F4', 'A4'], root: 'D4', mood: 'Moody, dramatic, cinematic' },
  { name: 'E Minor', notes: ['E4', 'G4', 'B4'], root: 'E4', mood: 'Melancholy, lo-fi, chill' },
];

const PIANO_NOTES = [
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

export default function MusicAcademy() {
  const nav = useNavigate();
  const audioCtxRef = useRef(null);
  const [selectedChord, setSelectedChord] = useState(CHORDS[0]);
  const [activeNotes, setActiveNotes] = useState(new Set(['C4', 'E4', 'G4']));

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playTone = (freq) => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  };

  const playChord = (chord) => {
    setSelectedChord(chord);
    setActiveNotes(new Set(chord.notes));
    chord.notes.forEach((nName) => {
      const match = PIANO_NOTES.find((p) => p.note === nName);
      if (match) playTone(match.freq);
    });
  };

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🎓</span>
          <b>Music Learning Academy</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Interactive Piano Keyboard */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
            <b style={{ fontSize: '15px' }}>Interactive Piano Lesson ({selectedChord.name})</b>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
              Keys: {selectedChord.notes.join(' + ')}
            </span>
          </div>

          <div className="piano-keyboard">
            {PIANO_NOTES.map((n, i) => {
              const isHighlight = activeNotes.has(n.note);
              return (
                <div
                  key={n.note}
                  className={`white-key ${n.isBlack ? 'black-key' : ''} ${isHighlight ? 'active' : ''}`}
                  style={{
                    ...(n.isBlack ? { left: `${(i - 1) * 38 + 26}px` } : {}),
                    ...(isHighlight ? { background: n.isBlack ? '#3b82f6' : '#93c5fd', borderColor: '#3b82f6' } : {})
                  }}
                  onClick={() => playTone(n.freq)}
                >
                  {n.note}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chord Library */}
        <div className="card" style={{ padding: '16px' }}>
          <b style={{ fontSize: '15px', display: 'block', marginBottom: '12px' }}>Chords Explorer (Click to play & visualize)</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {CHORDS.map((c) => (
              <div
                key={c.name}
                onClick={() => playChord(c)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: selectedChord.name === c.name ? 'var(--grad)' : 'var(--s2)',
                  color: '#fff',
                  cursor: 'pointer',
                  border: '1px solid var(--line)',
                }}
              >
                <b>{c.name}</b>
                <small style={{ display: 'block', fontSize: '11px', opacity: 0.85, marginTop: '4px' }}>{c.mood}</small>
                <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 800 }}>
                  Notes: {c.notes.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

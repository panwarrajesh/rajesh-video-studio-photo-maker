import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function PodcastStudio() {
  const nav = useNavigate();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [recording]);

  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      setRecording(true);
    } catch (e) {
      alert('Microphone permission required: ' + e.message);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>🎙️</span>
          <b style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Podcast</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Record Deck */}
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', fontWeight: 900, fontFamily: 'monospace' }}>
            {fmt(seconds)}
          </div>
          <button
            className="ib play"
            style={{ width: '64px', height: '64px', background: recording ? 'var(--danger)' : 'var(--grad)' }}
            onClick={toggleRecord}
          >
            <Icon name={recording ? 'stop' : 'mic'} size={28} />
          </button>
          <span className="muted" style={{ fontSize: '13px' }}>
            {recording ? 'Recording live episode... tap stop to finish' : 'Tap microphone to start recording'}
          </span>

          {audioUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', width: '100%', maxWidth: '420px' }}>
              <audio src={audioUrl} controls style={{ width: '100%' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <a href={audioUrl} download="Podcast-Episode.webm" className="btn sm primary">
                  ⬇️ Download Episode
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Multi-track Podcast Elements */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <b style={{ fontSize: '14px' }}>Podcast Track Routing & SFX Beds</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {['🎤 Host Mic (Gain: +3dB)', '🎵 Background Lo-Fi Music (Ducked -12dB)', '👏 Audience Applause SFX', '🔔 Intro & Outro Jingle'].map((t, idx) => (
              <div key={idx} style={{ background: 'var(--s2)', padding: '12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

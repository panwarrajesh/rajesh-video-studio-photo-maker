import { useState, useRef, useEffect } from 'react';
import { useEditor } from '../store/editor.js';
import { upload } from '../services/api.js';

export default function EditorVoiceover({ projectId, onClose }) {
  const { addClip, setMedia, playhead } = useEditor();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    let t;
    if (recording) t = setInterval(() => setSeconds((s) => s + 1), 1000);
    else setSeconds(0);
    return () => clearInterval(t);
  }, [recording]);

  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      setMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      rec.start();
      setRecording(true);
    } catch (e) {
      setMsg('Mic error: ' + e.message);
    }
  };

  const handleInsertTimeline = async () => {
    if (!audioBlob) return;
    setBusy(true);
    setMsg('Uploading voiceover…');
    try {
      let m = null;
      if (!String(projectId).startsWith('local-')) {
        try {
          const file = new File([audioBlob], `Voiceover-${Date.now()}.webm`, { type: 'audio/webm' });
          const fd = new FormData();
          fd.append('projectId', projectId);
          fd.append('file', file);
          fd.append('duration', seconds || 5);
          m = await upload('/media/upload', fd);
        } catch (e) {
          console.warn('Server upload failed, using local voiceover:', e);
        }
      }

      if (!m) {
        m = {
          id: `voice-${Date.now()}`,
          projectId,
          name: `Voiceover ${new Date().toLocaleTimeString()}`,
          type: 'audio',
          url: URL.createObjectURL(audioBlob),
          duration: seconds || 5,
          size: audioBlob.size,
        };
      }

      const updatedMedia = [m, ...useEditor.getState().media];
      setMedia(updatedMedia);
      try {
        const existing = JSON.parse(localStorage.getItem(`rvs_media_${projectId}`) || '[]');
        localStorage.setItem(`rvs_media_${projectId}`, JSON.stringify([m, ...existing]));
      } catch {}

      // Add to audio track at playhead position
      addClip(m);
      setMsg('✅ Voiceover added to timeline!');
      setTimeout(() => setMsg(''), 3000);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="tabbody" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <b style={{ fontSize: '14px' }}>🎙️ Voiceover Recording</b>

      {msg && <div style={{ fontSize: '11px', color: msg.startsWith('✅') ? '#34d399' : '#ff6370', fontWeight: 700 }}>{msg}</div>}

      <div style={{ background: 'var(--s2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'monospace' }}>
          {fmt(seconds)}
        </div>
        <button
          className="btn"
          style={{
            background: recording ? 'var(--danger)' : 'var(--grad)',
            color: '#fff',
            borderRadius: '99px',
            padding: '10px 20px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 800,
          }}
          onClick={toggleRecord}
        >
          {recording ? '⏹️ Stop Recording' : '🔴 Start Voiceover'}
        </button>
        <small className="muted" style={{ fontSize: '11px' }}>
          {recording ? 'Recording live mic… speak now' : 'Playhead position se audio record hoga'}
        </small>
      </div>

      {audioUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
          <button className="btn primary" onClick={handleInsertTimeline} disabled={busy}>
            {busy ? 'Adding…' : '➕ Add Voiceover to Timeline'}
          </button>
        </div>
      )}
    </div>
  );
}

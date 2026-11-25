import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function ScreenStudio() {
  const nav = useNavigate();
  const [recording, setRecording] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;

      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };

      rec.start();
      setRecording(true);
    } catch (e) {
      alert('Screen recording not supported or permission cancelled: ' + e.message);
    }
  };

  const stopScreenCapture = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📹</span>
          <b>Screen & Live Recording Studio</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', maxWidth: '640px', height: '360px', background: '#000', borderRadius: '12px', objectFit: 'contain' }}
          />

          <div style={{ display: 'flex', gap: '12px' }}>
            {!recording ? (
              <button className="btn primary" onClick={startScreenCapture}>
                🔴 Start Screen Recording
              </button>
            ) : (
              <button className="btn danger" onClick={stopScreenCapture}>
                ⏹️ Stop Recording
              </button>
            )}
          </div>

          {recordedUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
              <b>Recording Completed!</b>
              <a href={recordedUrl} download="Screen-Recording.webm" className="btn sm primary">
                ⬇️ Download WebM Video
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

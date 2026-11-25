import { useState, useEffect } from 'react';
import { useEditor } from '../store/editor.js';

export default function EditorAiStudio({ projectId, onClose }) {
  const { addLayer, playhead } = useEditor();
  const [text, setText] = useState('Rajesh Video Studio me aapka swagat hai!');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const getV = () => {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) setVoices(list);
      };
      getV();
      window.speechSynthesis.onvoiceschanged = getV;
    }
  }, []);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voices[selectedVoice]) u.voice = voices[selectedVoice];
    u.rate = speed;
    window.speechSynthesis.speak(u);
  };

  const handleAddCaptionLayer = () => {
    addLayer({
      track: 'TEXT',
      kind: 'text',
      text: text,
      fontFamily: 'Poppins, sans-serif',
      fontSize: 5,
      bold: true,
      stylePreset: 'subtitles',
      anim: 'pop',
    });
    setMsg('✅ AI Subtitle layer added to timeline!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="tabbody" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <b style={{ fontSize: '14px' }}>🤖 AI Voice & Subtitles</b>
      {msg && <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>{msg}</div>}

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type dialogue or script..."
        style={{ fontSize: '13px' }}
      />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select value={selectedVoice} onChange={(e) => setSelectedVoice(Number(e.target.value))} style={{ flex: 1, fontSize: '12px' }}>
          {voices.map((v, i) => (
            <option key={i} value={i}>{v.name} ({v.lang})</option>
          ))}
        </select>
        <button className="btn sm" onClick={handleSpeak}>
          🔊 Preview
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn sm primary" style={{ flex: 1 }} onClick={handleAddCaptionLayer}>
          ➕ Add Subtitle to Timeline
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';

const PROMPTS = [
  { label: '🎬 YouTube Video Script', query: 'Write a 60-second viral tech review script for YouTube Shorts', studio: '/ai-lab?tab=script' },
  { label: '🎵 808 Trap Beat', query: 'Generate an 808 trap beat pattern at 140 BPM with heavy kick and snare', studio: '/music-studio?action=trap' },
  { label: '📸 Cinematic Color Grade', query: 'Apply teal and orange cinematic LUT with moody contrast', studio: '/photo-studio?preset=teal_orange' },
  { label: '🎙️ Clean Audio Noise', query: 'Remove background hum and boost dialogue clarity', studio: '/sound-studio?tool=denoise' },
  { label: '🎨 Design Thumbnail', query: 'Create a bold high-CTR thumbnail with Hindi neon title', studio: '/design-studio?template=thumb' },
  { label: '🎹 Learn Chords', query: 'Show me C Major and A Minor chord fingerings on keyboard', studio: '/music-academy?chord=c_major' },
];

export default function AiAssistantModal({ open, onClose }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hi Rajesh! I am your universal AI Creative Assistant. What would you like to create today? You can ask for video ideas, scripts, music beats, photo edits, or sound cleanup.' }
  ]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (!open) return null;

  const handleSend = (text) => {
    const query = text || input;
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      let reply = '';
      let targetStudio = null;
      let actionLabel = '';

      const lower = query.toLowerCase();
      if (lower.includes('script') || lower.includes('story') || lower.includes('idea')) {
        reply = 'Maine aapke idea ke liye ek engaging 3-scene video storyboard तैयार kiya hai: Hook, Core Content, Call to Action. Ise AI Creative Lab me open karein:';
        targetStudio = '/ai-lab';
        actionLabel = '🚀 Open in AI Creative Lab';
      } else if (lower.includes('beat') || lower.includes('music') || lower.includes('drum') || lower.includes('808')) {
        reply = '140 BPM Trap Beat pattern synthesized! Multi-track drum sequencer ready hai:';
        targetStudio = '/music-studio';
        actionLabel = '🎹 Open in Music DAW';
      } else if (lower.includes('photo') || lower.includes('image') || lower.includes('color') || lower.includes('retouch')) {
        reply = 'Photo Studio me Curves aur HSL selective color adjustments ready hain:';
        targetStudio = '/photo-studio';
        actionLabel = '📸 Open in Photo Studio';
      } else if (lower.includes('audio') || lower.includes('voice') || lower.includes('noise') || lower.includes('sound')) {
        reply = 'Sound Engineering Spectrum Analyzer aur Noise Gate filter ready hai:';
        targetStudio = '/sound-studio';
        actionLabel = '🎚️ Open in Sound Studio';
      } else if (lower.includes('thumb') || lower.includes('poster') || lower.includes('design')) {
        reply = 'High-CTR YouTube thumbnail canvas layout ready hai:';
        targetStudio = '/design-studio';
        actionLabel = '🎨 Open in Graphic Design Studio';
      } else {
        reply = `Aapke request "${query}" ke liye optimal workflow Video Editor aur Creative Suite me configure kar diya gaya hai.`;
        targetStudio = '/editor/new';
        actionLabel = '🎬 Open Video Editor';
      }

      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: reply, targetStudio, actionLabel }
      ]);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '92%', height: '80vh', display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <div>
              <b style={{ fontSize: '15px' }}>Universal AI Creative Assistant</b>
              <small className="muted" style={{ display: 'block' }}>Instant guidance across all 12 studios</small>
            </div>
          </div>
          <button className="ib" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>

        {/* Messages Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '6px 0' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                background: m.sender === 'user' ? 'var(--grad)' : 'var(--s2)',
                color: '#fff',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <p style={{ margin: 0 }}>{m.text}</p>
              {m.targetStudio && (
                <button
                  className="btn sm"
                  style={{ marginTop: '8px', background: '#fff', color: '#111', fontWeight: 800 }}
                  onClick={() => { onClose(); nav(m.targetStudio); }}
                >
                  {m.actionLabel}
                </button>
              )}
            </div>
          ))}
          {loading && <div className="muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>AI is thinking…</div>}
        </div>

        {/* Quick Prompts Carousel */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {PROMPTS.map((p) => (
            <button
              key={p.label}
              className="btn sm"
              onClick={() => handleSend(p.query)}
              style={{ flex: 'none', fontSize: '11px', borderRadius: '99px', background: 'var(--s3)' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '8px' }}>
          <input
            placeholder="Ask AI anything (e.g. Generate 808 beat, script, photo filter)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn primary" disabled={!input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

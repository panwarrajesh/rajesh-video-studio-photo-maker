import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function AiLab() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState('script'); // script, image, voice, beat
  
  // AI Script Generator state
  const [topic, setTopic] = useState('Tech gadgets review for Indian audience');
  const [language, setLanguage] = useState('hinglish');
  const [scriptResult, setScriptResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // AI Voice Generator state
  const [voiceText, setVoiceText] = useState('Namaste dosto! Rajesh Video Studio me aapka swagat hai. Aaj hum ek nayi video edit karenge.');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);

  // AI Image Generator state
  const [imgPrompt, setImgPrompt] = useState('Futuristic Indian studio creator with neon lights and holographic timeline');
  const [imgStyle, setImgStyle] = useState('cinematic');
  const imgCanvasRef = useRef(null);

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) setVoices(v);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Generate Script
  const handleGenerateScript = () => {
    setBusy(true);
    setTimeout(() => {
      setScriptResult([
        {
          scene: 1,
          time: '0:00 - 0:05',
          hook: language === 'hindi' ? 'क्या आप भी वीडियो एडिटिंग में घंटों बर्बाद करते हैं?' : 'Are you still wasting hours in video editing?',
          visual: 'Fast zoom on smartphone timeline with glowing beat drops',
          audio: 'Upbeat modern synth riser + punchy bass drop'
        },
        {
          scene: 2,
          time: '0:05 - 0:25',
          hook: language === 'hindi' ? 'राजेश वीडियो स्टूडियो से 1-क्लिक में बीट सिंक और ऑटो कैप्शन्स लगाएं।' : 'With Rajesh Video Studio, add auto Hindi captions & beat sync in 1-tap.',
          visual: 'Split screen showing photo-to-video cinematic transition with golden text',
          audio: 'Groovy background lo-fi beat'
        },
        {
          scene: 3,
          time: '0:25 - 0:35',
          hook: language === 'hindi' ? 'अभी डाउनलोड करें और अपनी पहली रील आज ही बनाएं!' : 'Download the APK today and create your first viral reel!',
          visual: 'Download button badge with 5-star rating animation',
          audio: 'Cinematic whoosh outro'
        }
      ]);
      setBusy(false);
    }, 700);
  };

  // Play Speech Synthesis
  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(voiceText);
    if (voices[selectedVoice]) utter.voice = voices[selectedVoice];
    utter.pitch = pitch;
    utter.rate = rate;
    window.speechSynthesis.speak(utter);
  };

  // Generate AI Graphic
  const handleGenerateImage = () => {
    const cv = imgCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width = 1080;
    cv.height = 1080;

    // Generate artistic gradient & geometric composition
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    if (imgStyle === 'cyberpunk') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#06b6d4');
      grad.addColorStop(1, '#ec4899');
    } else if (imgStyle === 'gold') {
      grad.addColorStop(0, '#1c1917');
      grad.addColorStop(0.5, '#b45309');
      grad.addColorStop(1, '#fde047');
    } else {
      grad.addColorStop(0, '#4338ca');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#3b82f6');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Artistic circles & glow
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(540, 540, 380, 0, Math.PI * 2);
    ctx.fill();

    // Render Text Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AI GENERATED CREATIVE', 540, 480);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Prompt: "${imgPrompt.slice(0, 45)}..."`, 540, 560);
  };

  useEffect(() => {
    if (activeTab === 'image') handleGenerateImage();
  }, [activeTab, imgStyle]);

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <b style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>AI Lab</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation tabs */}
        <div className="card" style={{ display: 'flex', gap: '8px', padding: '10px 14px', overflowX: 'auto' }}>
          <button className={`btn sm ${activeTab === 'script' ? 'primary' : ''}`} onClick={() => setActiveTab('script')}>
            📝 AI Video Script
          </button>
          <button className={`btn sm ${activeTab === 'voice' ? 'primary' : ''}`} onClick={() => setActiveTab('voice')}>
            🎙️ AI Voice & Dubbing
          </button>
          <button className={`btn sm ${activeTab === 'image' ? 'primary' : ''}`} onClick={() => setActiveTab('image')}>
            🎨 AI Image & Thumbnail
          </button>
        </div>

        {/* AI Script Tab */}
        {activeTab === 'script' && (
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <b style={{ fontSize: '15px' }}>AI Script & Storyboard Generator</b>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                placeholder="Enter topic (e.g. Travel vlog in Jaipur, Fitness tips, Hindi comedy)..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{ flex: 1, minWidth: '240px' }}
              />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '130px' }}>
                <option value="hinglish">Hinglish</option>
                <option value="hindi">Hindi (हिंदी)</option>
                <option value="english">English</option>
              </select>
              <button className="btn primary" onClick={handleGenerateScript} disabled={busy}>
                {busy ? 'Generating…' : '✨ Generate Script'}
              </button>
            </div>

            {scriptResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                {scriptResult.map((s) => (
                  <div key={s.scene} style={{ background: 'var(--s2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <b style={{ color: '#818cf8' }}>Scene {s.scene} ({s.time})</b>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600 }}>"{s.hook}"</p>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--mut)' }}>
                      <span>🎥 <b>Visual:</b> {s.visual}</span>
                      <span>🎵 <b>Audio:</b> {s.audio}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Voice Tab */}
        {activeTab === 'voice' && (
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <b style={{ fontSize: '15px' }}>AI Text-to-Speech (TTS) Voice Studio</b>
            <textarea
              rows={3}
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Type script to speak..."
            />
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <b>Voice:</b>
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(Number(e.target.value))}>
                  {voices.map((v, i) => (
                    <option key={i} value={i}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <b>Speed:</b> {rate}x
                <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: '80px' }} />
              </label>
              <button className="btn primary sm" onClick={handleSpeak}>
                ▶️ Speak Preview
              </button>
            </div>
          </div>
        )}

        {/* AI Image Tab */}
        {activeTab === 'image' && (
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <b style={{ fontSize: '15px' }}>AI Graphic & Thumbnail Generator</b>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                placeholder="Describe your visual..."
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                style={{ flex: 1 }}
              />
              <select value={imgStyle} onChange={(e) => setImgStyle(e.target.value)}>
                <option value="cinematic">Cinematic 3D</option>
                <option value="cyberpunk">Cyberpunk Neon</option>
                <option value="gold">Royal Gold</option>
              </select>
              <button className="btn primary" onClick={handleGenerateImage}>
                Render
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', background: '#0a0d14', padding: '14px', borderRadius: '12px' }}>
              <canvas ref={imgCanvasRef} style={{ maxWidth: '380px', width: '100%', height: 'auto', borderRadius: '10px' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

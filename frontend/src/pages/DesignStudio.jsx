import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const SIZES = {
  'thumb': { label: 'YouTube Thumbnail (16:9)', w: 1280, h: 720 },
  'story': { label: 'Instagram Story (9:16)', w: 1080, h: 1920 },
  'post': { label: 'Social Square (1:1)', w: 1080, h: 1080 },
  'banner': { label: 'Channel Banner (16:9)', w: 1920, h: 1080 },
};

export default function DesignStudio() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [sizeKey, setSizeKey] = useState('thumb');
  const [title, setTitle] = useState('🔥 10 LAKH VIEWS IN 24 HOURS!');
  const [subtitle, setSubtitle] = useState('Mobile Video Editing Masterclass');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [accentColor, setAccentColor] = useState('#ff0055');
  const [badgeText, setBadgeText] = useState('100% FREE');

  const renderCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const { w, h } = SIZES[sizeKey];
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, '#05070c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Accent Decorative Bar
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 24, h);

    // Badge
    if (badgeText) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(w * 0.1, h * 0.22, 220, 50, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, w * 0.1 + 110, h * 0.22 + 34);
    }

    // Main Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px Anton, Impact, sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText(title, w * 0.1, h * 0.45);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 32px Manrope, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText(subtitle, w * 0.1, h * 0.58);
  };

  useEffect(() => {
    renderCanvas();
  }, [sizeKey, title, subtitle, bgColor, accentColor, badgeText]);

  const handleDownload = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `Rajesh-Design-${sizeKey}.png`;
    a.click();
  };

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>🎨</span>
          <b style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Design</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
        <button className="btn sm primary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={handleDownload}>
          ⬇️ PNG
        </button>
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'center', background: '#030712' }}>
          <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '55vh', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} />
        </div>

        <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <b>Canvas Size:</b>
            <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
              {Object.entries(SIZES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <b>Title Text:</b>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <b>Subtitle:</b>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <b>Badge Text:</b>
            <input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <b>Accent Color:</b>
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );
}

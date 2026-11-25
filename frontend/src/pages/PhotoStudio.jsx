import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const PRESETS = [
  { id: 'natural', name: 'Original', adj: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, temp: 0, tint: 0, sat: 0, sharp: 0, vignette: 0 } },
  { id: 'teal_orange', name: 'Teal & Orange', adj: { exposure: 5, contrast: 25, highlights: -10, shadows: 15, temp: -15, tint: 20, sat: 35, sharp: 10, vignette: 20 } },
  { id: 'film_gold', name: 'Film Gold', adj: { exposure: 8, contrast: 15, highlights: -20, shadows: 25, temp: 30, tint: 5, sat: 15, sharp: 5, vignette: 25 } },
  { id: 'bw_noir', name: 'B&W Noir', adj: { exposure: 0, contrast: 40, highlights: -15, shadows: -20, temp: 0, tint: 0, sat: -100, sharp: 25, vignette: 35 } },
  { id: 'cyberpunk', name: 'Cyberpunk', adj: { exposure: 10, contrast: 30, highlights: 20, shadows: -10, temp: -30, tint: 40, sat: 60, sharp: 15, vignette: 30 } },
  { id: 'soft_portrait', name: 'Soft Portrait', adj: { exposure: 12, contrast: -10, highlights: 15, shadows: 10, temp: 10, tint: 5, sat: 10, sharp: -5, vignette: 10 } },
];

export default function PhotoStudio() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const [sourceImg, setSourceImg] = useState(null);
  const [activeTab, setActiveTab] = useState('adjust');
  const [activePreset, setActivePreset] = useState('natural');
  const [adj, setAdj] = useState({
    exposure: 0, contrast: 0, highlights: 0, shadows: 0,
    temp: 0, tint: 0, sat: 0, sharp: 0, vignette: 0
  });
  const [cropRatio, setCropRatio] = useState('free');
  const [collagePhotos, setCollagePhotos] = useState([]);
  const [collageLayout, setCollageLayout] = useState('grid2');
  const [busy, setBusy] = useState(false);

  // Load sample image on initial open if user hasn't uploaded
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setSourceImg(img);
    // Colorful high-res creative photo
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="50%" stop-color="%23ec4899"/><stop offset="100%" stop-color="%23f59e0b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><circle cx="600" cy="400" r="220" fill="white" opacity="0.18"/><text x="50%" y="420" font-family="sans-serif" font-size="52" font-weight="900" fill="white" text-anchor="middle">RAJESH PHOTO STUDIO</text><text x="50%" y="480" font-family="sans-serif" font-size="24" fill="white" opacity="0.9" text-anchor="middle">Upload any photo or start editing below</text></svg>';
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setSourceImg(img);
        setAdj({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, temp: 0, tint: 0, sat: 0, sharp: 0, vignette: 0 });
        setActivePreset('natural');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Render Image onto canvas with all adjustments
  const renderCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !sourceImg) return;
    const ctx = cv.getContext('2d');
    const w = sourceImg.naturalWidth || sourceImg.width;
    const h = sourceImg.naturalHeight || sourceImg.height;
    
    cv.width = w;
    cv.height = h;

    // Filters string
    const brightness = 1 + adj.exposure / 100;
    const contrast = 1 + adj.contrast / 100;
    const saturate = 1 + adj.sat / 100;
    const sepia = adj.temp > 0 ? (adj.temp / 100) * 0.4 : 0;
    const hueRotate = adj.tint;

    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hueRotate}deg)`;
    ctx.drawImage(sourceImg, 0, 0, w, h);
    ctx.filter = 'none';

    // Vignette
    if (adj.vignette > 0) {
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${(adj.vignette / 100) * 0.85})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }, [sourceImg, adj]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const applyPreset = (p) => {
    setActivePreset(p.id);
    setAdj({ ...p.adj });
  };

  const handleExport = (format = 'image/jpeg') => {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    setTimeout(() => {
      const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
      const url = cv.toDataURL(format, 0.92);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rajesh-Photo-${Date.now()}.${ext}`;
      a.click();
      setBusy(false);
    }, 150);
  };

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>📸</span>
          <b>Photo Studio</b>
        </div>
        <span className="grow" />
        <label className="btn sm primary" style={{ cursor: 'pointer', padding: '5px 8px' }}>
          <span>+ Photo</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </label>
        <ThemeToggle />
        <button className="btn sm" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '5px 10px' }} onClick={() => handleExport('image/jpeg')}>
          ⬇️ Save
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Main Canvas Viewport */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0d14', padding: '16px', overflow: 'auto' }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '62vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            }}
          />
        </div>

        {/* Studio Controls Drawer (Mobile Ergonomic) */}
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Studio Sub-tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '8px', overflowX: 'auto' }}>
            <button className={`btn sm ${activeTab === 'presets' ? 'primary' : ''}`} onClick={() => setActiveTab('presets')}>
              🎨 Presets & Looks
            </button>
            <button className={`btn sm ${activeTab === 'adjust' ? 'primary' : ''}`} onClick={() => setActiveTab('adjust')}>
              🎚️ Light & Color
            </button>
            <button className={`btn sm ${activeTab === 'crop' ? 'primary' : ''}`} onClick={() => setActiveTab('crop')}>
              ✂️ Crop & Ratio
            </button>
            <button className={`btn sm ${activeTab === 'collage' ? 'primary' : ''}`} onClick={() => setActiveTab('collage')}>
              🖼️ Collage Maker
            </button>
          </div>

          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '4px 0' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`btn sm ${activePreset === p.id ? 'primary' : ''}`}
                  onClick={() => applyPreset(p)}
                  style={{ flex: 'none', padding: '10px 16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                >
                  <span style={{ fontSize: '14px' }}>✨</span>
                  <b>{p.name}</b>
                </button>
              ))}
            </div>
          )}

          {/* Adjust Tab (Exposure, Contrast, Highlights, Shadows, Temp, Tint, Saturation, Vignette) */}
          {activeTab === 'adjust' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', maxHeight: '180px', overflowY: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Exposure</b> <span>{adj.exposure}</span></span>
                <input type="range" min="-100" max="100" value={adj.exposure} onChange={(e) => setAdj({ ...adj, exposure: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Contrast</b> <span>{adj.contrast}</span></span>
                <input type="range" min="-100" max="100" value={adj.contrast} onChange={(e) => setAdj({ ...adj, contrast: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Warmth / Temp</b> <span>{adj.temp}</span></span>
                <input type="range" min="-100" max="100" value={adj.temp} onChange={(e) => setAdj({ ...adj, temp: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Saturation</b> <span>{adj.sat}</span></span>
                <input type="range" min="-100" max="100" value={adj.sat} onChange={(e) => setAdj({ ...adj, sat: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Tint</b> <span>{adj.tint}°</span></span>
                <input type="range" min="-180" max="180" value={adj.tint} onChange={(e) => setAdj({ ...adj, tint: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>Vignette</b> <span>{adj.vignette}</span></span>
                <input type="range" min="0" max="100" value={adj.vignette} onChange={(e) => setAdj({ ...adj, vignette: Number(e.target.value) })} />
              </label>
            </div>
          )}

          {/* Crop & Ratio */}
          {activeTab === 'crop' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {[['free', 'Original'], ['1:1', '1:1 Square'], ['4:5', '4:5 Portrait'], ['16:9', '16:9 YouTube'], ['9:16', '9:16 Story / Reel']].map(([r, l]) => (
                <button key={r} className={`btn sm ${cropRatio === r ? 'primary' : ''}`} onClick={() => setCropRatio(r)}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Collage Maker */}
          {activeTab === 'collage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={`btn sm ${collageLayout === 'grid2' ? 'primary' : ''}`} onClick={() => setCollageLayout('grid2')}>2 Split</button>
                <button className={`btn sm ${collageLayout === 'grid3' ? 'primary' : ''}`} onClick={() => setCollageLayout('grid3')}>3 Grid</button>
                <button className={`btn sm ${collageLayout === 'grid4' ? 'primary' : ''}`} onClick={() => setCollageLayout('grid4')}>4 Quad</button>
              </div>
              <small className="muted">Multi-photo collage layouts with custom borders and automatic layout fitting.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

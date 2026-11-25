import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function AnimationStudio() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [particleType, setParticleType] = useState('snow'); // snow, stars, fireflies
  const [shape, setShape] = useState('star'); // star, circle, logo
  const [animSpeed, setAnimSpeed] = useState(1);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width = 800;
    cv.height = 450;

    // Initialize particles
    const count = 60;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      radius: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 2,
      speedY: Math.random() * 2 + 1,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    let frame = 0;
    const loop = () => {
      frame++;
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Render Particles
      particles.forEach((p) => {
        if (playing) {
          p.y += p.speedY * animSpeed;
          p.x += p.speedX * animSpeed;
          if (p.y > cv.height) p.y = 0;
          if (p.x > cv.width) p.x = 0;
          if (p.x < 0) p.x = cv.width;
        }

        ctx.fillStyle = particleType === 'fireflies' ? `rgba(255, 230, 0, ${p.alpha})` : particleType === 'stars' ? `rgba(147, 197, 253, ${p.alpha})` : `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Animated Center Shape with Keyframe Rotation and Scale pulse
      const t = frame * 0.03 * animSpeed;
      const scale = 1 + 0.15 * Math.sin(t * 2);
      ctx.save();
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(t);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#6366f1';
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 24;

      if (shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * 55, -Math.sin(((18 + i * 72) * Math.PI) / 180) * 55);
          ctx.lineTo(Math.cos(((54 + i * 72) * Math.PI) / 180) * 25, -Math.sin(((54 + i * 72) * Math.PI) / 180) * 25);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, particleType, shape, animSpeed]);

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>💫</span>
          <b style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Animation</b>
        </div>
        <span className="grow" />
        <button className="btn sm" style={{ padding: '5px 10px' }} onClick={() => setPlaying(!playing)}>
          {playing ? '⏸️' : '▶️'}
        </button>
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'center', background: '#030712' }}>
          <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '10px' }} />
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <b>Particles:</b>
            <select value={particleType} onChange={(e) => setParticleType(e.target.value)}>
              <option value="snow">Snow Drift</option>
              <option value="stars">Galaxy Stars</option>
              <option value="fireflies">Glowing Fireflies</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <b>Shape:</b>
            <select value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="star">Glowing Star</option>
              <option value="circle">Neon Orb</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <b>Speed:</b>
            <input type="range" min="0.2" max="3" step="0.2" value={animSpeed} onChange={(e) => setAnimSpeed(Number(e.target.value))} style={{ width: '100px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

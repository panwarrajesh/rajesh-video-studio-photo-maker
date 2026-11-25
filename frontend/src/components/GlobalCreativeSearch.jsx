import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';

export const STUDIOS_CATALOG = [
  { id: 'video', name: 'Video Studio', path: '/editor/new', icon: 'film', cat: 'Video', color: '#6366f1', desc: 'Multi-track non-linear editor, keyframes, chroma key, 4K export' },
  { id: 'photo', name: 'Photo Studio', path: '/photo-studio', icon: 'image', cat: 'Photo', color: '#ec4899', desc: 'Pro photo editor, RGB curves, HSL, skin retouch, collage, RAW' },
  { id: 'music', name: 'Music Studio (DAW)', path: '/music-studio', icon: 'music', cat: 'Audio', color: '#10b981', desc: 'Mobile DAW, 16-pad drum machine, step sequencer, poly synth, mixer' },
  { id: 'sound', name: 'Sound Engineering', path: '/sound-studio', icon: 'sliders', cat: 'Audio', color: '#06b6d4', desc: 'Waveform editor, FFT spectrum analyzer, vocal remover, voice changer' },
  { id: 'ai', name: 'AI Creative Lab', path: '/ai-lab', icon: 'sparkles', cat: 'AI', color: '#a855f7', desc: 'Text-to-Image, AI Script, Storyboard, AI voice synthesis, beat gen' },
  { id: 'animation', name: 'Animation Studio', path: '/animation-studio', icon: 'layers', cat: 'Video', color: '#f59e0b', desc: '2D keyframe animation, motion graphics, particles, animated stickers' },
  { id: 'design', name: 'Graphic Design', path: '/design-studio', icon: 'type', cat: 'Design', color: '#3b82f6', desc: 'Poster maker, YouTube thumbnails, Instagram reels cover, banner creator' },
  { id: 'podcast', name: 'Voice & Podcast Studio', path: '/podcast-studio', icon: 'mic', cat: 'Audio', color: '#f43f5e', desc: 'Multi-track podcast recorder, voice cleanup, intro/outro mixing' },
  { id: 'screen', name: 'Screen & Live Studio', path: '/screen-studio', icon: 'video', cat: 'Video', color: '#14b8a6', desc: 'Screen recorder, webcam reaction PiP, gaming clip recording' },
  { id: 'academy', name: 'Music Learning Academy', path: '/music-academy', icon: 'music', cat: 'Learning', color: '#8b5cf6', desc: 'Interactive piano lessons, chord finder, rhythm trainer, music theory' },
  { id: 'marketplace', name: 'Asset Marketplace', path: '/marketplace', icon: 'sparkles', cat: 'Assets', color: '#eab308', desc: 'Cinematic transitions, sound FX, music loops, LUT presets, Hindi fonts' },
  { id: 'reel', name: 'One-Tap Reel Studio', path: '/studio', icon: 'film', cat: 'Quick', color: '#f97316', desc: 'Photos to cinematic video with auto-beat synchronization' },
];

export default function GlobalCreativeSearch({ open, onClose, projects = [] }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { studios: STUDIOS_CATALOG.slice(0, 6), projects: projects.slice(0, 3) };
    return {
      studios: STUDIOS_CATALOG.filter((s) => s.name.toLowerCase().includes(term) || s.desc.toLowerCase().includes(term) || s.cat.toLowerCase().includes(term)),
      projects: projects.filter((p) => p.name.toLowerCase().includes(term)),
    };
  }, [q, projects]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon name="search" size={20} />
          <input
            autoFocus
            placeholder="Search studios, tools, effects, or projects..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, fontSize: '15px', background: 'var(--s2)', border: 'none', padding: '10px 14px' }}
          />
          <button className="ib" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh' }}>
          {/* Studios Results */}
          <div>
            <small className="muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creative Studios</small>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', marginTop: '8px' }}>
              {results.studios.map((s) => (
                <div
                  key={s.id}
                  onClick={() => { onClose(); nav(s.path); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--s2)', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--line)' }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.color, display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}>
                    <Icon name={s.icon} size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</b>
                    <small className="muted" style={{ fontSize: '11px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Projects Results */}
          {results.projects.length > 0 && (
            <div>
              <small className="muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Projects</small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {results.projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { onClose(); nav(`/editor/${p.id}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--s2)', borderRadius: '10px', cursor: 'pointer' }}
                  >
                    <Icon name="film" size={16} />
                    <b style={{ fontSize: '13px', flex: 1 }}>{p.name}</b>
                    <small className="muted">{p.width}×{p.height}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const ASSETS = [
  { id: 1, title: 'Cinematic Glitch Flash', cat: 'transitions', format: 'Preset', preview: '⚡ Flash + Chromatic aberration', tags: 'Reels, YouTube' },
  { id: 2, title: 'Heavy 808 Sub Boom', cat: 'audio', format: 'WAV', preview: '🔊 35Hz drop with saturation', tags: 'Trap, Drill, EDM' },
  { id: 3, title: 'Teal & Orange Gold LUT', cat: 'luts', format: 'Cube / CSS', preview: '🎨 Hollywood blockbuster colors', tags: 'Travel, Vlog' },
  { id: 4, title: 'Hindi Neon Devanagari Font', cat: 'fonts', format: 'TTF', preview: '✍️ Yatra One & Rozha One bundle', tags: 'Shayari, Title' },
  { id: 5, title: 'Whoosh Whip Transition', cat: 'transitions', format: 'SFX + FX', preview: '🌪️ Fast directional camera blur', tags: 'Action, Shorts' },
  { id: 6, title: 'Vinyl Crackle Lo-Fi Bed', cat: 'audio', format: 'WAV Loop', preview: '☕ Warm relaxing aesthetic background', tags: 'Podcast, Study' },
];

export default function Marketplace() {
  const nav = useNavigate();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? ASSETS : ASSETS.filter((a) => a.cat === filter);

  return (
    <div className="studio-page">
      <header className="studio-header">
        <button className="ib" onClick={() => nav('/')} title="Back to Dashboard"><Icon name="back" size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <b>Effects & Asset Marketplace</b>
        </div>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <div className="studio-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Category Filters */}
        <div className="card" style={{ display: 'flex', gap: '8px', padding: '10px 14px', overflowX: 'auto' }}>
          {[['all', 'All Assets'], ['transitions', 'Transitions'], ['audio', 'Sound Effects & Loops'], ['luts', 'Color LUTs'], ['fonts', 'Hindi & English Fonts']].map(([k, label]) => (
            <button key={k} className={`btn sm ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>

        {/* Asset Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <b style={{ fontSize: '15px' }}>{item.title}</b>
                <span className="studio-card-badge">{item.format}</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mut)' }}>{item.preview}</p>
              <small style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Tags: {item.tags}</small>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn sm primary"
                  style={{ flex: 1 }}
                  onClick={() => alert(`"${item.title}" installed! Ready in Video Studio & Audio Studio.`)}
                >
                  ⚡ Free Install
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

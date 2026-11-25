import { useState, useMemo } from 'react';
import { EFFECTS } from '../effects/effects.js';

const EFFECT_CATS = [
  { id: 'all', label: 'All Effects (30+)' },
  { id: 'cinema', label: '🎬 Cinema & Flares' },
  { id: 'motion', label: '💥 Shakes & Beats' },
  { id: 'glitch', label: '⚡ Glitch & Cyber' },
  { id: 'vintage', label: '🎞️ Vintage & Film' },
  { id: 'stylize', label: '🌀 Warp & Stylize' },
];

export default function EditorEffectsPanel({ onAddEffect }) {
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');

  const entries = useMemo(() => {
    return Object.entries(EFFECTS).filter(([key, def]) => {
      const matchCat = activeCat === 'all' || def.cat === activeCat;
      const matchQ = !q || def.label.toLowerCase().includes(q.toLowerCase()) || (def.desc && def.desc.toLowerCase().includes(q.toLowerCase()));
      return matchCat && matchQ;
    });
  }, [activeCat, q]);

  return (
    <div className="pro-effects-panel" style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          placeholder="Search effects (e.g. Flare, Shake, Glitch)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: '#fff' }}
        />
        {q && <button className="btn sm" onClick={() => setQ('')} style={{ fontSize: '11px', padding: '5px 8px' }}>✕</button>}
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
        {EFFECT_CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: '16px',
              border: activeCat === c.id ? '1px solid #a855f7' : '1px solid var(--line)',
              background: activeCat === c.id ? '#a855f733' : 'var(--s2)',
              color: activeCat === c.id ? '#c084fc' : 'var(--mut)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
        {entries.map(([key, def]) => (
          <div
            key={key}
            onClick={() => onAddEffect(key)}
            style={{
              background: 'var(--s2)',
              border: '1px solid var(--line)',
              borderRadius: '10px',
              padding: '10px 10px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'border-color 0.1s, transform 0.1s',
            }}
            title={`Add ${def.label} to video timeline`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{def.label}</span>
              <span style={{ fontSize: '11px', color: '#a855f7' }}>+</span>
            </div>
            <small style={{ fontSize: '10px', color: 'var(--mut)', lineHeight: 1.2 }}>
              {def.desc || 'Cinematic visual effect'}
            </small>
          </div>
        ))}
      </div>

      <small className="muted" style={{ textAlign: 'center', fontSize: '11px', marginTop: '2px' }}>
        Effect clip playhead par 3 seconds ke liye add hogi. Timeline se length aur intensity customize karein!
      </small>
    </div>
  );
}

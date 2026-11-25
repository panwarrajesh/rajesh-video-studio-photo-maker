import { useEditor } from '../store/editor.js';

const LOOKS = [
  { id: 'original', name: 'Original', br: 1, ct: 1, sa: 1 },
  { id: 'teal_orange', name: 'Teal & Orange', br: 1.05, ct: 1.25, sa: 1.35 },
  { id: 'film_gold', name: 'Film Gold', br: 1.08, ct: 1.15, sa: 1.2 },
  { id: 'bw_noir', name: 'B&W Noir', br: 1, ct: 1.4, sa: 0 },
  { id: 'cyberpunk', name: 'Cyberpunk', br: 1.1, ct: 1.3, sa: 1.5 },
  { id: 'soft_portrait', name: 'Soft Portrait', br: 1.12, ct: 0.9, sa: 1.1 },
  { id: 'emerald', name: 'Moody Emerald', br: 0.95, ct: 1.2, sa: 1.15 },
  { id: 'sunset', name: 'Sunset Glow', br: 1.06, ct: 1.15, sa: 1.4 },
];

export default function EditorLooks() {
  const { clips, selected, select, updateProps, playhead } = useEditor();

  // Find target clip: selected, or the video/image clip under playhead
  const c = clips.find((x) => x.id === selected) || clips.find((x) => (x.track === 'VIDEO' || x.track === 'IMAGE') && playhead >= x.start && playhead < x.start + x.duration) || clips.find((x) => x.track === 'VIDEO' || x.track === 'IMAGE');

  if (!c) {
    return (
      <div className="tabbody">
        <small className="muted">Timeline par video ya photo clip select karein.</small>
      </div>
    );
  }

  const p = c.props || {};

  const applyLook = (look) => {
    updateProps(c.id, { br: look.br, ct: look.ct, sa: look.sa });
  };

  return (
    <div className="tabbody" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: '14px' }}>🎨 Photo Looks & Color Grading</b>
        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
          Target: {c.track}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {LOOKS.map((lk) => (
          <button
            key={lk.id}
            className="btn sm"
            style={{
              padding: '10px 8px',
              borderRadius: '10px',
              background: 'var(--s2)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
            onClick={() => applyLook(lk)}
          >
            <span>✨ {lk.name}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        <label className="prop">
          <span>Brightness <em>{Math.round((p.br ?? 1) * 100)}%</em></span>
          <input type="range" min="0.5" max="1.5" step="0.05" value={p.br ?? 1} onChange={(e) => updateProps(c.id, { br: Number(e.target.value) })} />
        </label>
        <label className="prop">
          <span>Contrast <em>{Math.round((p.ct ?? 1) * 100)}%</em></span>
          <input type="range" min="0.5" max="1.5" step="0.05" value={p.ct ?? 1} onChange={(e) => updateProps(c.id, { ct: Number(e.target.value) })} />
        </label>
        <label className="prop">
          <span>Saturation <em>{Math.round((p.sa ?? 1) * 100)}%</em></span>
          <input type="range" min="0" max="2" step="0.05" value={p.sa ?? 1} onChange={(e) => updateProps(c.id, { sa: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}

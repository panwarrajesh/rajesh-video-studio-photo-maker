import { useEditor, TEXT_DEFAULTS } from '../store/editor.js';

const TEMPLATES = [
  {
    id: 'viral_hook',
    name: '🔥 Viral Reel 3-Sec Hook',
    desc: 'Shocking title hook + zoom shake effect + energetic beat drop',
    badge: 'Reels / Shorts',
    color: '#ef4444',
    apply: (addClip) => {
      // Add Hook Text
      addClip({
        track: 'TEXT',
        kind: 'text',
        ...TEXT_DEFAULTS,
        text: 'WAIT FOR THE END! 😱',
        stylePreset: 'hook',
        fontSize: 9,
        duration: 3,
        anim: 'pop',
        bold: true,
      });
      // Add Earthquake Effect on beat
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'earthquake',
        intensity: 0.7,
        duration: 1.5,
      });
    },
  },
  {
    id: 'hindi_royal',
    name: '👑 Royal Hindi Cinematic',
    desc: 'Golden Calligraphy Hindi title + warm cinematic flare + slow zoom',
    badge: 'Cinematic / Status',
    color: '#eab308',
    apply: (addClip) => {
      addClip({
        track: 'TEXT',
        kind: 'text',
        ...TEXT_DEFAULTS,
        text: 'नमस्ते 🙏 प्यारी यादें',
        fontFamily: '"Yatra One", cursive',
        stylePreset: 'gold',
        fontSize: 8.5,
        duration: 4,
        anim: 'zoom',
        bold: true,
      });
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'lightleak',
        intensity: 0.8,
        duration: 3.5,
      });
    },
  },
  {
    id: 'breaking_news_tpl',
    name: '⚡ Breaking News Broadcast',
    desc: 'News banner + flash strobe impact + scanlines retro look',
    badge: 'News / Viral',
    color: '#dc2626',
    apply: (addClip) => {
      addClip({
        track: 'TEXT',
        kind: 'text',
        ...TEXT_DEFAULTS,
        text: 'BREAKING NEWS ⚡ ताजा खबर',
        stylePreset: 'news',
        fontSize: 7.5,
        duration: 3.5,
        anim: 'drop',
        bold: true,
      });
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'flash',
        intensity: 0.8,
        duration: 0.8,
      });
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'scanlines',
        intensity: 0.5,
        duration: 3.5,
      });
    },
  },
  {
    id: 'music_beat_drop',
    name: '🎵 EDM DJ Beat Drop',
    desc: 'RGB Chromatic Shift + Pulse Zoom + Cyberpunk grid overlay',
    badge: 'Music / Dance',
    color: '#8b5cf6',
    apply: (addClip) => {
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'pulse',
        intensity: 0.85,
        duration: 3,
      });
      addClip({
        track: 'EFFECTS',
        kind: 'effect',
        effect: 'rgb',
        intensity: 0.9,
        duration: 2,
      });
    },
  },
];

export default function EditorTemplates() {
  const { addClip, addLayer } = useEditor();

  return (
    <div className="pro-templates-panel" style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ margin: '0', fontSize: '11px', color: 'var(--mut)' }}>
        1-Tap Ready-Made Multi-Track Sequences: Text titles, cinematic effects, and motion overlays timeline par instant set ho jate hain!
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            style={{
              background: 'var(--s2)',
              border: `1px solid ${t.color}44`,
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{t.name}</span>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: `${t.color}22`, color: t.color, fontWeight: 700 }}>
                {t.badge}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--mut)', lineHeight: 1.3 }}>{t.desc}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => t.apply(addLayer || addClip)}
                style={{ fontSize: '11px', padding: '5px 12px', background: t.color, borderColor: t.color }}
              >
                ⚡ Apply to Video
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

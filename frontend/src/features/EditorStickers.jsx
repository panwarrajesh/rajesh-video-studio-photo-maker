import { useState, useMemo } from 'react';
import { useEditor } from '../store/editor.js';

export const PRO_STICKERS = [
  // --- VIRAL REELS & HOOKS ---
  {
    id: 'wait_end',
    cat: 'hooks',
    name: 'Wait for End',
    type: 'badge',
    bg: 'linear-gradient(135deg, #ff0055, #ff5500)',
    color: '#ffffff',
    border: '2px solid #fff',
    content: '👀 WAIT FOR THE END',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '20px',
    padding: '6px 14px',
    boxShadow: '0 4px 15px rgba(255,0,85,0.6)',
  },
  {
    id: 'shocking',
    cat: 'hooks',
    name: 'Shocking Alert',
    type: 'badge',
    bg: '#dc2626',
    color: '#ffffff',
    border: '2px solid #fef08a',
    content: '😱 SHOCKING FACT!',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '6px',
    padding: '6px 12px',
    boxShadow: '0 0 12px rgba(220,38,38,0.8)',
  },
  {
    id: 'mind_blown',
    cat: 'hooks',
    name: 'Mind Blown',
    type: 'badge',
    bg: 'linear-gradient(135deg, #7c3aed, #ec4899)',
    color: '#ffffff',
    border: 'none',
    content: '🤯 MIND BLOWN!',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '16px',
    padding: '6px 14px',
    boxShadow: '0 4px 12px rgba(124,58,237,0.5)',
  },
  {
    id: 'secret_hack',
    cat: 'hooks',
    name: 'Secret Hack',
    type: 'badge',
    bg: '#000000',
    color: '#34d399',
    border: '2px solid #34d399',
    content: '🤫 SECRET HACK',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '8px',
    padding: '5px 12px',
    boxShadow: '0 0 10px rgba(52,211,153,0.5)',
  },
  {
    id: 'real_100',
    cat: 'hooks',
    name: '100% Real',
    type: 'badge',
    bg: '#10b981',
    color: '#ffffff',
    border: '2px solid #ffffff',
    content: '💯 100% REAL',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '20px',
    padding: '5px 12px',
  },
  {
    id: 'check_bio',
    cat: 'hooks',
    name: 'Check Caption',
    type: 'badge',
    bg: '#ffffff',
    color: '#000000',
    border: '2px solid #000',
    content: '👇 CHECK CAPTION',
    fontSize: '10px',
    fontWeight: '900',
    borderRadius: '20px',
    padding: '6px 12px',
  },
  {
    id: 'trending_now',
    cat: 'hooks',
    name: 'Trending Now',
    type: 'badge',
    bg: 'linear-gradient(90deg, #f59e0b, #ef4444)',
    color: '#ffffff',
    border: 'none',
    content: '🔥 TRENDING NOW',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '12px',
    padding: '5px 12px',
  },

  // --- SOCIAL MEDIA & BADGES ---
  {
    id: 'yt_subscribe',
    cat: 'social',
    name: 'Subscribe',
    type: 'badge',
    bg: '#ff0000',
    color: '#ffffff',
    border: 'none',
    content: '▶ SUBSCRIBE 🔔',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '24px',
    padding: '7px 16px',
    boxShadow: '0 4px 14px rgba(255,0,0,0.5)',
  },
  {
    id: 'like_share',
    cat: 'social',
    name: 'Like & Share',
    type: 'badge',
    bg: '#1e293b',
    color: '#38bdf8',
    border: '1px solid #38bdf8',
    content: '👍 LIKE & SHARE 🚀',
    fontSize: '10px',
    fontWeight: '700',
    borderRadius: '20px',
    padding: '6px 14px',
  },
  {
    id: 'verified_tick',
    cat: 'social',
    name: 'Verified Badge',
    type: 'badge',
    bg: '#0284c7',
    color: '#ffffff',
    border: '2px solid #ffffff',
    content: '✔ VERIFIED',
    fontSize: '10px',
    fontWeight: '900',
    borderRadius: '16px',
    padding: '4px 10px',
    boxShadow: '0 0 10px rgba(2,132,199,0.8)',
  },
  {
    id: 'ig_follow',
    cat: 'social',
    name: 'Follow IG',
    type: 'badge',
    bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    color: '#ffffff',
    border: 'none',
    content: '📸 FOLLOW US',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '20px',
    padding: '6px 14px',
  },
  {
    id: 'views_1m',
    cat: 'social',
    name: '1M Views',
    type: 'badge',
    bg: '#0f172a',
    color: '#fbbf24',
    border: '1.5px solid #fbbf24',
    content: '⭐ 1,000,000 VIEWS',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '14px',
    padding: '5px 12px',
  },
  {
    id: 'live_rec',
    cat: 'social',
    name: 'REC Live',
    type: 'badge',
    bg: '#000000aa',
    color: '#ef4444',
    border: '1.5px solid #ef4444',
    content: '🔴 REC 00:01:24',
    fontSize: '10px',
    fontWeight: '700',
    borderRadius: '4px',
    padding: '4px 10px',
  },
  {
    id: 'breaking_news',
    cat: 'social',
    name: 'Breaking News',
    type: 'badge',
    bg: '#dc2626',
    color: '#ffffff',
    border: '2px solid #facc15',
    content: '⚡ BREAKING NEWS',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '2px',
    padding: '5px 14px',
  },
  {
    id: 'vip_pro',
    cat: 'social',
    name: 'VIP Member',
    type: 'badge',
    bg: 'linear-gradient(135deg, #ffd700, #b45309)',
    color: '#000000',
    border: '1px solid #fff',
    content: '👑 VIP CREATOR',
    fontSize: '10px',
    fontWeight: '900',
    borderRadius: '20px',
    padding: '5px 12px',
  },

  // --- NEON & GRAPHIC ARROWS ---
  {
    id: 'neon_arrow_down',
    cat: 'neon',
    name: 'Neon Arrow Down',
    type: 'svg',
    color: '#00ffff',
    viewBox: '0 0 100 100',
    path: 'M50 10 L50 75 M30 55 L50 85 L70 55',
    stroke: '#00ffff',
    strokeWidth: 8,
    fill: 'none',
    filter: 'drop-shadow(0 0 8px #00ffff)',
  },
  {
    id: 'neon_arrow_right',
    cat: 'neon',
    name: 'Neon Arrow Right',
    type: 'svg',
    color: '#ff00ff',
    viewBox: '0 0 100 100',
    path: 'M15 50 L75 50 M55 30 L85 50 L55 70',
    stroke: '#ff00ff',
    strokeWidth: 8,
    fill: 'none',
    filter: 'drop-shadow(0 0 8px #ff00ff)',
  },
  {
    id: 'circle_highlight',
    cat: 'neon',
    name: 'Circle Highlight',
    type: 'svg',
    color: '#ef4444',
    viewBox: '0 0 100 100',
    path: 'M50 15 A35 35 0 1 1 48 15',
    stroke: '#ef4444',
    strokeWidth: 6,
    fill: 'none',
    filter: 'drop-shadow(0 0 6px #ef4444)',
  },
  {
    id: 'fire_flame',
    cat: 'neon',
    name: 'Fire Flame',
    type: 'svg',
    color: '#ff5500',
    viewBox: '0 0 100 100',
    path: 'M50 5C50 5 65 30 65 48C65 65 52 75 50 85C48 75 35 65 35 48C35 30 50 5 50 5ZM50 40C45 48 45 58 50 65C55 58 55 48 50 40Z',
    fill: '#ff5500',
    filter: 'drop-shadow(0 0 10px #ff3300)',
  },
  {
    id: 'lightning_bolt',
    cat: 'neon',
    name: 'Lightning Bolt',
    type: 'svg',
    color: '#facc15',
    viewBox: '0 0 100 100',
    path: 'M55 5 L20 55 L48 55 L38 95 L80 40 L50 40 Z',
    fill: '#facc15',
    filter: 'drop-shadow(0 0 10px #facc15)',
  },
  {
    id: 'golden_crown',
    cat: 'neon',
    name: 'Golden Crown',
    type: 'svg',
    color: '#ffd700',
    viewBox: '0 0 100 100',
    path: 'M15 75 L20 30 L40 55 L50 20 L60 55 L80 30 L85 75 Z',
    fill: '#ffd700',
    filter: 'drop-shadow(0 0 10px #eab308)',
  },
  {
    id: 'sparkle_stars',
    cat: 'neon',
    name: 'Sparkle Star',
    type: 'svg',
    color: '#ffffff',
    viewBox: '0 0 100 100',
    path: 'M50 5 Q50 50 95 50 Q50 50 50 95 Q50 50 5 50 Q50 50 50 5 Z',
    fill: '#ffffff',
    filter: 'drop-shadow(0 0 12px #38bdf8)',
  },
  {
    id: 'cyber_skull',
    cat: 'neon',
    name: 'Cyber Skull',
    type: 'svg',
    color: '#00f0ff',
    viewBox: '0 0 100 100',
    path: 'M50 15 C30 15 25 35 25 50 C25 65 35 70 38 78 L62 78 C65 70 75 65 75 50 C75 35 70 15 50 15 Z M38 48 A6 6 0 1 1 38 47.9 Z M62 48 A6 6 0 1 1 62 47.9 Z',
    fill: 'none',
    stroke: '#00f0ff',
    strokeWidth: 5,
    filter: 'drop-shadow(0 0 8px #00f0ff)',
  },

  // --- INDIAN & HINDI BADGES ---
  {
    id: 'hindi_superhit',
    cat: 'indian',
    name: 'सुपरहिट 🔥',
    type: 'badge',
    bg: 'linear-gradient(90deg, #dc2626, #ea580c)',
    color: '#ffffff',
    border: '2px solid #ffd700',
    content: '💥 सुपरहिट !',
    fontSize: '12px',
    fontWeight: '900',
    borderRadius: '16px',
    padding: '5px 14px',
    boxShadow: '0 4px 15px rgba(220,38,38,0.7)',
  },
  {
    id: 'hindi_bhaukal',
    cat: 'indian',
    name: 'भौकाल 🔥',
    type: 'badge',
    bg: '#000000',
    color: '#facc15',
    border: '2px solid #facc15',
    content: '🔥 भौकाल टाइट',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '8px',
    padding: '6px 14px',
    boxShadow: '0 0 12px rgba(250,204,21,0.6)',
  },
  {
    id: 'hindi_badhai',
    cat: 'indian',
    name: 'बधाई हो 🎉',
    type: 'badge',
    bg: 'linear-gradient(135deg, #16a34a, #059669)',
    color: '#ffffff',
    border: '1.5px solid #ffffff',
    content: '🎉 हार्दिक बधाई',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '20px',
    padding: '6px 14px',
  },
  {
    id: 'hindi_namaste',
    cat: 'indian',
    name: 'नमस्ते 🙏',
    type: 'badge',
    bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    border: 'none',
    content: '🙏 सादर प्रणाम',
    fontSize: '11px',
    fontWeight: '800',
    borderRadius: '18px',
    padding: '5px 12px',
  },
  {
    id: 'hindi_jai_hind',
    cat: 'indian',
    name: 'जय हिन्द 🇮🇳',
    type: 'badge',
    bg: 'linear-gradient(90deg, #ff9933 0%, #ffffff 50%, #138808 100%)',
    color: '#000080',
    border: '1px solid #ffffff',
    content: '🇮🇳 जय हिन्द',
    fontSize: '12px',
    fontWeight: '900',
    borderRadius: '16px',
    padding: '5px 14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  {
    id: 'hindi_dil_se',
    cat: 'indian',
    name: 'दिल से ❤️',
    type: 'badge',
    bg: '#be123c',
    color: '#ffffff',
    border: '2px solid #fecdd3',
    content: '❤️ दिल से आपके लिए',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '20px',
    padding: '5px 12px',
  },
  {
    id: 'om_sacred',
    cat: 'indian',
    name: 'ॐ (Om Sacred)',
    type: 'badge',
    bg: 'linear-gradient(135deg, #ea580c, #b45309)',
    color: '#ffffff',
    border: '2px solid #ffd700',
    content: '🕉️ ॐ नमः शिवाय',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '14px',
    padding: '5px 14px',
  },
  {
    id: 'shubh_diwali',
    cat: 'indian',
    name: 'शुभ दीपावली 🪔',
    type: 'badge',
    bg: '#78350f',
    color: '#fef08a',
    border: '2px solid #f59e0b',
    content: '🪔 शुभ दीपावली ✨',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '16px',
    padding: '5px 12px',
  },

  // --- EMOJIS & REACTIONS ---
  {
    id: 'emoji_fire',
    cat: 'emojis',
    name: 'Fire 🔥',
    type: 'badge',
    bg: 'transparent',
    color: '#ff4500',
    border: 'none',
    content: '🔥🔥🔥',
    fontSize: '24px',
    padding: '0',
  },
  {
    id: 'emoji_100',
    cat: 'emojis',
    name: '100 Score',
    type: 'badge',
    bg: 'transparent',
    color: '#ef4444',
    border: 'none',
    content: '💯',
    fontSize: '28px',
    padding: '0',
  },
  {
    id: 'emoji_crown',
    cat: 'emojis',
    name: 'King Crown',
    type: 'badge',
    bg: 'transparent',
    color: '#fbbf24',
    border: 'none',
    content: '👑',
    fontSize: '28px',
    padding: '0',
  },
  {
    id: 'emoji_rocket',
    cat: 'emojis',
    name: 'Rocket',
    type: 'badge',
    bg: 'transparent',
    color: '#38bdf8',
    border: 'none',
    content: '🚀',
    fontSize: '28px',
    padding: '0',
  },
  {
    id: 'emoji_love',
    cat: 'emojis',
    name: 'Love Eyes',
    type: 'badge',
    bg: 'transparent',
    color: '#f43f5e',
    border: 'none',
    content: '😍',
    fontSize: '28px',
    padding: '0',
  },
  {
    id: 'emoji_money',
    cat: 'emojis',
    name: 'Money Bag',
    type: 'badge',
    bg: 'transparent',
    color: '#10b981',
    border: 'none',
    content: '💰🤑',
    fontSize: '26px',
    padding: '0',
  },

  // --- PROMO & OFFERS ---
  {
    id: 'sale_50',
    cat: 'promo',
    name: '50% OFF',
    type: 'badge',
    bg: '#dc2626',
    color: '#ffffff',
    border: '2px dashed #ffffff',
    content: '🏷️ 50% OFF SALE',
    fontSize: '11px',
    fontWeight: '900',
    borderRadius: '4px',
    padding: '5px 12px',
  },
  {
    id: 'limited_time',
    cat: 'promo',
    name: 'Limited Offer',
    type: 'badge',
    bg: '#7c3aed',
    color: '#fef08a',
    border: '1.5px solid #fef08a',
    content: '⏳ LIMITED TIME OFFER',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '16px',
    padding: '5px 12px',
  },
  {
    id: 'best_seller',
    cat: 'promo',
    name: 'Best Seller',
    type: 'badge',
    bg: '#f59e0b',
    color: '#000000',
    border: 'none',
    content: '⭐ BEST SELLER',
    fontSize: '10px',
    fontWeight: '900',
    borderRadius: '12px',
    padding: '5px 12px',
  },
];

export const STICKER_CATS = [
  { id: 'all', label: 'All (50+)' },
  { id: 'hooks', label: '🎬 Reel Hooks' },
  { id: 'social', label: '🔥 Social Badges' },
  { id: 'neon', label: '⚡ Neon & Arrows' },
  { id: 'indian', label: '🇮🇳 हिंदी & Festive' },
  { id: 'emojis', label: '😎 Emojis' },
  { id: 'promo', label: '🏷️ Offers' },
];

export default function EditorStickers({ onAddSticker }) {
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    return PRO_STICKERS.filter((s) => {
      const matchCat = activeCat === 'all' || s.cat === activeCat;
      const matchQ = !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.content && s.content.toLowerCase().includes(q.toLowerCase()));
      return matchCat && matchQ;
    });
  }, [activeCat, q]);

  return (
    <div className="pro-stickers-panel" style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          placeholder="Search stickers (e.g. Subscribe, Fire, Hindi)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: '#fff' }}
        />
        {q && <button className="btn sm" onClick={() => setQ('')} style={{ fontSize: '11px', padding: '5px 8px' }}>✕</button>}
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
        {STICKER_CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: '16px',
              border: activeCat === c.id ? '1px solid #3b82f6' : '1px solid var(--line)',
              background: activeCat === c.id ? '#3b82f633' : 'var(--s2)',
              color: activeCat === c.id ? '#60a5fa' : 'var(--mut)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
        {filtered.map((s) => (
          <div
            key={s.id}
            onClick={() => onAddSticker(s)}
            style={{
              background: 'var(--s2)',
              border: '1px solid var(--line)',
              borderRadius: '10px',
              padding: '10px 6px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              textAlign: 'center',
              transition: 'transform 0.1s, border-color 0.1s',
            }}
            title={`Click to add ${s.name}`}
          >
            <div style={{ minHeight: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.type === 'badge' ? (
                <div
                  style={{
                    background: s.bg,
                    color: s.color,
                    border: s.border,
                    borderRadius: s.borderRadius,
                    padding: s.padding,
                    fontSize: s.fontSize,
                    fontWeight: s.fontWeight,
                    boxShadow: s.boxShadow,
                    whiteSpace: 'nowrap',
                    transform: 'scale(0.85)',
                  }}
                >
                  {s.content}
                </div>
              ) : (
                <svg viewBox={s.viewBox} width="36" height="36" style={{ filter: s.filter }}>
                  <path d={s.path} fill={s.fill || 'none'} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                </svg>
              )}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      <small className="muted" style={{ textAlign: 'center', fontSize: '11px', marginTop: '2px' }}>
        Tap any sticker to place it directly onto the timeline at current playhead!
      </small>
    </div>
  );
}

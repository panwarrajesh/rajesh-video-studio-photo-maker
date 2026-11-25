// Effect registry. fn(intensity, t, u) -> { filter, transform, overlay:[styles], rgb, mblur, distort, pixel }
// u = progress through the effect clip (0..1). Add a new effect = add a key.
const noise = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

export const EFFECTS = {
  // --- CINEMA & LIGHTING ---
  lightleak: {
    label: 'Golden Light Leak',
    cat: 'cinema',
    desc: 'Cinematic warm amber lens flare',
    fn: (i, t) => ({
      overlay: [{
        background: `radial-gradient(circle at ${50 + 40 * Math.sin(t * 1.3)}% ${30 + 20 * Math.cos(t)}%, rgba(255,140,60,.9), rgba(255,60,120,.4) 40%, transparent 65%)`,
        mixBlendMode: 'screen',
        opacity: i,
      }],
    }),
  },
  anamorphic: {
    label: 'Anamorphic Flare',
    cat: 'cinema',
    desc: 'Horizontal blue cinematic lens streak',
    fn: (i, t) => ({
      overlay: [{
        background: `radial-gradient(ellipse 100% 12% at 50% ${45 + 10 * Math.sin(t * 1.5)}%, rgba(56,189,248,0.95), rgba(14,165,233,0.5) 40%, transparent 80%)`,
        mixBlendMode: 'screen',
        opacity: i,
        transform: `translateY(${Math.sin(t * 0.8) * 8}px)`,
      }],
    }),
  },
  prism: {
    label: 'Rainbow Prism',
    cat: 'cinema',
    desc: 'Refraction color prism edges',
    fn: (i, t) => ({
      rgb: i * 8,
      overlay: [{
        background: `linear-gradient(${t * 60}deg, rgba(255,0,128,0.3), rgba(0,255,255,0.3), rgba(255,255,0,0.3))`,
        mixBlendMode: 'color-dodge',
        opacity: i * 0.65,
      }],
    }),
  },
  filmburn: {
    label: 'Vintage Film Burn',
    cat: 'cinema',
    desc: 'Burning celluloid film transition',
    fn: (i, t, u) => ({
      overlay: [{
        background: `radial-gradient(ellipse at ${30 + 40 * Math.sin(t * 2)}% ${50 + 30 * Math.cos(t * 1.5)}%, #fff 10%, #ff8c00 40%, #dc2626 75%, transparent 95%)`,
        mixBlendMode: 'screen',
        opacity: i * Math.sin(u * Math.PI),
      }],
    }),
  },
  vignette: {
    label: 'Cinema Vignette',
    cat: 'cinema',
    desc: 'Deep cinematic darkened borders',
    fn: (i) => ({
      overlay: [{
        background: `radial-gradient(circle at center, transparent ${70 - i * 40}%, rgba(0,0,0,${0.4 + 0.6 * i}) 100%)`,
      }],
    }),
  },
  mist: {
    label: 'Pro-Mist Glow',
    cat: 'cinema',
    desc: 'Soft diffusion dreamy film glow',
    fn: (i) => ({
      filter: `brightness(${1 + 0.2 * i}) contrast(${1 - 0.1 * i}) drop-shadow(0 0 ${i * 18}px rgba(255,240,200,0.7))`,
    }),
  },

  // --- GLITCH & RETRO ---
  glitch: {
    label: 'Digital Glitch',
    cat: 'glitch',
    desc: 'RGB displacement & cyber jitter',
    fn: (i, t) => {
      const on = Math.sin(t * 23) > 0.15;
      return {
        rgb: on ? i * 16 : 0,
        transform: on ? `translateX(${Math.sin(t * 90) * i * 22}px) skewX(${Math.sin(t * 40) * i * 6}deg)` : undefined,
      };
    },
  },
  vhs: {
    label: '1990s VHS Tape',
    cat: 'glitch',
    desc: 'VHS scanlines with tracking noise',
    fn: (i, t) => ({
      rgb: i * 7,
      overlay: [
        {
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 4px)',
          mixBlendMode: 'multiply',
          opacity: i * 0.75,
        },
        {
          background: `linear-gradient(0deg, transparent 40%, rgba(255,255,255,${0.3 * i}) 50%, transparent 60%)`,
          transform: `translateY(${((t * 250) % 1000) - 500}px)`,
          opacity: i * 0.6,
        },
      ],
    }),
  },
  scanlines: {
    label: 'CRT Scanlines',
    cat: 'glitch',
    desc: 'Retro arcade CRT TV lines',
    fn: (i) => ({
      overlay: [{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 2px, transparent 2px, transparent 5px)',
        opacity: i * 0.8,
      }],
    }),
  },
  rgb: {
    label: 'RGB 3D Shift',
    cat: 'glitch',
    desc: '3D chromatic color separation',
    fn: (i) => ({ rgb: i * 14 }),
  },
  cyber: {
    label: 'Cyberpunk Grid',
    cat: 'glitch',
    desc: 'Futuristic neon digital grid',
    fn: (i, t) => ({
      filter: `hue-rotate(${t * 40}deg) saturate(${1 + i * 0.8})`,
      overlay: [{
        backgroundImage: 'linear-gradient(to right, rgba(0,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,0,255,0.15) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: i * 0.7,
      }],
    }),
  },

  // --- SHAKES & BEAT IMPACTS ---
  shake: {
    label: 'Camera Shake',
    cat: 'motion',
    desc: 'Natural handheld camera movement',
    fn: (i, t) => ({
      transform: `translate(${Math.sin(t * 61) * i * 15}px,${Math.cos(t * 47) * i * 15}px) rotate(${Math.sin(t * 31) * i * 1.5}deg)`,
    }),
  },
  earthquake: {
    label: 'Earthquake Bass',
    cat: 'motion',
    desc: 'Violent impact shake for beat drops',
    fn: (i, t) => ({
      transform: `translate(${Math.sin(t * 120) * i * 30}px,${Math.cos(t * 90) * i * 25}px) scale(${1 + Math.abs(Math.sin(t * 45)) * i * 0.12})`,
      rgb: i * 10,
    }),
  },
  pulse: {
    label: 'Heartbeat Pulse',
    cat: 'motion',
    desc: 'Rhythmic zoom pulse synced to beat',
    fn: (i, t) => ({
      transform: `scale(${1 + Math.abs(Math.sin(t * Math.PI * 2.5)) * i * 0.16})`,
    }),
  },
  zoom: {
    label: 'Slow Zoom-In',
    cat: 'motion',
    desc: 'Cinematic dramatic push forward',
    fn: (i, t, u) => ({
      transform: `scale(${1 + i * 0.5 * u})`,
    }),
  },
  zoom_out: {
    label: 'Reveal Zoom-Out',
    cat: 'motion',
    desc: 'Dramatic backward reveal pull',
    fn: (i, t, u) => ({
      transform: `scale(${1 + i * 0.5 * (1 - u)})`,
    }),
  },
  whip: {
    label: 'Whip Pan Motion',
    cat: 'motion',
    desc: 'Fast directional motion blur wipe',
    fn: (i, t, u) => ({
      mblur: i * 25 * Math.sin(u * Math.PI),
      transform: `translateX(${(u - 0.5) * i * 120}px)`,
    }),
  },
  flash: {
    label: 'White Flash Impact',
    cat: 'motion',
    desc: 'Bright white strobe hit',
    fn: (i, t, u) => ({
      overlay: [{ background: '#ffffff', opacity: i * Math.max(0, 1 - u * 3.5) }],
    }),
  },

  // --- VINTAGE & ATMOSPHERE ---
  noise: {
    label: '35mm Film Grain',
    cat: 'vintage',
    desc: 'Authentic 35mm celluloid noise',
    fn: (i, t) => ({
      overlay: [{
        backgroundImage: noise,
        opacity: i * 0.65,
        mixBlendMode: 'overlay',
        backgroundPosition: `${(t * 997) % 200}px ${(t * 577) % 200}px`,
      }],
    }),
  },
  noir: {
    label: 'Film Noir B&W',
    cat: 'vintage',
    desc: 'High contrast black & white cinema',
    fn: (i) => ({
      filter: `grayscale(${i}) contrast(${1 + i * 0.7}) brightness(${1 - i * 0.1})`,
    }),
  },
  sepia: {
    label: 'Vintage Sepia',
    cat: 'vintage',
    desc: 'Classic antique sepia memories',
    fn: (i) => ({
      filter: `sepia(${i * 0.9}) contrast(${1 + i * 0.2}) brightness(${1 - i * 0.05})`,
    }),
  },
  sparkles: {
    label: 'Magic Sparkles',
    cat: 'vintage',
    desc: 'Glowing star particle shimmer',
    fn: (i, t) => ({
      filter: `drop-shadow(0 0 ${i * 10}px #ffd700)`,
      overlay: [{
        background: `radial-gradient(circle at ${20 + 30 * Math.sin(t * 2)}% ${30 + 20 * Math.cos(t * 1.7)}%, rgba(255,215,0,0.8) 0%, transparent 25%), radial-gradient(circle at ${70 + 20 * Math.cos(t * 2.2)}% ${60 + 25 * Math.sin(t * 1.4)}%, rgba(255,255,255,0.9) 0%, transparent 20%)`,
        mixBlendMode: 'screen',
        opacity: i,
      }],
    }),
  },
  nightvision: {
    label: 'Night Vision Cam',
    cat: 'vintage',
    desc: 'Military surveillance green phosphor',
    fn: (i) => ({
      filter: `brightness(${1 + i * 0.3}) contrast(${1 + i * 0.5}) hue-rotate(90deg) saturate(${1 + i * 2})`,
      overlay: [{
        background: 'radial-gradient(circle at center, rgba(34,197,94,0.15) 0%, rgba(20,83,45,0.6) 100%)',
        mixBlendMode: 'multiply',
        opacity: i,
      }],
    }),
  },

  // --- WARP & STYLIZE ---
  speedlines: {
    label: 'Anime Speed Lines',
    cat: 'stylize',
    desc: 'Intense manga anime action focus',
    fn: (i, t) => {
      const mask = 'radial-gradient(circle, transparent 35%, #000 80%)';
      return {
        overlay: [{
          background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.9) 0deg .6deg, transparent .6deg 5deg)',
          WebkitMaskImage: mask,
          maskImage: mask,
          opacity: i * 0.75,
          transform: `rotate(${t * 40}deg) scale(1.5)`,
        }],
      };
    },
  },
  pixelate: {
    label: '8-Bit Pixelate',
    cat: 'stylize',
    desc: 'Retro arcade mosaic pixelation',
    fn: (i) => ({ pixel: 4 + i * 36 }),
  },
  distort: {
    label: 'Wave Ripple',
    cat: 'stylize',
    desc: 'Underwater liquid surface distortion',
    fn: (i) => ({ distort: i * 45 }),
  },
  glow: {
    label: 'Neon Aura Glow',
    cat: 'stylize',
    desc: 'Electric glowing perimeter',
    fn: (i) => ({
      filter: `brightness(${1 + 0.35 * i}) saturate(${1 + 0.6 * i}) drop-shadow(0 0 ${i * 16}px rgba(59,130,246,0.8))`,
    }),
  },
  blur: {
    label: 'Soft Blur Focus',
    cat: 'stylize',
    desc: 'Out of focus background blur',
    fn: (i) => ({ filter: `blur(${i * 12}px)` }),
  },
  fade: {
    label: 'Fade to Black',
    cat: 'stylize',
    desc: 'Smooth cinematic black fadeout',
    fn: (i, t, u) => ({
      overlay: [{ background: '#000000', opacity: Math.min(1, i * u) }],
    }),
  },
};

export function composeEffects(active, t) {
  const out = { filters: [], transforms: [], overlays: [], rgb: 0, mblur: 0, distort: 0, pixel: 0 };
  for (const c of active) {
    const r = EFFECTS[c.props.effect]?.fn(c.props.intensity, t, (t - c.start) / c.duration);
    if (!r) continue;
    if (r.filter) out.filters.push(r.filter);
    if (r.transform) out.transforms.push(r.transform);
    if (r.overlay) out.overlays.push(...r.overlay);
    for (const k of ['rgb', 'mblur', 'distort', 'pixel']) out[k] = Math.max(out[k], r[k] || 0);
  }
  if (out.rgb) out.filters.push('url(#fx-rgb)');
  if (out.mblur) out.filters.push('url(#fx-mblur)');
  if (out.distort) out.filters.push('url(#fx-distort)');
  return out;
}

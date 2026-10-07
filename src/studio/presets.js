export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const rnd = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const L = (a, b, u) => a + (b - a) * u;
const out = (u) => 1 - (1 - Math.min(u, 1)) ** 2;

// 20 base camera moves x 3 strengths = 60 motion presets. fn(u 0..1, t seconds) -> { s scale, x, y (fractions of width/height), r radians }
const BASES = {
  'Zoom In': (u, k) => ({ s: 1 + 0.18 * k * u }), 'Zoom Out': (u, k) => ({ s: 1 + 0.18 * k * (1 - u) }),
  'Pan Left': (u, k) => ({ s: 1.2, x: L(0.05, -0.05, u) * k }), 'Pan Right': (u, k) => ({ s: 1.2, x: L(-0.05, 0.05, u) * k }),
  'Pan Up': (u, k) => ({ s: 1.2, y: L(0.05, -0.05, u) * k }), 'Pan Down': (u, k) => ({ s: 1.2, y: L(-0.05, 0.05, u) * k }),
  'Diagonal ↘': (u, k) => ({ s: 1.2, x: L(-0.04, 0.04, u) * k, y: L(-0.04, 0.04, u) * k }), 'Diagonal ↖': (u, k) => ({ s: 1.2, x: L(0.04, -0.04, u) * k, y: L(0.04, -0.04, u) * k }),
  'Ken Burns': (u, k) => ({ s: 1 + 0.2 * k * u, x: L(0.03, -0.03, u) * k, y: L(0.02, -0.02, u) * k }),
  Drift: (u, k, t) => ({ s: 1.12, x: Math.sin(t * 0.8) * 0.02 * k, y: Math.cos(t * 0.6) * 0.015 * k }), Breathe: (u, k, t) => ({ s: 1.06 + Math.sin(t * 2.2) * 0.04 * k }),
  'Rotate CW': (u, k) => ({ s: 1.22, r: L(-0.05, 0.05, u) * k }), 'Rotate CCW': (u, k) => ({ s: 1.22, r: L(0.05, -0.05, u) * k }),
  Tilt: (u, k) => ({ s: 1.18, r: Math.sin(u * Math.PI) * 0.04 * k }), Dolly: (u, k) => ({ s: 1 + 0.25 * k * u, r: 0.02 * k * u }),
  Handheld: (u, k, t) => ({ s: 1.1, x: (Math.sin(t * 3.1) + Math.sin(t * 5.3)) * 0.006 * k, y: (Math.cos(t * 2.7) + Math.sin(t * 4.1)) * 0.006 * k, r: Math.sin(t * 2.3) * 0.004 * k }),
  Swing: (u, k) => ({ s: 1.2, x: Math.sin(u * Math.PI * 2) * 0.04 * k }), 'Push In': (u, k) => ({ s: 1 + 0.25 * k * out(u) }),
  'Pull Out': (u, k) => ({ s: 1 + 0.25 * k * (1 - out(u)) }), Spiral: (u, k) => ({ s: 1 + 0.2 * k * u, r: L(-0.06, 0.06, u) * k }),
};
export const MOTIONS = Object.entries(BASES).flatMap(([n, f]) => [['Soft', 0.6], ['Normal', 1], ['Strong', 1.7]].map(([sn, k]) => ({ name: `${n} · ${sn}`, fn: (u, t) => f(u, k, t) })));

export const FX = ['None', 'Shake', 'Glitch', 'RGB Split', 'Flash', 'Vignette', 'Film Grain', 'Light Leak', 'Glow', 'VHS Lines', 'Film Burn', 'Beat Zoom', 'Blur Pulse', 'Parallax 3D'];
export const FILTERS = [
  ['Original', ''], ['Vivid', 'saturate(1.5) contrast(1.1)'], ['Warm', 'sepia(.3) saturate(1.3) hue-rotate(-10deg)'], ['Cool', 'hue-rotate(15deg) saturate(1.1) brightness(1.03)'],
  ['Vintage', 'sepia(.6) contrast(1.1) saturate(.8) brightness(.95)'], ['Black & White', 'grayscale(1)'], ['Noir', 'grayscale(1) contrast(1.4) brightness(.9)'],
  ['Cinematic', 'contrast(1.2) saturate(.85) brightness(.92) sepia(.15)'], ['Faded', 'contrast(.8) brightness(1.1) saturate(.7)'], ['Dream', 'brightness(1.1) saturate(1.2) contrast(.9) blur(.6px)'],
  ['Sunset', 'sepia(.35) saturate(1.6) hue-rotate(-18deg)'], ['Teal & Orange', 'contrast(1.15) saturate(1.3) hue-rotate(12deg) sepia(.12)'],
].map(([name, css]) => ({ name, css }));
export const TRANS = [
  ['Fade', (c, p) => { c.globalAlpha = p; }], ['Slide Left', (c, p, W) => c.translate((1 - p) * W, 0)], ['Slide Right', (c, p, W) => c.translate(-(1 - p) * W, 0)],
  ['Slide Up', (c, p, W, H) => c.translate(0, (1 - p) * H)], ['Slide Down', (c, p, W, H) => c.translate(0, -(1 - p) * H)],
  ['Zoom In', (c, p, W, H) => { c.globalAlpha = p; c.translate(W / 2, H / 2); c.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p); c.translate(-W / 2, -H / 2); }],
  ['Zoom Out', (c, p, W, H) => { c.globalAlpha = p; c.translate(W / 2, H / 2); c.scale(1.6 - 0.6 * p, 1.6 - 0.6 * p); c.translate(-W / 2, -H / 2); }],
  ['Blur', (c, p) => { c.globalAlpha = p; c._tf = `blur(${(1 - p) * 20}px)`; }], ['Wipe', (c, p, W, H) => { c.beginPath(); c.rect(0, 0, W * p, H); c.clip(); }],
  ['Circle', (c, p, W, H) => { c.beginPath(); c.arc(W / 2, H / 2, (Math.hypot(W, H) / 2) * p, 0, 7); c.clip(); }],
  ['Spin', (c, p, W, H) => { c.globalAlpha = p; c.translate(W / 2, H / 2); c.rotate((1 - p) * 1.2); c.scale(0.5 + 0.5 * p, 0.5 + 0.5 * p); c.translate(-W / 2, -H / 2); }],
  ['Glitch', (c, p, W) => { c.translate((rnd(Math.floor(p * 20), 3) - 0.5) * W * 0.08 * (1 - p), 0); c.globalAlpha = p > 0.5 || rnd(Math.floor(p * 30)) > 0.4 ? 1 : 0.2; }],
].map(([name, fn]) => ({ name, fn }));
export const TEXT_ANIMS = ['None', 'Fade', 'Slide Up', 'Slide Left', 'Pop', 'Bounce', 'Zoom', 'Typewriter', 'Glitch', 'Blur In'];
export const PARTICLES = ['None', 'Sparkles', 'Snow', 'Hearts', 'Bokeh', 'Stars', 'Confetti', 'Fireflies', 'Rain'];
export const BACKGROUNDS = ['Blurred Photo', 'Black', 'Solid Color', 'Sunset', 'Ocean', 'Purple Haze', 'Animated Gradient', 'Aurora', 'Night City', 'Ocean Waves', 'Starfield', 'Uploaded Video'];
export const TEXT_POS = ['Top', 'Middle', 'Bottom'];
export const FONTS = [['Modern', '"Manrope", system-ui, sans-serif'], ['Hindi / Devanagari', '"Noto Sans Devanagari", "Nirmala UI", Mangal, sans-serif'], ['Serif', 'Georgia, "Noto Serif Devanagari", serif'], ['Bold Impact', 'Impact, "Noto Sans Devanagari", sans-serif'], ['Handwriting', '"Comic Sans MS", cursive']];
export const COUNTS = { motions: MOTIONS.length, fx: FX.length - 1, transitions: TRANS.length, filters: FILTERS.length, textAnims: TEXT_ANIMS.length - 1, particles: PARTICLES.length - 1, backgrounds: BACKGROUNDS.length };

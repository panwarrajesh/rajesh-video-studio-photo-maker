// Effect registry. fn(intensity, t, u) -> { filter, transform, overlay:[styles], rgb, mblur, distort, pixel }
// u = progress through the effect clip (0..1). Add a new effect = add a key.
const noise = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

export const EFFECTS = {
  blur: { label: 'Blur', fn: (i) => ({ filter: `blur(${i * 10}px)` }) },
  glow: { label: 'Glow', fn: (i) => ({ filter: `brightness(${1 + 0.3 * i}) saturate(${1 + 0.5 * i}) drop-shadow(0 0 ${i * 14}px rgba(255,255,255,.6))` }) },
  shake: { label: 'Shake', fn: (i, t) => ({ transform: `translate(${Math.sin(t * 61) * i * 14}px,${Math.cos(t * 47) * i * 14}px)` }) },
  zoom: { label: 'Zoom', fn: (i, t, u) => ({ transform: `scale(${1 + i * 0.6 * u})` }) },
  flash: { label: 'Flash', fn: (i, t, u) => ({ overlay: [{ background: '#fff', opacity: i * Math.max(0, 1 - u * 3) }] }) },
  fade: { label: 'Fade to black', fn: (i, t, u) => ({ overlay: [{ background: '#000', opacity: Math.min(1, i * u) }] }) },
  glitch: { label: 'Glitch', fn: (i, t) => { const on = Math.sin(t * 23) > 0.2; return { rgb: on ? i * 14 : 0, transform: on ? `translateX(${Math.sin(t * 90) * i * 18}px)` : undefined }; } },
  rgb: { label: 'RGB Shift', fn: (i) => ({ rgb: i * 10 }) },
  pixelate: { label: 'Pixelate', fn: (i) => ({ pixel: 4 + i * 36 }) },
  vignette: { label: 'Vignette', fn: (i) => ({ overlay: [{ background: `radial-gradient(circle at center, transparent ${70 - i * 40}%, rgba(0,0,0,${0.4 + 0.6 * i}) 100%)` }] }) },
  noise: { label: 'Noise', fn: (i, t) => ({ overlay: [{ backgroundImage: noise, opacity: i * 0.5, mixBlendMode: 'overlay', backgroundPosition: `${(t * 997) % 200}px ${(t * 577) % 200}px` }] }) },
  motionblur: { label: 'Motion Blur', fn: (i) => ({ mblur: i * 14 }) },
  lightleak: { label: 'Light Leak', fn: (i, t) => ({ overlay: [{ background: `radial-gradient(circle at ${50 + 40 * Math.sin(t * 1.3)}% ${30 + 20 * Math.cos(t)}%, rgba(255,140,60,.9), rgba(255,60,120,.4) 40%, transparent 65%)`, mixBlendMode: 'screen', opacity: i }] }) },
  distort: { label: 'Distortion', fn: (i) => ({ distort: i * 40 }) },
  speedlines: { label: 'Speed Lines', fn: (i, t) => {
    const mask = 'radial-gradient(circle, transparent 35%, #000 80%)';
    return { overlay: [{ background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.9) 0deg .6deg, transparent .6deg 5deg)', WebkitMaskImage: mask, maskImage: mask, opacity: i * 0.7, transform: `rotate(${t * 40}deg) scale(1.5)` }] };
  } },
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

import { MOTIONS, TRANS, FILTERS, clamp, rnd } from './presets.js';

export const layout = (slides) => { let t = 0; return slides.map((s, i) => { const o = { ...s, start: t, tr: i ? Math.min(s.transDur ?? 0.7, s.dur * 0.6) : 0 }; t += s.dur; return o; }); };
export const total = (L) => L.reduce((a, s) => a + s.dur, 0);
const eo = (p) => 1 - (1 - p) ** 3;
const pulseAt = (st, t) => {
  if (!st.beatFx || !st.beats?.length) return 0;
  let lo = 0, hi = st.beats.length - 1, b = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (st.beats[m] <= t) { b = m; lo = m + 1; } else hi = m - 1; }
  return b < 0 ? 0 : Math.exp(-(t - st.beats[b]) * 7);
};
const cache = {};
const scratch = (st, k) => { const key = `${st.W}x${st.H}:${k}`; return (cache[key] ||= st.mk(st.W, st.H)); };

function drawImg(ctx, img, W, H, m, fit, flip) {
  const iw = img.videoWidth || img.width, ih = img.videoHeight || img.height;
  if (!iw || !ih) return;
  const base = fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih), sc = base * (m.s || 1);
  ctx.save(); ctx.translate(W / 2 + (m.x || 0) * W, H / 2 + (m.y || 0) * H); ctx.rotate(m.r || 0); ctx.scale(flip ? -sc : sc, sc);
  ctx.drawImage(img, -iw / 2, -ih / 2); ctx.restore();
}
const heart = (c, x, y, s) => { c.beginPath(); c.moveTo(x, y + s * 0.35); c.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.5, y - s, x, y - s * 0.45); c.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.3, x, y + s * 0.35); c.fill(); };
const spark = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); };

function drawBg(ctx, st, t, img) {
  const { W, H } = st, b = st.bg.type;
  const grad = (stops) => { const g = ctx.createLinearGradient(0, 0, W * 0.3, H); stops.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  if (b === 'Blurred Photo' && img) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.filter = 'blur(28px) brightness(.7)'; drawImg(ctx, img, W, H, { s: 1.25 }, 'cover'); ctx.filter = 'none'; }
  else if (b === 'Solid Color') { ctx.fillStyle = st.bg.color || '#101828'; ctx.fillRect(0, 0, W, H); }
  else if (b === 'Sunset') grad([[0, '#2b1055'], [0.5, '#d53369'], [1, '#ffb347']]);
  else if (b === 'Ocean') grad([[0, '#0f2027'], [0.5, '#2c5364'], [1, '#00c6ff']]);
  else if (b === 'Purple Haze') grad([[0, '#1a0033'], [0.6, '#6a11cb'], [1, '#ff6ec4']]);
  else if (b === 'Animated Gradient') grad([[0, `hsl(${(t * 18) % 360},70%,40%)`], [1, `hsl(${(t * 18 + 90) % 360},75%,55%)`]]);
  else if (b === 'Aurora') {
    grad([[0, '#050816'], [1, '#0b1a2e']]); ctx.globalCompositeOperation = 'lighter';
    [['#2cff9a', 0], ['#27c3ff', 1.7], ['#9b5cff', 3.1]].forEach(([c, ph], k) => {
      ctx.beginPath(); ctx.moveTo(0, H * 0.9);
      for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, H * (0.3 + k * 0.08) + Math.sin((x / W) * 5 + t * 0.6 + ph) * H * 0.06);
      ctx.lineTo(W, H * 0.9); ctx.closePath();
      const g = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.9); g.addColorStop(0, `${c}00`); g.addColorStop(0.5, `${c}66`); g.addColorStop(1, `${c}00`); ctx.fillStyle = g; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  } else if (b === 'Night City') {
    grad([[0, '#0a0f2c'], [0.6, '#3b2a6b'], [1, '#ff7a59']]); ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.3 + 0.7 * rnd(i, Math.floor(t * 2)); ctx.fillRect(rnd(i, 1) * W, rnd(i, 2) * H * 0.5, 2, 2); }
    ctx.globalAlpha = 1;
    [0, 1].forEach((layer) => {
      const bw = W * 0.08, sp = (layer + 1) * 8, i0 = Math.floor((t * sp) / bw) - 1;
      for (let idx = i0; idx < i0 + Math.ceil(W / bw) + 3; idx++) {
        const h = H * (0.2 + layer * 0.12) * (0.6 + rnd(idx, layer)), bx = idx * bw - t * sp;
        ctx.fillStyle = layer ? '#0b0c1a' : '#17143a'; ctx.fillRect(bx, H - h, bw * 0.92, h);
        if (layer) for (let r = 0; r < h / (bw * 0.3); r++) for (let c = 0; c < 3; c++) if (rnd(idx * 31 + r * 3 + c, Math.floor(t * 0.4)) > 0.65) { ctx.fillStyle = '#ffd36b'; ctx.fillRect(bx + bw * 0.12 + c * bw * 0.27, H - h + bw * 0.2 + r * bw * 0.3, bw * 0.14, bw * 0.12); }
      }
    });
  } else if (b === 'Ocean Waves') {
    grad([[0, '#7ec8ff'], [0.5, '#1c6ea4'], [1, '#04293a']]);
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += W / 30) ctx.lineTo(x, H * (0.55 + k * 0.1) + Math.sin((x / W) * 6 + t * (0.8 + k * 0.3) + k) * H * 0.025); ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = `rgba(${10 + k * 10},${80 + k * 20},${140 + k * 20},.55)`; ctx.fill(); }
  } else if (b === 'Starfield') {
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff';
    for (let i = 0; i < 140; i++) { const z = (rnd(i, 1) + t * 0.08 * (0.4 + rnd(i, 2))) % 1; ctx.globalAlpha = z; ctx.beginPath(); ctx.arc(W / 2 + (rnd(i, 3) - 0.5) * W * 2 * z, H / 2 + (rnd(i, 4) - 0.5) * H * 2 * z, z * 2.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  } else if (b === 'Uploaded Video' && st.bg.video && st.bg.video.readyState >= 2) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); drawImg(ctx, st.bg.video, W, H, { s: 1 }, 'cover'); }
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
}

function drawSlide(ctx, st, s, t, entry) {
  const img = st.imgs[s.id]; if (!img) return;
  const { W, H } = st, u = clamp((t - s.start) / s.dur, 0, 1.3), pulse = pulseAt(st, t), f = Math.floor(t * 30);
  const m = { s: 1, x: 0, y: 0, r: 0, ...(MOTIONS[s.motion] || MOTIONS[0]).fn(u, t) };
  if (s.fx === 'Beat Zoom') m.s *= 1 + 0.06 * pulse;
  if (s.fx === 'Shake') { m.x += (rnd(f, 1) - 0.5) * 0.014; m.y += (rnd(f, 2) - 0.5) * 0.014; }
  ctx.save(); ctx._tf = '';
  if (entry != null) TRANS[s.trans]?.fn(ctx, entry, W, H);
  const filt = [FILTERS[s.filter]?.css, st.adjust, ctx._tf].filter(Boolean).join(' ');
  if (s.fx === 'Parallax 3D') { ctx.save(); ctx.globalAlpha *= 0.9; ctx.filter = `blur(8px) brightness(.8)${filt ? ' ' + filt : ''}`; drawImg(ctx, img, W, H, { ...m, s: m.s * 1.3, x: -m.x * 2 - 0.02 * Math.sin(t), y: -m.y * 2 }, st.fit); ctx.restore(); }
  ctx.filter = filt || 'none';
  drawImg(ctx, img, W, H, s.fx === 'Parallax 3D' ? { ...m, x: m.x + 0.025 * Math.sin(t * 0.9), s: m.s * 1.02 } : m, st.fit, s.flip);
  ctx.restore(); ctx.filter = 'none';
}

function postFx(ctx, st, s, t) {
  const { W, H } = st, f = Math.floor(t * 12), pulse = pulseAt(st, t), lt = t - s.start;
  ctx.save();
  if (s.fx === 'Glitch' && rnd(f) > 0.5) for (let k = 0; k < 4; k++) { const y = rnd(f, k) * H, h = rnd(f, k + 9) * H * 0.08 + 4; ctx.drawImage(ctx.canvas, 0, y, W, h, (rnd(f, k + 5) - 0.5) * W * 0.12, y, W, h); }
  if (s.fx === 'RGB Split' || (s.fx === 'Glitch' && rnd(f) > 0.5)) {
    const a = scratch(st, 0), b = scratch(st, 1), d = W * 0.007 * (1 + pulse * 2);
    [[a, '#f00'], [b, '#0ff']].forEach(([cv, col]) => { const c = cv.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.drawImage(ctx.canvas, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(a, -d, 0); ctx.drawImage(b, d, 0);
  }
  if (s.fx === 'Flash') { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6 * Math.max(pulse, Math.max(0, 1 - lt * 4)); ctx.fillRect(0, 0, W, H); }
  if (s.fx === 'Vignette') { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (s.fx === 'Film Grain') grain(ctx, st, t, 0.18);
  if (s.fx === 'Light Leak') { ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(W * (0.5 + 0.4 * Math.sin(t * 0.8)), H * (0.3 + 0.2 * Math.cos(t * 0.6)), 0, W * 0.5, H * 0.4, W * 0.9); g.addColorStop(0, 'rgba(255,150,60,.75)'); g.addColorStop(0.45, 'rgba(255,60,120,.3)'); g.addColorStop(1, 'rgba(255,60,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (s.fx === 'Glow') { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.4; ctx.filter = 'blur(14px)'; ctx.drawImage(ctx.canvas, 0, 0); }
  if (s.fx === 'VHS Lines') { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5); const y = (t * 120) % H; ctx.drawImage(ctx.canvas, 0, y, W, 14, (rnd(f) - 0.5) * 16, y, W, 14); }
  if (s.fx === 'Film Burn') { const a = Math.max(0, 1 - lt * 2.5) + Math.max(0, 1 - (s.dur - lt) * 2.5); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = clamp(a) * 0.9; const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff9d00'); g.addColorStop(1, '#ff2d55'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (s.fx === 'Blur Pulse' && pulse > 0.05) { ctx.globalAlpha = 0.6 * pulse; ctx.filter = `blur(${pulse * 8}px)`; ctx.drawImage(ctx.canvas, 0, 0); }
  ctx.restore();
}
function grain(ctx, st, t, a) {
  const n = (cache.noise ||= (() => { const c = st.mk(128, 128), g = c.getContext('2d'), d = g.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; })());
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay'; const ox = (rnd(Math.floor(t * 24), 1) * 128) | 0, oy = (rnd(Math.floor(t * 24), 2) * 128) | 0;
  for (let x = -ox; x < st.W; x += 128) for (let y = -oy; y < st.H; y += 128) ctx.drawImage(n, x, y);
  ctx.restore();
}

function drawParticles(ctx, st, t) {
  const { W, H } = st, type = st.particles.type, n = st.particles.n;
  if (!type || type === 'None') return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3), r4 = rnd(i, 4);
    if (type === 'Sparkles') { const a = 0.5 + 0.5 * Math.sin(t * (2 + r4 * 3) + i); ctx.globalAlpha = a; ctx.fillStyle = r3 > 0.5 ? '#fff6c8' : '#ffffff'; spark(ctx, r1 * W, r2 * H, (2 + r3 * 7) * (W / 540) * (0.4 + a)); }
    else if (type === 'Snow') { ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((r1 * W + Math.sin(t + i) * 20) % W, (t * (25 + r2 * 55) + r3 * H) % H, (1.5 + r4 * 3.5) * (W / 540), 0, 7); ctx.fill(); }
    else if (type === 'Hearts') { ctx.globalAlpha = 0.75; ctx.fillStyle = r3 > 0.5 ? '#ff4d79' : '#ff9ebd'; heart(ctx, r1 * W + Math.sin(t * 1.2 + i) * 25, H - ((t * (30 + r2 * 40) + r4 * H) % (H * 1.1)), (8 + r3 * 14) * (W / 540)); }
    else if (type === 'Bokeh') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.1 + 0.1 * Math.sin(t + i); ctx.fillStyle = ['#ffd27a', '#ff9ec7', '#9ad7ff'][i % 3]; ctx.beginPath(); ctx.arc((r1 * W + Math.sin(t * 0.3 + i) * 40) % W, (r2 * H - t * (6 + r3 * 10) + H * 2) % H, (20 + r4 * 60) * (W / 540), 0, 7); ctx.fill(); }
    else if (type === 'Stars') { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + r3 * 2) + i)); ctx.fillStyle = '#fff'; ctx.fillRect(r1 * W, r2 * H, 2 * (W / 540) * (1 + r4), 2 * (W / 540) * (1 + r4)); }
    else if (type === 'Confetti') { ctx.save(); ctx.translate((r1 * W + Math.sin(t + i) * 30) % W, (t * (60 + r2 * 90) + r3 * H) % H); ctx.rotate(t * (2 + r4 * 4) + i); ctx.fillStyle = `hsl(${r4 * 360},90%,60%)`; ctx.fillRect(-4, -2, 9 * (W / 540), 5 * (W / 540)); ctx.restore(); }
    else if (type === 'Fireflies') { const x = r1 * W + Math.sin(t * 0.7 + i * 2) * 60, y = r2 * H + Math.cos(t * 0.5 + i) * 50, r = (6 + r3 * 10) * (W / 540); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,240,140,${0.5 + 0.5 * Math.sin(t * 2 + i)})`); g.addColorStop(1, 'rgba(255,240,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    else if (type === 'Rain') { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 1; const x = r1 * W, y = (t * (400 + r2 * 300) + r3 * H) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 18 * (W / 540)); ctx.stroke(); }
  }
  ctx.restore();
}

function drawText(ctx, st, s, t) {
  if (!s.text) return;
  const { W, H } = st, tx = st.text, lt = t - s.start - 0.15, p = s.anim === 'None' ? 1 : clamp(lt / 0.7);
  if (lt < 0 && s.anim !== 'None') return;
  const fs = tx.size * W, a0 = clamp((s.start + s.dur - t) / 0.3);
  let a = a0, dx = 0, dy = 0, sc = 1, blur = 0, text = String(s.text);
  const an = s.anim, c1 = 1.70158;
  if (an === 'Fade') a *= p; if (an === 'Slide Up') { dy = (1 - eo(p)) * H * 0.06; a *= p; } if (an === 'Slide Left') { dx = -(1 - eo(p)) * W * 0.25; a *= p; }
  if (an === 'Pop') sc = 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2; if (an === 'Bounce') dy = -Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * H * 0.1;
  if (an === 'Zoom') { sc = 0.3 + 0.7 * eo(p); a *= p; } if (an === 'Blur In') { blur = (1 - p) * 14; a *= p; }
  if (an === 'Typewriter') text = text.slice(0, Math.ceil(text.length * p));
  if (an === 'Glitch') dx = (rnd(Math.floor(t * 20), 5) - 0.5) * W * 0.03 * (p < 1 || rnd(Math.floor(t * 4)) > 0.8 ? 1 : 0);
  const lines = text.split('\n'), lh = fs * 1.25, cy = { Top: 0.2, Middle: 0.5, Bottom: 0.8 }[s.pos] * H;
  ctx.save(); ctx.translate(W / 2 + dx, cy + dy); ctx.scale(sc, sc); ctx.globalAlpha = a; ctx.font = `800 ${fs}px ${tx.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (blur) ctx.filter = `blur(${blur}px)`;
  const y0 = -((lines.length - 1) * lh) / 2;
  if (tx.bg) { const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 1) + fs, h = lines.length * lh + fs * 0.3; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, fs * 0.4); else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); }
  lines.forEach((l, k) => {
    const y = y0 + k * lh;
    if (an === 'Glitch') { ctx.fillStyle = 'rgba(255,0,80,.7)'; ctx.fillText(l, -fs * 0.05, y); ctx.fillStyle = 'rgba(0,220,255,.7)'; ctx.fillText(l, fs * 0.05, y); }
    ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(l, 0, y); ctx.fillStyle = tx.color; ctx.fillText(l, 0, y);
  });
  ctx.restore();
}

export function drawFrame(ctx, st, t) {
  const { W, H } = st, L = st.slides, tot = total(L);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  if (!L.length) { drawBg(ctx, st, t, null); ctx.fillStyle = '#fff'; ctx.font = `700 ${W * 0.05}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Add photos to start', W / 2, H / 2); ctx.restore(); return; }
  t = clamp(t, 0, Math.max(0, tot - 0.001));
  let i = L.length - 1; while (i > 0 && L[i].start > t) i--;
  const s = L[i], lt = t - s.start;
  drawBg(ctx, st, t, st.imgs[s.id]);
  if (i > 0 && lt < s.tr) { drawSlide(ctx, st, L[i - 1], t, null); drawSlide(ctx, st, s, t, clamp(lt / s.tr)); } else drawSlide(ctx, st, s, t, null);
  postFx(ctx, st, s, t); drawParticles(ctx, st, t);
  if (st.cine) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    grain(ctx, st, t, 0.1); ctx.fillStyle = '#000'; const bar = H * 0.07; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  }
  drawText(ctx, st, s, t);
  const fade = Math.min(clamp(t / 0.5), clamp((tot - t) / 0.6)); if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

// "Transition in": plays during the first `transDur` seconds of a clip. u goes 0 -> 1.
const T = {
  none: { label: 'None', fx: () => ({}) },
  fade: { label: 'Fade (from black)', fx: (u) => ({ filter: `brightness(${u})` }) },
  crossfade: { label: 'Cross Fade', fx: (u) => ({ opacity: u }) },
  slideLeft: { label: 'Slide Left', fx: (u) => ({ transform: `translateX(${(1 - u) * 100}%)` }) },
  slideRight: { label: 'Slide Right', fx: (u) => ({ transform: `translateX(${(u - 1) * 100}%)` }) },
  slideUp: { label: 'Slide Up', fx: (u) => ({ transform: `translateY(${(1 - u) * 100}%)` }) },
  slideDown: { label: 'Slide Down', fx: (u) => ({ transform: `translateY(${(u - 1) * 100}%)` }) },
  zoom: { label: 'Zoom', fx: (u) => ({ transform: `scale(${0.2 + 0.8 * u})`, opacity: u }) },
  circle: { label: 'Circle', fx: (u) => ({ clipPath: `circle(${u * 75}% at 50% 50%)` }) },
  blur: { label: 'Blur', fx: (u) => ({ filter: `blur(${(1 - u) * 20}px)`, opacity: u }) },
  wipe: { label: 'Wipe', fx: (u) => ({ clipPath: `inset(0 ${(1 - u) * 100}% 0 0)` }) },
};
export const TRANSITIONS = T;
export function transitionFx(type, elapsed, dur) {
  if (!type || type === 'none' || elapsed >= dur) return null;
  const u = Math.max(0, elapsed / dur);
  return T[type]?.fx(u * u * (3 - 2 * u)) || null;
}

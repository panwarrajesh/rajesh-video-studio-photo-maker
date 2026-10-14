// Original CSS-based filters. Add a new one = add a key. `a` is intensity 0..1.
export const FILTERS = {
  original: { label: 'Original', css: () => '' },
  bright: { label: 'Bright', css: (a) => `brightness(${1 + 0.4 * a}) saturate(${1 + 0.1 * a})` },
  contrast: { label: 'Contrast', css: (a) => `contrast(${1 + 0.5 * a})` },
  warm: { label: 'Warm', css: (a) => `sepia(${0.3 * a}) saturate(${1 + 0.3 * a}) hue-rotate(${-10 * a}deg)` },
  cool: { label: 'Cool', css: (a) => `hue-rotate(${15 * a}deg) saturate(${1 + 0.1 * a}) brightness(${1 + 0.03 * a})` },
  vintage: { label: 'Vintage', css: (a) => `sepia(${0.6 * a}) contrast(${1 + 0.1 * a}) saturate(${1 - 0.2 * a}) brightness(${1 - 0.05 * a})` },
  bw: { label: 'Black & White', css: (a) => `grayscale(${a})` },
  cinematic: { label: 'Cinematic', css: (a) => `contrast(${1 + 0.2 * a}) saturate(${1 - 0.15 * a}) brightness(${1 - 0.1 * a}) sepia(${0.15 * a})` },
  fade: { label: 'Fade', css: (a) => `contrast(${1 - 0.25 * a}) brightness(${1 + 0.1 * a}) saturate(${1 - 0.3 * a})` },
  highcontrast: { label: 'High Contrast', css: (a) => `contrast(${1 + a}) saturate(${1 + 0.2 * a})` },
  soft: { label: 'Soft', css: (a) => `blur(${1.2 * a}px) brightness(${1 + 0.05 * a}) contrast(${1 - 0.1 * a})` },
  night: { label: 'Night', css: (a) => `brightness(${1 - 0.4 * a}) sepia(${0.5 * a}) hue-rotate(${180 * a}deg) saturate(${1 + 0.5 * a})` },
};
export const filterCss = (name, amt) => FILTERS[name]?.css(amt) || '';

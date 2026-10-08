export function getDuration(file) {
  if (file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((ok) => {
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio'), url = URL.createObjectURL(file);
    const done = (v) => { URL.revokeObjectURL(url); ok(v); };
    el.preload = 'metadata'; el.onloadedmetadata = () => done(el.duration); el.onerror = () => done(null);
    setTimeout(() => done(null), 5000); el.src = url;
  });
}
// Small JPEG preview (data URL) + size of a local photo/video, used as the project thumbnail.
export function fileThumb(file, w = 200) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const t = setTimeout(() => done(null), 6000);
    const done = (v) => { clearTimeout(t); URL.revokeObjectURL(url); ok(v); };
    const draw = (el, iw, ih) => {
      try { const c = document.createElement('canvas'); c.width = w; c.height = Math.round((w * ih) / iw); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); done({ thumb: c.toDataURL('image/jpeg', 0.6), w: iw, h: ih }); }
      catch { done(null); }
    };
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); }; v.onseeked = () => draw(v, v.videoWidth, v.videoHeight); v.onerror = () => done(null); v.src = url;
    } else if (file.type.startsWith('image/')) {
      const im = new Image(); im.onload = () => draw(im, im.width, im.height); im.onerror = () => done(null); im.src = url;
    } else done(null);
  });
}

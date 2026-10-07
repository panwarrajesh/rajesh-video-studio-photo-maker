import { useEffect, useRef } from 'react';

export function FxDefs({ rgb, mblur, distort }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
      <filter id="fx-rgb" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feOffset in="r" dx={rgb} result="ro" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feOffset in="b" dx={-rgb} result="bo" />
        <feBlend in="ro" in2="g" mode="screen" result="rg" /><feBlend in="rg" in2="bo" mode="screen" />
      </filter>
      <filter id="fx-mblur"><feGaussianBlur stdDeviation={`${mblur} 0`} /></filter>
      <filter id="fx-distort"><feTurbulence type="turbulence" baseFrequency="0.01 0.02" numOctaves="1" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={distort} xChannelSelector="R" yChannelSelector="G" /></filter>
    </defs></svg>
  );
}

// Draws the current frame into a tiny canvas and scales it up, giving a pixelated look.
export function Pixelate({ stage, size }) {
  const cv = useRef();
  useEffect(() => {
    const st = stage.current, c = cv.current;
    if (!st || !c) return;
    const src = [...st.querySelectorAll('video,img')].find((e) => e.style.display !== 'none' && (e.videoWidth || e.naturalWidth));
    const w = Math.max(8, Math.round(st.clientWidth / size)), h = Math.max(8, Math.round(st.clientHeight / size));
    c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (src) g.drawImage(src, 0, 0, w, h);
  });
  return <canvas ref={cv} className="ovfx pix" />;
}

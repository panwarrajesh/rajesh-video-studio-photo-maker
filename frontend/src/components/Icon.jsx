const P = {
  play: 'M7 4l13 8-13 8z', pause: 'M7 5h4v14H7zM13 5h4v14h-4z', stop: 'M6 6h12v12H6z',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3', redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  scissors: 'M6 3a3 3 0 100 6 3 3 0 000-6zM6 15a3 3 0 100 6 3 3 0 000-6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', plus: 'M12 5v14M5 12h14',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16', back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12M18 6L6 18',
  type: 'M5 6V4h14v2M12 4v16M9 20h6', smile: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeoff: 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3 3.5M6.6 6.7A16 16 0 002 12s4 7 10 7a9.7 9.7 0 004.4-1M9.9 9.9a3 3 0 004.2 4.2',
  volume: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6', volumeoff: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6', flag: 'M5 21V4M5 4h11l-2 4 2 4H5', copy: 'M9 9h11v11H9zM5 15V4h11',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z', mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 18v3',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M9 9h.01', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', dots: 'M12 5h.01M12 12h.01M12 19h.01', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
};
const FILLED = new Set(['play', 'pause', 'stop']);
export function Icon({ name, size = 20 }) {
  const f = FILLED.has(name);
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={f ? 'currentColor' : 'none'} stroke={f ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>;
}
export function Logo({ big }) {
  const s = big ? 40 : 28;
  return (
    <div className="logo">
      <svg width={s} height={s} viewBox="0 0 32 32"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b4cff" /><stop offset="1" stopColor="#2f9bff" /></linearGradient></defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" /><path d="M12 9.5v13l11-6.5z" fill="#fff" /></svg>
      <span style={{ fontSize: big ? 22 : 15 }}>Rajesh Video Studio</span>
    </div>
  );
}

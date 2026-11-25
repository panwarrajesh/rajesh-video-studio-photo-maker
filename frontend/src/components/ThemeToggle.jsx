import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rvs_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rvs_theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <button
      className="ib"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      style={{
        borderRadius: '10px',
        background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        color: 'var(--text)',
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

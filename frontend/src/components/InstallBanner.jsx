import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { isNative } from '../services/api.js';

const standalone = () => !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone);

// "Install app" card: Direct APK download + real one-tap PWA install on Android Chrome
export default function InstallBanner() {
  const [ev, setEv] = useState(null);
  const [hide, setHide] = useState(() => localStorage.getItem('rvs_install_hide') === '1' || standalone() || isNative());

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEv(e); }, onInstalled = () => setHide(true);
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (hide) return null;

  return (
    <div className="install" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.15))', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '16px', marginBottom: '14px' }}>
      <i style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}>
        <Icon name="download" size={20} />
      </i>
      <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column' }}>
        <b style={{ color: '#fff', fontSize: '14px' }}>📱 Install Rajesh Video Studio on Mobile</b>
        <small style={{ color: '#94a3b8', fontSize: '12px' }}>
          Apne phone me native Android app chalayein. APK download karein ya direct install karein.
        </small>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <a
          href="/Rajesh-Video-Studio.apk"
          download="Rajesh-Video-Studio.apk"
          className="btn primary sm"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: '10px', fontWeight: 600, fontSize: '13px' }}
        >
          <span>⬇️ Download APK</span>
          <span style={{ opacity: 0.85, fontSize: '11px', fontWeight: 400 }}>(3.9 MB)</span>
        </a>
        {ev && (
          <button
            className="btn sm"
            style={{ padding: '7px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: '13px' }}
            onClick={async () => { ev.prompt(); await ev.userChoice; setEv(null); }}
          >
            ⚡ 1-Tap Install
          </button>
        )}
      </div>
      <button
        className="ib"
        title="Dismiss"
        style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
        onClick={() => { localStorage.setItem('rvs_install_hide', '1'); setHide(true); }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

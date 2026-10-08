import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';

const standalone = () => !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone);

// "Install app" card: real one-tap install on Android Chrome, short instructions on iPhone / other browsers.
export default function InstallBanner() {
  const [ev, setEv] = useState(null);
  const [hide, setHide] = useState(() => localStorage.getItem('rvs_install_hide') === '1' || standalone() || !!window.Capacitor?.isNativePlatform?.());
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEv(e); }, onInstalled = () => setHide(true);
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (hide) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="install">
      <i><Icon name="download" size={20} /></i>
      <div><b>Install RVS on your phone</b><small>{ev ? 'Opens full screen, like a real app.' : ios ? 'Tap Share, then “Add to Home Screen”.' : 'Chrome menu ⋮ → “Install app”.'}</small></div>
      {ev && <button className="btn primary sm" onClick={async () => { ev.prompt(); await ev.userChoice; setEv(null); }}>Install</button>}
      <button className="ib" title="Dismiss" onClick={() => { localStorage.setItem('rvs_install_hide', '1'); setHide(true); }}><Icon name="close" size={18} /></button>
    </div>
  );
}

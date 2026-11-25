import { Icon } from './Icon.jsx';

export default function NotificationsModal({ open, onClose }) {
  if (!open) return null;

  const notifs = [
    { id: 1, title: '⚡ Cloud GPU Auto-Saver Active', desc: '1 active project rehta hai. New video start hone par purani storage auto-clean hoti hai.', time: 'Just now', icon: 'sparkles', color: '#10b981' },
    { id: 2, title: '📲 Android APK Ready', desc: 'Rajesh Video Studio native APK ready for download (3.9 MB).', time: '10m ago', icon: 'download', color: '#6366f1' },
    { id: 3, title: '🎵 Web Audio Studio Live', desc: '16-pad drum machine and polyphonic synthesizer active with zero latency.', time: '1h ago', icon: 'music', color: '#ec4899' },
  ];

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="bell" size={18} />
            <b>Notifications</b>
          </div>
          <button className="ib" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifs.map((n) => (
            <div key={n.id} style={{ display: 'flex', gap: '12px', padding: '10px', background: 'var(--s2)', borderRadius: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: n.color, display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}>
                <Icon name={n.icon} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: '13px', display: 'block' }}>{n.title}</b>
                <small className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>{n.desc}</small>
                <small style={{ fontSize: '10px', color: '#888', marginTop: '4px', display: 'block' }}>{n.time}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, upload, isNative } from '../services/api.js';
import { getDuration, fileThumb } from '../utils/media.js';
import { useAuth } from '../store/auth.js';
import { Icon, Logo } from '../components/Icon.jsx';
import InstallBanner from '../components/InstallBanner.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import GlobalCreativeSearch, { STUDIOS_CATALOG } from '../components/GlobalCreativeSearch.jsx';
import AiAssistantModal from '../components/AiAssistantModal.jsx';
import NotificationsModal from '../components/NotificationsModal.jsx';

const RES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

export default function Dashboard() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const [list, setList] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
      return [...local, ...cached];
    } catch {
      return [];
    }
  });
  const [q, setQ] = useState(''); const [sort, setSort] = useState('recent');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const [modal, setModal] = useState(false); const [menu, setMenu] = useState(null); const [pm, setPm] = useState(false);
  const [busy, setBusy] = useState(null); const fileRef = useRef();
  const [f, setF] = useState({ name: 'Untitled project', ratio: '9:16', fps: 30 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api(`/projects?q=${encodeURIComponent(q)}`)
      .then((d) => {
        const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
        const combined = [...local, ...d];
        setList(combined);
        try { localStorage.setItem('rvs_cached_projects', JSON.stringify(d)); } catch {}
        setErr('');
        setServerWaking(false);
      })
      .catch((e) => {
        console.warn('Projects API unavailable (server sleeping or offline):', e);
        const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
        const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
        const combined = [...local, ...cached];
        if (combined.length) {
          setList(combined);
          setServerWaking(true);
          setErr('');
        } else {
          setServerWaking(true);
          setErr('⚡ Cloud server start ho raha hai (Render free tier). Offline mode active hai — aap bina ruke direct "New video" bana sakte hain!');
        }
      })
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const shown = useMemo(() => (sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list), [list, sort]);
  const act = (fn) => async () => { setMenu(null); try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };

  const STUDIO_TAB_MAP = {
    video: 'media',
    photo: 'media',
    music: 'beatmaker',
    sound: 'soundfx',
    ai: 'ailab',
    animation: 'stickers',
    design: 'text',
    podcast: 'voiceover',
    screen: 'media',
    academy: 'beatmaker',
    marketplace: 'templates',
    reel: 'templates',
  };

  const openStudioInEditor = (tabName = 'media') => {
    let p = null;
    const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
    const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
    const combined = [...local, ...cached];

    if (combined.length > 0) {
      p = combined[0];
    } else {
      p = {
        id: `local-${Date.now()}`,
        name: `Project ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`,
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 5,
        updatedAt: new Date().toISOString(),
        isLocal: true,
      };
      local.unshift(p);
      localStorage.setItem('rvs_local_projects', JSON.stringify(local));
    }

    nav(`/editor/${p.id}?tab=${tabName}`);
  };

  async function create(e) {
    e.preventDefault();
    const [width, height] = RES[f.ratio];
    let p = null;
    try {
      p = await api('/projects', { method: 'POST', body: { name: f.name, width, height, fps: Number(f.fps) } });
    } catch (x) {
      console.warn('Server offline/waking, creating offline local project:', x);
      p = {
        id: `local-${Date.now()}`,
        name: f.name || 'Offline Video',
        width,
        height,
        fps: Number(f.fps),
        duration: 5,
        updatedAt: new Date().toISOString(),
        isLocal: true,
      };
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      local.unshift(p);
      localStorage.setItem('rvs_local_projects', JSON.stringify(local));
    }
    nav(`/editor/${p.id}`);
  }

  // "New video": pick photos/videos from the gallery -> project is created -> media uploaded or prepared locally -> editor opens with clips on timeline
  async function startFromMedia(files) {
    files = files.filter((f) => /^(image|video)\//.test(f.type)); if (!files.length) return;
    setErr(''); setBusy({ msg: 'Preparing…', pct: 5 });
    try {
      const first = await fileThumb(files[0]), r = first ? first.w / first.h : 0.5625;
      const ratio = r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1', [width, height] = RES[ratio];
      let p = null;
      try {
        p = await api('/projects', { method: 'POST', body: { name: `Project ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`, width, height, fps: 30 } });
      } catch (x) {
        p = {
          id: `local-${Date.now()}`,
          name: `Project ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`,
          width,
          height,
          fps: 30,
          duration: 5,
          updatedAt: new Date().toISOString(),
          isLocal: true,
        };
        const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
        local.unshift(p);
        localStorage.setItem('rvs_local_projects', JSON.stringify(local));
      }

      const ids = [];
      const localMediaList = [];
      for (let i = 0; i < files.length; i++) {
        setBusy({ msg: `Loading ${i + 1} of ${files.length}…`, pct: 10 + Math.round((i / files.length) * 85) });
        const curFile = files[i];
        let m = null;
        if (!p.isLocal) {
          try {
            const fd = new FormData(); fd.append('projectId', p.id);
            const d = await getDuration(curFile); if (d) fd.append('duration', d);
            fd.append('file', curFile);
            m = await upload('/media/upload', fd);
            ids.push(m.id);
          } catch (e) {
            console.warn('Cloud upload failed, using local fallback:', e);
          }
        }
        if (!m) {
          const d = await getDuration(curFile);
          m = {
            id: `loc-m-${Date.now()}-${i}`,
            projectId: p.id,
            name: curFile.name,
            type: curFile.type.startsWith('video/') ? 'video' : curFile.type.startsWith('image/') ? 'image' : 'audio',
            url: URL.createObjectURL(curFile),
            duration: d || 5,
            size: curFile.size,
          };
          ids.push(m.id);
          localMediaList.push(m);
        }
      }

      if (localMediaList.length) {
        try {
          const existing = JSON.parse(localStorage.getItem(`rvs_media_${p.id}`) || '[]');
          localStorage.setItem(`rvs_media_${p.id}`, JSON.stringify([...localMediaList, ...existing]));
        } catch {}
      }

      if (first && !p.isLocal) await api(`/projects/${p.id}`, { method: 'PUT', body: { thumbnailUrl: first.thumb } }).catch(() => {});
      nav(`/editor/${p.id}?add=${ids.join(',')}`);
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  const first = (user?.name || 'there').split(' ')[0];
  return (
    <div className="page home" onClick={() => { setMenu(null); setPm(false); }}>
      <header className="top">
        <Logo />
        <button
          className="btn sm header-search-btn"
          onClick={() => setSearchOpen(true)}
          style={{ background: 'var(--s2)', border: '1px solid var(--line)', color: 'var(--mut)', borderRadius: '20px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Search studios and tools"
        >
          <Icon name="search" size={14} />
          <span className="header-search-text" style={{ fontSize: '12px' }}>Search…</span>
        </button>
        <span className="grow" />
        <button
          className="btn sm"
          onClick={() => setAiOpen(true)}
          style={{ background: 'linear-gradient(135deg, #a855f722, #6366f133)', border: '1px solid #a855f766', color: '#c084fc', borderRadius: '20px', padding: '5px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          title="Universal AI Assistant"
        >
          <span>🤖</span>
          <span className="header-ai-text">AI</span>
        </button>
        <button className="ib" title="Notifications" onClick={() => setNotifOpen(true)} style={{ width: '36px', height: '36px' }}>
          <Icon name="bell" size={16} />
        </button>
        <ThemeToggle />
        {!isNative() && (
          <a
            href="/Rajesh-Video-Studio.apk"
            download="Rajesh-Video-Studio.apk"
            className="btn sm"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.35))', border: '1px solid rgba(16, 185, 129, 0.6)', color: '#34d399', borderRadius: '20px', padding: '5px 9px', fontSize: '11px', fontWeight: 600 }}
            title="Download Android App APK"
          >
            <Icon name="download" size={13} />
            <span className="apk-badge-text">APK</span>
          </a>
        )}
        <div className="pwrap" onClick={(e) => e.stopPropagation()}>
          <button className="avatar" title="Account" onClick={() => setPm(!pm)}>{first.charAt(0).toUpperCase()}</button>
          {pm && (
            <div className="pmenu right">
              <div className="who"><b>{user?.name || 'Rajesh'}</b><small className="muted">{user?.plan || 'PRO'} plan</small></div>
              {!isNative() && (
                <a href="/Rajesh-Video-Studio.apk" download="Rajesh-Video-Studio.apk" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', textDecoration: 'none', color: '#fff', fontSize: '13px' }}>
                  <Icon name="download" size={16} />
                  <span>Download Android App (.apk)</span>
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        <InstallBanner />
        <h1 className="greet">Hi {first} 👋<span>Creative Studio Suite</span></h1>

        {/* Main Hero Card to jump straight into editing */}
        <div className="editor-entry-hero" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.35))',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <b style={{ fontSize: '16px', color: '#fff', display: 'block' }}>🎬 Video Editor (सारे टूल्स एक जगह)</b>
              <small style={{ color: '#c084fc', fontSize: '12px' }}>Photos, Hindi Titles, Stickers, DAW Beats, Voiceover & Export</small>
            </div>
            <button
              className="btn primary"
              onClick={() => openStudioInEditor('media')}
              style={{ fontWeight: 800, padding: '8px 16px', borderRadius: '12px', fontSize: '13px' }}
            >
              Start Editing →
            </button>
          </div>
        </div>

        {/* Quick Actions Carousel */}
        <div className="quick-actions-bar">
          <button className="quick-action-pill" onClick={() => fileRef.current?.click()}>
            <i>🎬</i> + 1-Tap Pick Video/Photos
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('text')}>
            <i>🇮🇳</i> Hindi Titles
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('stickers')}>
            <i>⭐</i> Pro Stickers
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('effects')}>
            <i>✨</i> Cinema VFX
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('beatmaker')}>
            <i>🎵</i> Beat DAW
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('voiceover')}>
            <i>🎙️</i> Voiceover Mic
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('soundfx')}>
            <i>🔊</i> Sound FX
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('captions')}>
            <i>🎤</i> Auto Captions
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('templates')}>
            <i>⚡</i> Viral Templates
          </button>
          <button className="quick-action-pill" onClick={() => openStudioInEditor('ailab')}>
            <i>🤖</i> AI Studio
          </button>
        </div>

        <div className="storage-info-pill">
          <span>⚡ <b>Auto Storage Saver Active:</b> Single active video project policy active. Nayi video start karne par purani temporary video media auto-clean ho jati hain.</span>
        </div>

        {/* 12 Creative Studios Section */}
        <div className="row sechead" style={{ marginTop: '20px' }}>
          <h2 className="grow">Creative Studios (In-Editor)</h2>
          <small className="muted">{STUDIOS_CATALOG.length} Workspaces</small>
        </div>

        <div className="studio-grid">
          {STUDIOS_CATALOG.map((s) => (
            <div
              key={s.id}
              className="studio-card"
              onClick={() => {
                const targetTab = STUDIO_TAB_MAP[s.id] || 'media';
                openStudioInEditor(targetTab);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="studio-card-icon" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)`, color: '#fff' }}>
                  <Icon name={s.icon} size={22} />
                </div>
                <span className="studio-card-badge">{s.cat}</span>
              </div>
              <div className="studio-card-title">
                <span>{s.name}</span>
                <span style={{ fontSize: '14px', opacity: 0.5 }}>→</span>
              </div>
              <p className="studio-card-desc">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Recent Projects Section */}
        <div className="row sechead" style={{ marginTop: '24px' }}>
          <h2 className="grow">Recent Projects</h2>
          <div className="seg">
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button>
            <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
          </div>
        </div>

        <div className="hero2" style={{ marginBottom: '14px' }}>
          <button className="tile t1" onClick={() => fileRef.current?.click()}>
            <i><Icon name="plus" size={26} /></i><b>New video</b><small>Pick photos & videos</small>
          </button>
          <button className="tile t2" onClick={() => setModal(true)}>
            <i><Icon name="film" size={26} /></i><b>Blank Project</b><small>Custom size & frame rate</small>
          </button>
        </div>

        <label className="search"><Icon name="search" size={18} /><input placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {serverWaking && (
          <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.25))', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '10px 14px', margin: '10px 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#fef08a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚡</span>
              <span><b>Cloud Server wake ho raha hai</b> (Render free tier). Offline mode active — aap direct video bana sakte hain!</span>
            </div>
            <button className="btn sm" onClick={load} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>Check</button>
          </div>
        )}
        {err && !serverWaking && <div className="errbox"><span>{err}</span><button className="btn sm" onClick={load}>Retry</button></div>}
        {loading && !list.length && <div className="plist">{[0, 1, 2].map((i) => <div key={i} className="prow skel" />)}</div>}
        {!loading && !shown.length && !err && <div className="empty2"><i><Icon name="film" size={30} /></i><b>No projects yet</b><small className="muted">Tap “New video” to start your first project.</small></div>}
        <div className="plist">{shown.map((p) => (
          <div key={p.id} className="prow" onClick={() => nav(`/editor/${p.id}`)}>
            <div className="pthumb">{p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" /> : <Icon name="film" size={22} />}</div>
            <div className="pinfo"><b>{p.name} {p.isLocal && <span style={{ fontSize: '10px', background: '#3b82f633', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>OFFLINE</span>}</b><small>{new Date(p.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {p.width}×{p.height} · {Math.round(p.duration || 5)}s</small></div>
            <button className="ib" title="More" onClick={(e) => { e.stopPropagation(); setMenu(menu === p.id ? null : p.id); }}><Icon name="dots" /></button>
            {menu === p.id && <div className="pmenu" onClick={(e) => e.stopPropagation()}>
              <button onClick={act(async () => {
                const n = prompt('Rename project', p.name);
                if (!n) return;
                if (p.isLocal || String(p.id).startsWith('local-')) {
                  const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
                  const item = local.find(x => x.id === p.id);
                  if (item) { item.name = n; localStorage.setItem('rvs_local_projects', JSON.stringify(local)); }
                } else {
                  await api(`/projects/${p.id}`, { method: 'PUT', body: { name: n } });
                }
              })}>Rename</button>
              <button onClick={act(async () => {
                if (p.isLocal || String(p.id).startsWith('local-')) {
                  const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
                  const clone = { ...p, id: `local-${Date.now()}`, name: `${p.name} (Copy)`, updatedAt: new Date().toISOString() };
                  local.unshift(clone);
                  localStorage.setItem('rvs_local_projects', JSON.stringify(local));
                } else {
                  await api(`/projects/${p.id}/duplicate`, { method: 'POST' });
                }
              })}>Duplicate</button>
              <button className="danger" onClick={act(async () => {
                if (confirm('Delete this project?')) {
                  if (p.isLocal || String(p.id).startsWith('local-')) {
                    const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
                    const filtered = local.filter(x => x.id !== p.id);
                    localStorage.setItem('rvs_local_projects', JSON.stringify(filtered));
                    localStorage.removeItem(`rvs_media_${p.id}`);
                    localStorage.removeItem(`rvs_backup_${p.id}`);
                  } else {
                    await api(`/projects/${p.id}`, { method: 'DELETE' });
                  }
                }
              })}>Delete</button></div>}
          </div>))}</div>
      </main>

      {/* Global Modals */}
      <GlobalCreativeSearch open={searchOpen} onClose={() => setSearchOpen(false)} projects={list} />
      <AiAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />

      <input ref={fileRef} hidden type="file" multiple accept="video/*,image/*" onChange={(e) => { startFromMedia([...e.target.files]); e.target.value = ''; }} />
      {busy && <div className="overlay"><div className="card busybox"><div className="spin" /><b>{busy.msg}</b><div className="bar"><i style={{ width: `${busy.pct}%` }} /></div><small className="muted">Keep the app open</small></div></div>}
      {modal && <div className="overlay" onClick={() => setModal(false)}><form className="card auth" onClick={(e) => e.stopPropagation()} onSubmit={create}>
        <h2>New video</h2>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <label className="prop"><span>Size</span><select value={f.ratio} onChange={(e) => setF({ ...f, ratio: e.target.value })}>{[['9:16', '9:16 Reels / Shorts'], ['16:9', '16:9 YouTube'], ['1:1', '1:1 Post'], ['4:5', '4:5 Portrait']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="prop"><span>Frame rate</span><select value={f.fps} onChange={(e) => setF({ ...f, fps: e.target.value })}>{[24, 30, 60].map((r) => <option key={r}>{r}</option>)}</select></label>
        <button className="btn primary">Create & open</button></form></div>}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, isNative } from '../services/api.js';
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
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
      return [...local, ...cached];
    } catch {
      return [];
    }
  });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(null);
  const [pm, setPm] = useState(false);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef();
  const [f, setF] = useState({ name: 'Untitled Project', ratio: '9:16', fps: 30 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // 1-Day (24-Hour) Auto Cleanup for temporary / old draft media
  const cleanExpiredProjects = useCallback(() => {
    try {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      const kept = [];
      for (const p of local) {
        const time = new Date(p.updatedAt || p.createdAt || now).getTime();
        // If older than 1 day and marked as temporary, auto-clean it
        if ((p.isTemp || p.name?.startsWith('Draft')) && now - time > ONE_DAY) {
          localStorage.removeItem(`rvs_media_${p.id}`);
          localStorage.removeItem(`rvs_backup_${p.id}`);
        } else {
          kept.push(p);
        }
      }
      localStorage.setItem('rvs_local_projects', JSON.stringify(kept));
    } catch (e) {
      console.warn('Auto cleanup error:', e);
    }
  }, []);

  // Blazing fast non-blocking project loader
  const load = useCallback(() => {
    cleanExpiredProjects();
    try {
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
      setList([...local, ...cached]);
    } catch {}

    api(`/projects?q=${encodeURIComponent(q)}`, { timeout: 3500 })
      .then((d) => {
        const freshLocal = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
        const combined = [...freshLocal, ...d];
        setList(combined);
        try { localStorage.setItem('rvs_cached_projects', JSON.stringify(d)); } catch {}
        setErr('');
      })
      .catch((e) => {
        console.warn('Projects API offline/sleeping, continuing with local projects:', e);
      });
  }, [cleanExpiredProjects, q]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    let res = list.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
    return sort === 'name' ? [...res].sort((a, b) => a.name.localeCompare(b.name)) : res;
  }, [list, q, sort]);

  // Robust, instant delete without blocking alert or zombie cache
  const deleteProject = useCallback((id, e) => {
    e?.stopPropagation?.();
    setMenu(null);

    // 1. Immediately remove from React state (Instant 0ms feedback)
    setList((prev) => prev.filter((x) => x.id !== id));

    // 2. Remove from both local and cached storage
    try {
      const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
      localStorage.setItem('rvs_local_projects', JSON.stringify(local.filter((x) => x.id !== id)));

      const cached = JSON.parse(localStorage.getItem('rvs_cached_projects') || '[]');
      localStorage.setItem('rvs_cached_projects', JSON.stringify(cached.filter((x) => x.id !== id)));

      localStorage.removeItem(`rvs_media_${id}`);
      localStorage.removeItem(`rvs_backup_${id}`);
    } catch (err) {
      console.warn('Storage delete error:', err);
    }

    // 3. Delete from cloud backend if not a purely local project
    if (!String(id).startsWith('local-')) {
      api(`/projects/${id}`, { method: 'DELETE' }).catch((err) => console.warn('Cloud delete error:', err));
    }
  }, []);

  const act = (fn) => async () => {
    setMenu(null);
    try {
      setErr('');
      await fn();
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

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

  // Instant 1-tap jump to Video Editor with specific tool active
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
        name: `Video ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`,
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

  // Instant local-first Blank Project creation (<10ms)
  async function create(e) {
    e.preventDefault();
    const [width, height] = RES[f.ratio];
    const p = {
      id: `local-${Date.now()}`,
      name: f.name || 'New Video Project',
      width,
      height,
      fps: Number(f.fps) || 30,
      duration: 5,
      updatedAt: new Date().toISOString(),
      isLocal: true,
    };
    const local = JSON.parse(localStorage.getItem('rvs_local_projects') || '[]');
    local.unshift(p);
    localStorage.setItem('rvs_local_projects', JSON.stringify(local));
    setModal(false);
    nav(`/editor/${p.id}`);
  }

  // Instant 1-Tap Pick Media from Phone Gallery -> Editor opens in <50ms with clips on timeline
  async function startFromMedia(files) {
    files = files.filter((f) => /^(image|video)\//.test(f.type) || /\.(mp4|mov|webm|png|jpg|jpeg|webp)$/i.test(f.name));
    if (!files.length) return;
    setErr('');
    setBusy({ msg: 'Loading videos & photos…', pct: 40 });

    try {
      const first = await fileThumb(files[0]).catch(() => null);
      const r = first ? first.w / first.h : 0.5625;
      const ratio = r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1';
      const [width, height] = RES[ratio];

      const p = {
        id: `local-${Date.now()}`,
        name: `Video ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`,
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

      const ids = [];
      const localMediaList = [];

      for (let i = 0; i < files.length; i++) {
        const curFile = files[i];
        const d = await getDuration(curFile).catch(() => 5);
        const m = {
          id: `loc-m-${Date.now()}-${i}`,
          projectId: p.id,
          name: curFile.name,
          type: curFile.type.startsWith('video/') ? 'video' : 'image',
          url: URL.createObjectURL(curFile),
          duration: d || (curFile.type.startsWith('image/') ? 5 : 5),
          size: curFile.size,
        };
        ids.push(m.id);
        localMediaList.push(m);
      }

      localStorage.setItem(`rvs_media_${p.id}`, JSON.stringify(localMediaList));
      if (first?.thumb) {
        p.thumbnailUrl = first.thumb;
        localStorage.setItem('rvs_local_projects', JSON.stringify(local));
      }

      // INSTANT navigate into editor with clips
      nav(`/editor/${p.id}?add=${ids.join(',')}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  const first = (user?.name || 'Creator').split(' ')[0];

  return (
    <div className="page home" onClick={() => { setMenu(null); setPm(false); }}>
      {/* Top Header */}
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
              <div className="who"><b>{user?.name || 'Rajesh'}</b><small className="muted">{user?.plan || 'PRO'} Plan</small></div>
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

        {/* 1. PRIMARY HERO: New Project Card (CapCut/VN Mobile Style) */}
        <div className="hero-creator-banner">
          <div className="hero-creator-left">
            <span className="hero-pill-badge">⚡ Ultra Fast Mobile Editor · 24h Auto-Clean Active</span>
            <h1 className="hero-creator-heading">🎬 Create New Video</h1>
            <p className="hero-creator-sub">Pick photos or videos from your gallery to start editing instantly (offline & fast)</p>
            <div className="hero-action-buttons">
              <button
                className="btn primary hero-main-cta"
                onClick={() => fileRef.current?.click()}
              >
                <Icon name="plus" size={20} />
                <span>+ Pick Photos & Videos</span>
              </button>
              <button
                className="btn hero-blank-btn"
                onClick={() => setModal(true)}
              >
                <Icon name="film" size={18} />
                <span>📐 Blank Canvas</span>
              </button>
            </div>
          </div>
          <div className="hero-creator-art">
            <div className="art-circle-glow">
              <span className="art-icon-large">✂️</span>
            </div>
          </div>
        </div>

        {/* 2. HOW TO USE THE APP: Simple 3-Step Visual Guide */}
        <div className="app-guide-box">
          <div className="guide-header">
            <span className="guide-icon-pill">💡</span>
            <div>
              <b style={{ fontSize: '15px', color: '#fff', display: 'block' }}>How to Use (3 Easy Steps)</b>
              <small style={{ color: 'var(--mut)', fontSize: '12px' }}>Create professional videos in 3 simple steps</small>
            </div>
          </div>
          <div className="guide-steps-grid">
            <div className="guide-step-card">
              <div className="step-num">1</div>
              <div className="step-content">
                <b>1. Select Media</b>
                <p>Tap '+ Pick Photos & Videos' above. Your clips will load on the timeline in 1 second.</p>
              </div>
            </div>
            <div className="guide-step-card">
              <div className="step-num">2</div>
              <div className="step-content">
                <b>2. Edit Inside Timeline</b>
                <p>Use in-editor tools below: <b>Hindi Titles, Pro Stickers, DAW Beats, Voiceover, Filters & VFX</b>.</p>
              </div>
            </div>
            <div className="guide-step-card">
              <div className="step-num">3</div>
              <div className="step-content">
                <b>3. Export 1080p HD Video</b>
                <p>Tap <b>'Export'</b> at the top to save full HD 1080p video directly to your phone gallery with no watermark.</p>
              </div>
            </div>
          </div>
          <div className="guide-tip-pill">
            <span>✨ <b>Pro Tip:</b> Tap any clip to Split/Trim, and use the bottom tools bar to add music, Hindi titles, or effects!</span>
          </div>
        </div>

        {/* 3. IN-EDITOR CREATIVE TOOLS (Direct Shortcuts) */}
        <div className="quick-studios-sec">
          <div className="row sechead" style={{ marginBottom: '10px' }}>
            <h3 className="grow" style={{ fontSize: '15px', fontWeight: 800 }}>⚡ Creative Studios (Inside Video Editor)</h3>
            <small className="muted">All 12 creative tools available inside</small>
          </div>
          <div className="quick-studios-carousel">
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('text')}>
              <i>🇮🇳</i> <span>Hindi Titles & Text</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('stickers')}>
              <i>⭐</i> <span>Pro Stickers</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('effects')}>
              <i>✨</i> <span>Cinema VFX</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('beatmaker')}>
              <i>🎵</i> <span>Beat DAW</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('voiceover')}>
              <i>🎙️</i> <span>Voiceover Mic</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('captions')}>
              <i>🎤</i> <span>Auto Captions</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('templates')}>
              <i>⚡</i> <span>Reels Templates</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('ailab')}>
              <i>🤖</i> <span>AI Creative Lab</span>
            </button>
            <button className="quick-studio-pill" onClick={() => openStudioInEditor('media')}>
              <i>📸</i> <span>Photo Studio</span>
            </button>
          </div>
        </div>

        {/* 4. RECENT PROJECTS SECTION */}
        <div className="row sechead" style={{ marginTop: '22px' }}>
          <h2 className="grow" style={{ fontSize: '18px', fontWeight: 800 }}>📁 Recent Projects</h2>
          <div className="seg">
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button>
            <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
          </div>
        </div>

        {/* Search bar for projects */}
        <label className="search" style={{ margin: '10px 0 16px' }}>
          <Icon name="search" size={18} />
          <input
            placeholder="Search your video projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        {err && <div className="errbox"><span>{err}</span><button className="btn sm" onClick={load}>Retry</button></div>}

        {/* Projects List */}
        {!shown.length && !err && (
          <div className="empty-projects-card">
            <div className="empty-icon-wrap">
              <Icon name="film" size={32} />
            </div>
            <b>No projects yet</b>
            <p>Tap '+ Pick Photos & Videos' above to start your first video project!</p>
            <button className="btn primary" onClick={() => fileRef.current?.click()} style={{ marginTop: '10px' }}>
              <Icon name="plus" size={16} /> + New Project
            </button>
          </div>
        )}

        <div className="plist">
          {shown.map((p) => (
            <div key={p.id} className="prow" onClick={() => nav(`/editor/${p.id}`)}>
              <div className="pthumb">
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt="" />
                ) : (
                  <Icon name="film" size={24} />
                )}
              </div>
              <div className="pinfo">
                <b>
                  {p.name}{' '}
                  {p.isLocal && (
                    <span style={{ fontSize: '10px', background: '#3b82f633', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                      OFFLINE
                    </span>
                  )}
                </b>
                <small>
                  {new Date(p.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {p.width}×{p.height} · {Math.round(p.duration || 5)}s
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn sm primary resume-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/editor/${p.id}`);
                  }}
                  style={{ borderRadius: '10px', padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
                >
                  Edit ▶
                </button>
                <button
                  className="ib"
                  title="Delete project"
                  onClick={(e) => deleteProject(p.id, e)}
                  style={{ color: '#ef4444', width: '34px', height: '34px' }}
                >
                  <Icon name="trash" size={16} />
                </button>
                <button
                  className="ib"
                  title="More options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === p.id ? null : p.id);
                  }}
                >
                  <Icon name="dots" />
                </button>
              </div>
              {menu === p.id && (
                <div className="pmenu" onClick={(e) => e.stopPropagation()}>
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
                  <button className="danger" onClick={(e) => deleteProject(p.id, e)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Global Modals */}
      <GlobalCreativeSearch open={searchOpen} onClose={() => setSearchOpen(false)} projects={list} />
      <AiAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Hidden File Input for Picking Gallery Media */}
      <input
        ref={fileRef}
        hidden
        type="file"
        multiple
        accept="video/*,image/*"
        onChange={(e) => {
          startFromMedia([...e.target.files]);
          e.target.value = '';
        }}
      />

      {/* Busy Spinner */}
      {busy && (
        <div className="overlay">
          <div className="card busybox">
            <div className="spin" />
            <b>{busy.msg}</b>
            <div className="bar"><i style={{ width: `${busy.pct}%` }} /></div>
            <small className="muted">Direct phone processing… instant setup</small>
          </div>
        </div>
      )}

      {/* Blank Project Modal */}
      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <form className="card auth" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h2>New Blank Project</h2>
            <input
              placeholder="Project Name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              required
            />
            <label className="prop">
              <span>Aspect Ratio</span>
              <select value={f.ratio} onChange={(e) => setF({ ...f, ratio: e.target.value })}>
                {[['9:16', '9:16 Reels / Shorts / TikTok'], ['16:9', '16:9 YouTube Video'], ['1:1', '1:1 Square Post'], ['4:5', '4:5 Portrait Feed']].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="prop">
              <span>Frame Rate</span>
              <select value={f.fps} onChange={(e) => setF({ ...f, fps: e.target.value })}>
                {[24, 30, 60].map((r) => <option key={r}>{r} FPS</option>)}
              </select>
            </label>
            <button className="btn primary" style={{ fontWeight: 800 }}>Create & Open Editor →</button>
          </form>
        </div>
      )}
    </div>
  );
}

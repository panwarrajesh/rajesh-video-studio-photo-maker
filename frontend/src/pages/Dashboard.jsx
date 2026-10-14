import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, upload } from '../services/api.js';
import { getDuration, fileThumb } from '../utils/media.js';
import { useAuth } from '../store/auth.js';
import { Icon, Logo } from '../components/Icon.jsx';
import InstallBanner from '../components/InstallBanner.jsx';

const RES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const TOOLS = [['cinematic', 'sparkles', 'Auto Cinematic', '#a78bfa'], ['audio', 'music', 'Beat Sync', '#34d399'], ['audio', 'mic', 'Voice-over', '#f472b6'], ['text', 'type', 'Hindi Text', '#fbbf24'],
  ['bg', 'image', 'Backgrounds', '#60a5fa'], ['bg', 'layers', 'Green Screen', '#4ade80'], ['bg', 'sparkles', 'Particles', '#fb7185'], ['look', 'sliders', 'Filters & Look', '#22d3ee']];

export default function Dashboard() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const [list, setList] = useState([]); const [q, setQ] = useState(''); const [sort, setSort] = useState('recent');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false); const [menu, setMenu] = useState(null); const [pm, setPm] = useState(false);
  const [busy, setBusy] = useState(null); const fileRef = useRef();
  const [f, setF] = useState({ name: 'Untitled project', ratio: '9:16', fps: 30 });

  const load = useCallback(() => api(`/projects?q=${encodeURIComponent(q)}`).then((d) => { setList(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false)), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const shown = useMemo(() => (sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list), [list, sort]);
  const act = (fn) => async () => { setMenu(null); try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  async function create(e) {
    e.preventDefault();
    try { const [width, height] = RES[f.ratio]; const p = await api('/projects', { method: 'POST', body: { name: f.name, width, height, fps: Number(f.fps) } }); nav(`/editor/${p.id}`); }
    catch (x) { setErr(x.message); setModal(false); }
  }
  // "New video": pick photos/videos from the gallery -> project is created -> media uploaded -> editor opens with the clips on the timeline
  async function startFromMedia(files) {
    files = files.filter((f) => /^(image|video)\//.test(f.type)); if (!files.length) return;
    setErr(''); setBusy({ msg: 'Preparing…', pct: 5 });
    try {
      const first = await fileThumb(files[0]), r = first ? first.w / first.h : 0.5625;
      const ratio = r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1', [width, height] = RES[ratio];
      const p = await api('/projects', { method: 'POST', body: { name: `Project ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}`, width, height, fps: 30 } });
      const ids = [], failed = [];
      for (let i = 0; i < files.length; i++) {
        setBusy({ msg: `Uploading ${i + 1} of ${files.length}…`, pct: 10 + Math.round((i / files.length) * 85) });
        try { const fd = new FormData(); fd.append('projectId', p.id); const d = await getDuration(files[i]); if (d) fd.append('duration', d); fd.append('file', files[i]); ids.push((await upload('/media/upload', fd)).id); }
        catch (e) { failed.push(`${files[i].name}: ${e.message}`); }
      }
      if (first) await api(`/projects/${p.id}`, { method: 'PUT', body: { thumbnailUrl: first.thumb } }).catch(() => {});
      if (!ids.length) { setErr(failed[0] || 'Upload failed'); load(); return; }
      nav(`/editor/${p.id}?add=${ids.join(',')}`);
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  const first = (user?.name || 'there').split(' ')[0];
  return (
    <div className="page home" onClick={() => { setMenu(null); setPm(false); }}>
      <header className="top"><Logo /><span className="grow" />
        <div className="pwrap" onClick={(e) => e.stopPropagation()}>
          <button className="avatar" title="Account" onClick={() => setPm(!pm)}>{first.charAt(0).toUpperCase()}</button>
          {pm && <div className="pmenu right"><div className="who"><b>{user?.name}</b><small className="muted">{user?.plan} plan</small></div><button onClick={logout}><Icon name="logout" size={16} /> Log out</button></div>}
        </div>
      </header>
      <main className="wrap">
        <InstallBanner />
        <h1 className="greet">Hi {first} 👋<span>What will you create today?</span></h1>
        <div className="hero2">
          <button className="tile t1" onClick={() => fileRef.current?.click()}><i><Icon name="plus" size={26} /></i><b>New video</b><small>Pick photos & videos</small></button>
          <button className="tile t2" onClick={() => nav('/studio')}><i><Icon name="film" size={26} /></i><b>Photo Video Maker</b><small>Photos to cinematic video</small></button>
        </div>
        <button className="linkbtn" onClick={() => setModal(true)}>or start an empty project with a custom size</button>
        <div className="tools4">{TOOLS.map(([k, ic, label, col]) => <button key={label} className="tool" style={{ '--tc': col }} onClick={() => nav(`/studio?tool=${k}`)}><i><Icon name={ic} size={22} /></i><span>{label}</span></button>)}</div>
        <div className="row sechead"><h2 className="grow">Projects</h2>
          <div className="seg"><button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button><button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button></div></div>
        <label className="search"><Icon name="search" size={18} /><input placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {err && <div className="errbox"><span>{err}</span><button className="btn sm" onClick={load}>Retry</button></div>}
        {loading && !list.length && <div className="plist">{[0, 1, 2].map((i) => <div key={i} className="prow skel" />)}</div>}
        {!loading && !shown.length && !err && <div className="empty2"><i><Icon name="film" size={30} /></i><b>No projects yet</b><small className="muted">Tap “New video” to start your first project.</small></div>}
        <div className="plist">{shown.map((p) => (
          <div key={p.id} className="prow" onClick={() => nav(`/editor/${p.id}`)}>
            <div className="pthumb">{p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" /> : <Icon name="film" size={22} />}</div>
            <div className="pinfo"><b>{p.name}</b><small>{new Date(p.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {p.width}×{p.height} · {Math.round(p.duration)}s</small></div>
            <button className="ib" title="More" onClick={(e) => { e.stopPropagation(); setMenu(menu === p.id ? null : p.id); }}><Icon name="dots" /></button>
            {menu === p.id && <div className="pmenu" onClick={(e) => e.stopPropagation()}>
              <button onClick={act(async () => { const n = prompt('Rename project', p.name); if (n) await api(`/projects/${p.id}`, { method: 'PUT', body: { name: n } }); })}>Rename</button>
              <button onClick={act(() => api(`/projects/${p.id}/duplicate`, { method: 'POST' }))}>Duplicate</button>
              <button className="danger" onClick={act(async () => { if (confirm('Delete this project?')) await api(`/projects/${p.id}`, { method: 'DELETE' }); })}>Delete</button></div>}
          </div>))}</div>
      </main>
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

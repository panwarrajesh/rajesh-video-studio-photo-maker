import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../store/auth.js';
import { Icon, Logo } from '../components/Icon.jsx';

const RES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const TOOLS = [['cinematic', 'sparkles', 'Auto Cinematic', '#a78bfa'], ['audio', 'music', 'Beat Sync', '#34d399'], ['audio', 'mic', 'Voice-over', '#f472b6'], ['text', 'type', 'Hindi Text', '#fbbf24'],
  ['bg', 'image', 'Backgrounds', '#60a5fa'], ['bg', 'layers', 'Green Screen', '#4ade80'], ['bg', 'sparkles', 'Particles', '#fb7185'], ['look', 'sliders', 'Filters & Look', '#22d3ee']];

export default function Dashboard() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const [list, setList] = useState([]); const [q, setQ] = useState(''); const [sort, setSort] = useState('recent');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false); const [menu, setMenu] = useState(null); const [pm, setPm] = useState(false);
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
        <h1 className="greet">Hi {first} 👋<span>What will you create today?</span></h1>
        <div className="hero2">
          <button className="tile t1" onClick={() => setModal(true)}><i><Icon name="plus" size={26} /></i><b>New video</b><small>Timeline editor</small></button>
          <button className="tile t2" onClick={() => nav('/studio')}><i><Icon name="film" size={26} /></i><b>Photo Video Maker</b><small>Photos to cinematic video</small></button>
        </div>
        <div className="tools4">{TOOLS.map(([k, ic, label, col]) => <button key={label} className="tool" style={{ '--tc': col }} onClick={() => nav(`/studio?tool=${k}`)}><i><Icon name={ic} size={22} /></i><span>{label}</span></button>)}</div>
        <div className="row sechead"><h2 className="grow">Projects</h2>
          <div className="seg"><button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button><button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button></div></div>
        <label className="search"><Icon name="search" size={18} /><input placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {err && <div className="errbox"><span>{err}</span><button className="btn sm" onClick={load}>Retry</button></div>}
        {loading && !list.length && <div className="plist">{[0, 1, 2].map((i) => <div key={i} className="prow skel" />)}</div>}
        {!loading && !shown.length && !err && <div className="empty2"><i><Icon name="film" size={30} /></i><b>No projects yet</b><small className="muted">Tap “New video” to start your first project.</small></div>}
        <div className="plist">{shown.map((p) => (
          <div key={p.id} className="prow" onClick={() => nav(`/editor/${p.id}`)}>
            <div className="pthumb"><Icon name="film" size={22} /></div>
            <div className="pinfo"><b>{p.name}</b><small>{new Date(p.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {p.width}×{p.height} · {Math.round(p.duration)}s</small></div>
            <button className="ib" title="More" onClick={(e) => { e.stopPropagation(); setMenu(menu === p.id ? null : p.id); }}><Icon name="dots" /></button>
            {menu === p.id && <div className="pmenu" onClick={(e) => e.stopPropagation()}>
              <button onClick={act(async () => { const n = prompt('Rename project', p.name); if (n) await api(`/projects/${p.id}`, { method: 'PUT', body: { name: n } }); })}>Rename</button>
              <button onClick={act(() => api(`/projects/${p.id}/duplicate`, { method: 'POST' }))}>Duplicate</button>
              <button className="danger" onClick={act(async () => { if (confirm('Delete this project?')) await api(`/projects/${p.id}`, { method: 'DELETE' }); })}>Delete</button></div>}
          </div>))}</div>
      </main>
      {modal && <div className="overlay" onClick={() => setModal(false)}><form className="card auth" onClick={(e) => e.stopPropagation()} onSubmit={create}>
        <h2>New video</h2>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <label className="prop"><span>Size</span><select value={f.ratio} onChange={(e) => setF({ ...f, ratio: e.target.value })}>{[['9:16', '9:16 Reels / Shorts'], ['16:9', '16:9 YouTube'], ['1:1', '1:1 Post'], ['4:5', '4:5 Portrait']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="prop"><span>Frame rate</span><select value={f.fps} onChange={(e) => setF({ ...f, fps: e.target.value })}>{[24, 30, 60].map((r) => <option key={r}>{r}</option>)}</select></label>
        <button className="btn primary">Create & open</button></form></div>}
    </div>
  );
}

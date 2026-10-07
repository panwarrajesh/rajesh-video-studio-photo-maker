import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../store/auth.js';
import { Icon, Logo } from '../components/Icon.jsx';

const RES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

export default function Dashboard() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const [list, setList] = useState([]); const [q, setQ] = useState(''); const [err, setErr] = useState('');
  const [modal, setModal] = useState(false); const [f, setF] = useState({ name: 'Untitled project', ratio: '16:9', fps: 30 });

  const load = useCallback(() => api(`/projects?q=${encodeURIComponent(q)}`).then(setList).catch((e) => setErr(e.message)), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const act = (fn) => async () => { try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  async function create(e) {
    e.preventDefault();
    try { const [width, height] = RES[f.ratio]; const p = await api('/projects', { method: 'POST', body: { name: f.name, width, height, fps: Number(f.fps) } }); nav(`/editor/${p.id}`); }
    catch (x) { setErr(x.message); setModal(false); }
  }
  return (
    <div className="page">
      <header className="top"><Logo /><span className="grow" />
        <span className="muted">{user.name} · {user.plan}</span><button className="btn" onClick={logout}>Log out</button></header>
      <main className="wrap">
        <div className="row"><h2 className="grow">My Projects</h2>
          <input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={() => nav('/studio')}><Icon name="sparkles" size={16} /> Photo Video Maker</button>
          <button className="btn primary" onClick={() => setModal(true)}>+ New project</button></div>
        {err && <p className="err">{err}</p>}
        {!list.length && <div className="card empty">No projects yet. Create your first one.</div>}
        <div className="grid">{list.map((p) => (
          <div key={p.id} className="card proj">
            <div className="thumb" onClick={() => nav(`/editor/${p.id}`)}><Icon name="film" size={30} /><em>{p.width}×{p.height}</em></div>
            <b>{p.name}</b>
            <small className="muted">{p.width}×{p.height} · {p.fps}fps · {p.duration.toFixed(1)}s<br />Edited {new Date(p.updatedAt).toLocaleString()}</small>
            <div className="row">
              <button className="btn sm" onClick={() => nav(`/editor/${p.id}`)}>Open</button>
              <button className="btn sm" onClick={act(async () => { const n = prompt('Rename project', p.name); if (n) await api(`/projects/${p.id}`, { method: 'PUT', body: { name: n } }); })}>Rename</button>
              <button className="btn sm" onClick={act(() => api(`/projects/${p.id}/duplicate`, { method: 'POST' }))}>Duplicate</button>
              <button className="btn sm danger" onClick={act(async () => { if (confirm('Delete this project?')) await api(`/projects/${p.id}`, { method: 'DELETE' }); })}>Delete</button>
            </div></div>))}</div>
      </main>
      {modal && <div className="overlay" onClick={() => setModal(false)}><form className="card auth" onClick={(e) => e.stopPropagation()} onSubmit={create}>
        <h2>New project</h2>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <select value={f.ratio} onChange={(e) => setF({ ...f, ratio: e.target.value })}>{Object.keys(RES).map((r) => <option key={r}>{r}</option>)}</select>
        <select value={f.fps} onChange={(e) => setF({ ...f, fps: e.target.value })}>{[24, 30, 60].map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn primary">Create & open</button></form></div>}
    </div>
  );
}

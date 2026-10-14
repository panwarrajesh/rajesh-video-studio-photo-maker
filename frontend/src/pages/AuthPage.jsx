import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { Logo } from '../components/Icon.jsx';
import { getServer, setServer, isNative } from '../services/api.js';

export default function AuthPage({ mode }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = useAuth((s) => s.submit); const nav = useNavigate();
  const reg = mode === 'register';
  const native = isNative(), baked = !!import.meta.env.VITE_API_URL; // baked = server address already built into the app
  const [server, setSrv] = useState(getServer());
  const on = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { if (native && !baked) setServer(server); await submit(mode, reg ? form : { email: form.email, password: form.password }); nav('/'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="authwrap">
      <div className="authhero"><Logo big /><h1>Cut, style and export videos without leaving your browser.</h1><p>A multi-track timeline, text, stickers, filters and effects. Works on your laptop and on your phone.</p></div>
      <form className="authform" onSubmit={go}>
        <Logo />
        <h2>{reg ? 'Create account' : 'Welcome back'}</h2>
        {reg && <input placeholder="Name" value={form.name} onChange={on('name')} required />}
        {native && !baked && <><input placeholder="Server, e.g. http://192.168.1.5:4000" value={server} onChange={(e) => setSrv(e.target.value)} autoCapitalize="none" /><small className="muted">Your RVS server address (the computer running the backend, same Wi-Fi).</small></>}
        <input type="email" placeholder="Email" value={form.email} onChange={on('email')} required />
        <input type="password" placeholder="Password (min 8)" value={form.password} onChange={on('password')} required />
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Sign up' : 'Log in'}</button>
        <p className="muted">{reg ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Sign up</Link></>}</p>
      </form>
    </div>
  );
}

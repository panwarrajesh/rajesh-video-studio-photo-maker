import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useEditor } from '../store/editor.js';

const KEY = (id) => `rvs_backup_${id}`;
const snapshot = () => { const s = useEditor.getState(); return { clips: s.clips, tracks: s.tracks, markers: s.markers }; };
const same = (a, b) => !!a && !!b && a.clips === b.clips && a.tracks === b.tracks && a.markers === b.markers;

// Debounced autosave of clips + track states + markers. A local backup is written first (crash/offline recovery) and removed once the server confirms.
export function useAutosave(projectId, ready) {
  const [status, setStatus] = useState('saved');
  const saved = useRef(null), timer = useRef(), busy = useRef(false), cur = useRef('saved');
  const mark = (s) => { cur.current = s; setStatus(s); };

  const save = useCallback(async () => {
    const snap = snapshot();
    if (!ready || busy.current || same(snap, saved.current)) return;
    busy.current = true; mark('saving');
    try { localStorage.setItem(KEY(projectId), JSON.stringify({ at: new Date().toISOString(), ...snap })); } catch { /* storage blocked/full */ }
    try {
      await api(`/projects/${projectId}/timeline`, { method: 'PUT', body: snap });
      saved.current = snap;
      if (!same(snapshot(), snap)) { mark('dirty'); timer.current = setTimeout(save, 800); }
      else { mark('saved'); localStorage.removeItem(KEY(projectId)); }
    } catch {
      mark('error'); timer.current = setTimeout(save, 5000);
    } finally { busy.current = false; }
  }, [projectId, ready]);

  useEffect(() => {
    if (!ready) return;
    saved.current = snapshot(); mark('saved');
    const unsub = useEditor.subscribe((s, p) => {
      if (s.clips === p.clips && s.tracks === p.tracks && s.markers === p.markers) return;
      mark('dirty'); clearTimeout(timer.current); timer.current = setTimeout(save, 1500);
    });
    const hide = () => document.visibilityState === 'hidden' && save();
    const warn = (e) => { if (cur.current !== 'saved') { save(); e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('visibilitychange', hide); window.addEventListener('beforeunload', warn);
    return () => { unsub(); clearTimeout(timer.current); document.removeEventListener('visibilitychange', hide); window.removeEventListener('beforeunload', warn); save(); };
  }, [ready, save]);

  const saveNow = useCallback(() => { clearTimeout(timer.current); return save(); }, [save]);
  return { status, saveNow };
}

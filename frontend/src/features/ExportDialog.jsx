import { useEffect, useRef, useState } from 'react';
import { api, fileUrl, isNative } from '../services/api.js';
import { useEditor } from '../store/editor.js';

const ratioOf = (w, h) => { const r = w / h; return r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1'; };

export default function ExportDialog({ project, onClose }) {
  const [s, setS] = useState({ resolution: '720', ratio: ratioOf(project.width, project.height), fps: [24, 30, 60].includes(project.fps) ? project.fps : 30, format: 'mp4' });
  const [job, setJob] = useState(null); const [err, setErr] = useState(''); const timer = useRef();
  useEffect(() => () => clearInterval(timer.current), []);
  const on = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const busy = job && !['DONE', 'FAILED'].includes(job.status);

  async function start() {
    setErr(''); setJob(null);
    const { clips: all, tracks } = useEditor.getState(); // hidden tracks are not exported; muted tracks are silent
    const clips = all.filter((c) => !tracks[c.track]?.hidden && !(c.track === 'AUDIO' && tracks.AUDIO.muted)).map((c) => (c.track === 'VIDEO' && tracks.VIDEO.muted ? { ...c, props: { ...c.props, muted: true } } : c));
    if (!clips.length) return setErr('Add some clips to the timeline first.');
    try {
      const { id } = await api(`/projects/${project.id}/export`, { method: 'POST', body: { settings: { ...s, fps: Number(s.fps) }, clips } });
      setJob({ id, status: 'QUEUED', progress: 0, warnings: [] });
      timer.current = setInterval(async () => {
        try { const j = await api(`/exports/${id}`); setJob(j); if (['DONE', 'FAILED'].includes(j.status)) clearInterval(timer.current); }
        catch (e) { setErr(e.message); clearInterval(timer.current); }
      }, 1000);
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="overlay"><div className="card auth">
      <h2>Export video</h2>
      <label className="prop"><span>Resolution</span><select disabled={busy} value={s.resolution} onChange={on('resolution')}>{[['480', '480p'], ['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="prop"><span>Aspect ratio</span><select disabled={busy} value={s.ratio} onChange={on('ratio')}>{['16:9', '9:16', '1:1', '4:5'].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="prop"><span>Frame rate</span><select disabled={busy} value={s.fps} onChange={on('fps')}>{[24, 30, 60].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="prop"><span>Format</span><select disabled={busy} value={s.format} onChange={on('format')}><option value="mp4">MP4</option><option value="webm">WebM</option></select></label>
      {err && <p className="err">{err}</p>}
      {job && <>
        <div className="bar"><i style={{ width: `${job.progress}%` }} /></div>
        <small className="muted">{job.status === 'QUEUED' ? 'Queued…' : job.status === 'PROCESSING' ? `Rendering… ${job.progress}%` : job.status === 'DONE' ? 'Done!' : 'Failed'}</small>
        {job.status === 'FAILED' && <p className="err">{job.error}</p>}
        {job.warnings?.map((w) => <small key={w} className="muted">⚠ {w}</small>)}
        {job.status === 'DONE' && <a className="btn primary" href={fileUrl(job.outputUrl)} download target="_blank" rel="noreferrer" onClick={(e) => { if (isNative()) { e.preventDefault(); window.open(fileUrl(job.outputUrl), '_system'); } }}>Download</a>}
      </>}
      <div className="row"><button className="btn primary" disabled={busy} onClick={start}>{busy ? 'Exporting…' : 'Start export'}</button><button className="btn" onClick={onClose}>Close</button></div>
    </div></div>
  );
}

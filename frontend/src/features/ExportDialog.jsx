import { useEffect, useRef, useState } from 'react';
import { api, fileUrl, isNative } from '../services/api.js';
import { useEditor, totalDuration, evalProps } from '../store/editor.js';

const ratioOf = (w, h) => { const r = w / h; return r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1'; };

export default function ExportDialog({ project, onClose }) {
  const [s, setS] = useState({ resolution: '720', ratio: ratioOf(project.width, project.height), fps: [24, 30, 60].includes(project.fps) ? project.fps : 30, format: 'mp4' });
  const [job, setJob] = useState(null);
  const [err, setErr] = useState('');
  const timer = useRef();

  // Fast device export states
  const [isExportingFast, setIsExportingFast] = useState(false);
  const [fastProgress, setFastProgress] = useState(0);
  const [fastOutputUrl, setFastOutputUrl] = useState(null);

  useEffect(() => () => clearInterval(timer.current), []);
  const on = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const busy = (job && !['DONE', 'FAILED'].includes(job.status)) || isExportingFast;

  // 1. FAST DIRECT DEVICE EXPORT (100% Offline, Instant, Works with Phone Photos & Videos)
  async function startFastExport() {
    setErr('');
    setFastOutputUrl(null);
    setIsExportingFast(true);
    setFastProgress(0);

    const { clips: all, tracks, media } = useEditor.getState();
    const activeClips = all.filter((c) => !tracks[c.track]?.hidden && !(c.track === 'AUDIO' && tracks.AUDIO.muted));
    if (!activeClips.length) {
      setErr('Timeline me koi clips nahi hain. Pehle photos ya videos add karein.');
      setIsExportingFast(false);
      return;
    }

    const duration = totalDuration(activeClips);
    if (duration <= 0) {
      setErr('Video duration 0s hai.');
      setIsExportingFast(false);
      return;
    }

    let targetW = 720, targetH = 1280;
    if (s.ratio === '16:9') { targetW = 1280; targetH = 720; }
    else if (s.ratio === '1:1') { targetW = 720; targetH = 720; }
    else if (s.ratio === '4:5') { targetW = 720; targetH = 900; }
    if (s.resolution === '1080') {
      targetW = Math.round(targetW * 1.5);
      targetH = Math.round(targetH * 1.5);
    } else if (s.resolution === '480') {
      targetW = Math.round(targetW * 0.67);
      targetH = Math.round(targetH * 0.67);
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Preload media elements
      const loadedImages = new Map();
      const loadedVideos = new Map();

      for (const c of activeClips) {
        if (c.track === 'IMAGE') {
          const m = media.find((x) => x.id === c.mediaId);
          if (m && !loadedImages.has(m.id)) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = fileUrl(m.url);
            await new Promise((res) => { img.onload = res; img.onerror = res; });
            loadedImages.set(m.id, img);
          }
        } else if (c.track === 'VIDEO') {
          const m = media.find((x) => x.id === c.mediaId);
          if (m && !loadedVideos.has(m.id)) {
            const vid = document.createElement('video');
            vid.crossOrigin = 'anonymous';
            vid.src = fileUrl(m.url);
            vid.muted = true;
            vid.playsInline = true;
            await new Promise((res) => { vid.onloadeddata = res; vid.onerror = res; });
            loadedVideos.set(m.id, vid);
          }
        }
      }

      const fps = Number(s.fps) || 30;
      const stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      }

      const chunks = [];
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      const renderDone = new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setFastOutputUrl(url);
          setIsExportingFast(false);
          setFastProgress(100);

          // Automatic download trigger
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(project.name || 'rajesh_video').replace(/[^a-zA-Z0-9_-]/g, '_')}_video.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve();
        };
      });

      recorder.start();

      const totalFrames = Math.max(1, Math.round(duration * fps));
      for (let frame = 0; frame < totalFrames; frame++) {
        const curTime = frame / fps;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);

        // 1. Draw Image or Video
        const vidClip = activeClips.find((c) => c.track === 'VIDEO' && curTime >= c.start && curTime < c.start + c.duration);
        const imgClip = activeClips.find((c) => c.track === 'IMAGE' && curTime >= c.start && curTime < c.start + c.duration);

        if (vidClip) {
          const vEl = loadedVideos.get(vidClip.mediaId);
          if (vEl) {
            const seekTo = vidClip.trimIn + (curTime - vidClip.start) * vidClip.speed;
            vEl.currentTime = seekTo;
            ctx.drawImage(vEl, 0, 0, targetW, targetH);
          }
        } else if (imgClip) {
          const iEl = loadedImages.get(imgClip.mediaId);
          if (iEl) {
            const scale = Math.max(targetW / iEl.naturalWidth, targetH / iEl.naturalHeight);
            const nw = iEl.naturalWidth * scale;
            const nh = iEl.naturalHeight * scale;
            const nx = (targetW - nw) / 2;
            const ny = (targetH - nh) / 2;
            ctx.drawImage(iEl, nx, ny, nw, nh);
          }
        }

        // 2. Draw Text Overlays & Badges
        const overlays = activeClips.filter((c) => (c.track === 'TEXT' || c.track === 'OVERLAY') && curTime >= c.start && curTime < c.start + c.duration);
        for (const ov of overlays) {
          const p = evalProps(ov, curTime);
          const posX = targetW * (0.5 + (p.x || 0) / 200);
          const posY = targetH * (0.5 + (p.y || 0) / 200);

          ctx.save();
          ctx.translate(posX, posY);
          if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
          if (p.scale) ctx.scale(p.scale, p.scale);

          if (ov.kind === 'text') {
            const fontSize = Math.round(targetW * ((p.fontSize || 7) / 100));
            ctx.font = `${p.bold ? 'bold ' : ''}${fontSize}px ${p.fontFamily || 'Poppins, sans-serif'}`;
            ctx.textAlign = p.align || 'center';
            ctx.textBaseline = 'middle';

            const text = p.text || '';
            if (p.bg) {
              const metrics = ctx.measureText(text);
              const padX = fontSize * 0.4;
              const padY = fontSize * 0.3;
              ctx.fillStyle = p.bg;
              ctx.fillRect(-metrics.width / 2 - padX, -fontSize / 2 - padY, metrics.width + padX * 2, fontSize + padY * 2);
            }
            if (p.shadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.85)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }
            ctx.fillStyle = p.color || '#ffffff';
            ctx.fillText(text, 0, 0);
            if (p.stroke > 0) {
              ctx.strokeStyle = p.strokeColor || '#000000';
              ctx.lineWidth = p.stroke;
              ctx.strokeText(text, 0, 0);
            }
          } else if (ov.kind === 'sticker') {
            const text = ov.props?.label || ov.label || ov.props?.shape || '⭐';
            ctx.fillStyle = ov.props?.color || '#ffb020';
            ctx.font = `bold ${Math.round(targetW * 0.055)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 0);
          }
          ctx.restore();
        }

        setFastProgress(Math.round(((frame + 1) / totalFrames) * 100));
        if (frame % 8 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      recorder.stop();
      await renderDone;
    } catch (e) {
      console.error('Fast export error:', e);
      setErr(`Fast export error: ${e.message}`);
      setIsExportingFast(false);
    }
  }

  // 2. CLOUD FFMPEG EXPORT (Optional when online)
  async function startCloudExport() {
    setErr(''); setJob(null);
    const { clips: all, tracks } = useEditor.getState();
    const clips = all.filter((c) => !tracks[c.track]?.hidden && !(c.track === 'AUDIO' && tracks.AUDIO.muted)).map((c) => (c.track === 'VIDEO' && tracks.VIDEO.muted ? { ...c, props: { ...c.props, muted: true } } : c));
    if (!clips.length) return setErr('Timeline me koi clips nahi hain.');
    try {
      let exportProjectId = project.id;
      if (String(project.id).startsWith('local-')) {
        try {
          const syncProj = await api('/projects', { method: 'POST', body: { name: project.name, width: project.width, height: project.height, fps: Number(s.fps) } });
          exportProjectId = syncProj.id;
        } catch {
          throw new Error('Cloud render ke liye server awake hona zaroori hai. Fast Device Download use karein!');
        }
      }
      const { id } = await api(`/projects/${exportProjectId}/export`, { method: 'POST', body: { settings: { ...s, fps: Number(s.fps) }, clips } });
      setJob({ id, status: 'QUEUED', progress: 0, warnings: [] });
      timer.current = setInterval(async () => {
        try { const j = await api(`/exports/${id}`); setJob(j); if (['DONE', 'FAILED'].includes(j.status)) clearInterval(timer.current); }
        catch (e) { setErr(e.message); clearInterval(timer.current); }
      }, 1000);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="overlay"><div className="card auth" style={{ maxWidth: '440px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>Export & Download Video</h2>
        <span style={{ fontSize: '11px', background: '#10b98122', color: '#34d399', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
          ⚡ Fast Mode
        </span>
      </div>

      <label className="prop"><span>Resolution</span><select disabled={busy} value={s.resolution} onChange={on('resolution')}>{[['480', '480p (Fastest)'], ['720', '720p HD (Recommended)'], ['1080', '1080p Full HD']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="prop"><span>Aspect ratio</span><select disabled={busy} value={s.ratio} onChange={on('ratio')}>{['16:9', '9:16', '1:1', '4:5'].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="prop"><span>Frame rate</span><select disabled={busy} value={s.fps} onChange={on('fps')}>{[24, 30, 60].map((v) => <option key={v}>{v} FPS</option>)}</select></label>

      {err && <p className="err" style={{ fontSize: '12px', background: '#ef444422', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px' }}>{err}</p>}

      {/* Fast Export Progress */}
      {isExportingFast && (
        <div style={{ margin: '12px 0' }}>
          <div className="bar"><i style={{ width: `${fastProgress}%` }} /></div>
          <small className="muted" style={{ display: 'block', textAlign: 'center', marginTop: '4px' }}>
            ⚡ Rendering video directly on device... {fastProgress}%
          </small>
        </div>
      )}

      {fastOutputUrl && (
        <div style={{ background: '#10b98122', border: '1px solid #10b981', padding: '12px', borderRadius: '10px', textAlign: 'center', margin: '10px 0' }}>
          <b style={{ color: '#34d399', display: 'block', marginBottom: '6px' }}>🎉 Video Export Complete!</b>
          <a
            className="btn primary"
            href={fastOutputUrl}
            download={`${(project.name || 'video').replace(/\s+/g, '_')}.mp4`}
            style={{ display: 'inline-block', width: '100%', textDecoration: 'none', background: '#10b981', borderColor: '#10b981', fontWeight: 800 }}
          >
            ⬇️ Tap to Download Video Now
          </a>
        </div>
      )}

      {/* Cloud FFmpeg Progress */}
      {job && (
        <div style={{ margin: '10px 0' }}>
          <div className="bar"><i style={{ width: `${job.progress}%` }} /></div>
          <small className="muted">{job.status === 'QUEUED' ? 'Queued on cloud…' : job.status === 'PROCESSING' ? `Cloud rendering… ${job.progress}%` : job.status === 'DONE' ? 'Done!' : 'Failed'}</small>
          {job.status === 'FAILED' && <p className="err">{job.error}</p>}
          {job.status === 'DONE' && (
            <a className="btn primary" href={fileUrl(job.outputUrl)} download target="_blank" rel="noreferrer" style={{ marginTop: '8px', display: 'block', textAlign: 'center' }} onClick={(e) => { if (isNative()) { e.preventDefault(); window.open(fileUrl(job.outputUrl), '_system'); } }}>
              ⬇️ Download Cloud Render
            </a>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        <button
          className="btn primary"
          disabled={busy}
          onClick={startFastExport}
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', padding: '10px', fontWeight: 800, fontSize: '13px' }}
        >
          {isExportingFast ? `⚡ Exporting… ${fastProgress}%` : '⚡ Fast Direct Download (Device Export)'}
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn"
            disabled={busy}
            onClick={startCloudExport}
            style={{ flex: 1, fontSize: '11px', background: 'var(--s2)', border: '1px solid var(--line)' }}
            title="Render via cloud server with FFmpeg"
          >
            ☁️ Cloud Render
          </button>
          <button className="btn" disabled={busy} onClick={onClose} style={{ flex: 1, fontSize: '11px' }}>
            Close
          </button>
        </div>
      </div>
    </div></div>
  );
}

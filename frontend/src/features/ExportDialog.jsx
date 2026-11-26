import { useEffect, useRef, useState } from 'react';
import { api, fileUrl, isNative } from '../services/api.js';
import { useEditor, totalDuration, evalProps } from '../store/editor.js';
import { Share } from '@capacitor/share';

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
  const [exportExt, setExportExt] = useState('mp4');

  useEffect(() => () => clearInterval(timer.current), []);
  const on = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const busy = (job && !['DONE', 'FAILED'].includes(job.status)) || isExportingFast;

  // 1. FAST DIRECT DEVICE EXPORT (Real-time synchronous, audio mixed, multiline text, 100% playable)
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

      // Preload media elements (images and videos)
      const loadedImages = new Map();
      const loadedVideos = new Map();

      for (const c of activeClips) {
        if (c.track === 'IMAGE' || c.track === 'VIDEO') {
          const m = media.find((x) => x.id === c.mediaId);
          if (!m) continue;
          const isImg = c.track === 'IMAGE' || m.type === 'image' || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(m.name || m.url);
          const u = fileUrl(m.url);
          if (isImg && !loadedImages.has(m.id)) {
            const img = new Image();
            if (/^https?:\/\//.test(u)) img.crossOrigin = 'anonymous';
            img.src = u;
            await new Promise((res) => { img.onload = res; img.onerror = res; });
            loadedImages.set(m.id, img);
          } else if (!isImg && !loadedVideos.has(m.id)) {
            const vid = document.createElement('video');
            if (/^https?:\/\//.test(u)) vid.crossOrigin = 'anonymous';
            vid.src = u;
            vid.muted = true;
            vid.playsInline = true;
            vid.preload = 'auto';
            await new Promise((res) => { vid.onloadeddata = res; vid.onerror = res; });
            loadedVideos.set(m.id, vid);
          }
        }
      }

      // Setup Web Audio mixing for export
      let audioCtx = null;
      let audioDest = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioDest = audioCtx.createMediaStreamDestination();
      } catch (err) {
        console.warn('AudioContext not available:', err);
      }

      // Pre-schedule audio buffers for active audio clips so they mix into audioDest
      const audioBuffers = [];
      const activeAudioClips = activeClips.filter((c) => c.track === 'AUDIO' || c.track === 'audio' || c.track === 'VIDEO');
      if (audioCtx && audioDest) {
        for (const ac of activeAudioClips) {
          const m = media.find((x) => x.id === ac.mediaId);
          if (m?.url) {
            try {
              const resp = await fetch(fileUrl(m.url));
              const arrayBuf = await resp.arrayBuffer();
              const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
              audioBuffers.push({ clip: ac, buffer: audioBuf });
            } catch (err) {
              console.warn('Audio decode skipped for track:', err);
            }
          }
        }
      }

      const fps = Number(s.fps) || 30;
      const stream = canvas.captureStream(fps);

      if (audioDest && audioDest.stream.getAudioTracks().length) {
        stream.addTrack(audioDest.stream.getAudioTracks()[0]);
      }

      let mimeType = 'video/webm';
      let fileExt = 'webm';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        fileExt = 'mp4';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        fileExt = 'mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
        fileExt = 'webm';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
        fileExt = 'webm';
      }
      setExportExt(fileExt);

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
          const cleanName = (project.name || 'rajesh_video').replace(/[^a-zA-Z0-9_-]/g, '_');
          a.download = `${cleanName}_video.${fileExt}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve();
        };
      });

      recorder.start(250);

      // Start all audio buffers
      if (audioCtx && audioDest) {
        const audioStartTime = audioCtx.currentTime;
        for (const ab of audioBuffers) {
          try {
            const src = audioCtx.createBufferSource();
            src.buffer = ab.buffer;
            src.connect(audioDest);
            const startOffset = Math.max(0, ab.clip.start);
            src.start(audioStartTime + startOffset, ab.clip.trimIn || 0, ab.clip.duration);
          } catch (e) {
            console.warn('Audio buffer play error:', e);
          }
        }
      }

      const totalFrames = Math.max(1, Math.round(duration * fps));
      const frameDelay = 1000 / fps;

      for (let frame = 0; frame < totalFrames; frame++) {
        const frameStart = performance.now();
        const curTime = frame / fps;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);

        // 1. Draw Image or Video
        const vidClip = activeClips.find((c) => c.track === 'VIDEO' && curTime >= c.start && curTime < c.start + c.duration);
        const imgClip = activeClips.find((c) => c.track === 'IMAGE' && curTime >= c.start && curTime < c.start + c.duration);
        const visualClip = vidClip || imgClip;

        if (visualClip) {
          const m = media.find((x) => x.id === visualClip.mediaId);
          const isImg = visualClip.track === 'IMAGE' || m?.type === 'image' || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(m?.name || m?.url);
          if (isImg) {
            const iEl = loadedImages.get(visualClip.mediaId);
            if (iEl && iEl.naturalWidth > 0) {
              const scale = Math.max(targetW / iEl.naturalWidth, targetH / iEl.naturalHeight);
              const nw = iEl.naturalWidth * scale;
              const nh = iEl.naturalHeight * scale;
              const nx = (targetW - nw) / 2;
              const ny = (targetH - nh) / 2;
              ctx.drawImage(iEl, nx, ny, nw, nh);
            }
          } else {
            const vEl = loadedVideos.get(visualClip.mediaId);
            if (vEl) {
              const seekTo = visualClip.trimIn + (curTime - visualClip.start) * visualClip.speed;
              if (Math.abs(vEl.currentTime - seekTo) > 0.04) {
                vEl.currentTime = seekTo;
                await new Promise((r) => {
                  const done = () => { vEl.removeEventListener('seeked', done); r(); };
                  vEl.addEventListener('seeked', done);
                  setTimeout(done, 40);
                });
              }
              ctx.drawImage(vEl, 0, 0, targetW, targetH);
            }
          }
        }

        // 2. Draw Text Overlays & Badges (FULL MULTI-LINE SUPPORT!)
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
            ctx.font = `${p.bold ? 'bold ' : ''}${p.italic ? 'italic ' : ''}${fontSize}px ${p.fontFamily || 'Poppins, sans-serif'}`;
            ctx.textAlign = p.align || 'center';
            ctx.textBaseline = 'middle';

            const rawText = String(p.text || '');
            const lines = rawText.split('\n');
            const lineH = fontSize * (p.lineHeight || 1.25);
            const startY = -((lines.length - 1) * lineH) / 2;

            if (p.bg) {
              let maxW = 0;
              lines.forEach((line) => {
                maxW = Math.max(maxW, ctx.measureText(line).width);
              });
              const padX = fontSize * 0.5;
              const padY = fontSize * 0.35;
              const boxH = lines.length * lineH + padY * 2;
              ctx.fillStyle = p.bg;
              ctx.fillRect(-maxW / 2 - padX, -boxH / 2, maxW + padX * 2, boxH);
            }

            if (p.shadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.85)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }

            lines.forEach((line, idx) => {
              const lineY = startY + idx * lineH;
              if (p.stroke > 0) {
                ctx.strokeStyle = p.strokeColor || '#000000';
                ctx.lineWidth = p.stroke;
                ctx.strokeText(line, 0, lineY);
              }
              ctx.fillStyle = p.color || '#ffffff';
              ctx.fillText(line, 0, lineY);
            });
          } else if (ov.kind === 'sticker') {
            const sData = ov.props?.stickerData;
            const text = sData?.content || ov.props?.label || ov.label || ov.props?.shape || '⭐';
            const fSize = Math.round(targetW * 0.055);
            ctx.font = `bold ${fSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (sData?.bg && sData.bg !== 'transparent') {
              const m = ctx.measureText(text);
              ctx.fillStyle = sData.bg.includes('gradient') ? '#dc2626' : sData.bg;
              ctx.fillRect(-m.width / 2 - 12, -fSize / 2 - 8, m.width + 24, fSize + 16);
            }
            ctx.fillStyle = sData?.color || ov.props?.color || '#ffb020';
            ctx.fillText(text, 0, 0);
          }
          ctx.restore();
        }

        setFastProgress(Math.round(((frame + 1) / totalFrames) * 100));

        // Real-time synchronization so MediaRecorder captures full time duration
        const elapsed = performance.now() - frameStart;
        const sleepTime = Math.max(1, frameDelay - elapsed);
        await new Promise((r) => setTimeout(r, sleepTime));
      }

      recorder.stop();
      await renderDone;
    } catch (e) {
      console.error('Fast export error:', e);
      setErr(`Fast export error: ${e.message}`);
      setIsExportingFast(false);
    }
  }

  // Native share / gallery save
  const handleShareVideo = async () => {
    if (!fastOutputUrl) return;
    try {
      if (isNative()) {
        await Share.share({
          title: project.name || 'Rajesh Video',
          text: 'Video created with Rajesh Video Studio',
          url: fastOutputUrl,
          dialogTitle: 'Save / Share Video to Gallery',
        });
      } else if (navigator.share) {
        const resp = await fetch(fastOutputUrl);
        const blob = await resp.blob();
        const file = new File([blob], `${(project.name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_')}.${exportExt}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: project.name });
          return;
        }
        await navigator.share({ title: project.name, url: window.location.href });
      } else {
        alert('File download ho chuki hai. Check your phone Downloads / Gallery!');
      }
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

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
          ⚡ 100% Full Video
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
            ⚡ Rendering full video with sound on device... {fastProgress}%
          </small>
        </div>
      )}

      {fastOutputUrl && (
        <div style={{ background: '#10b98122', border: '1px solid #10b981', padding: '12px', borderRadius: '10px', textAlign: 'center', margin: '10px 0' }}>
          <b style={{ color: '#34d399', display: 'block', marginBottom: '6px' }}>🎉 Video Ready!</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              className="btn primary"
              href={fastOutputUrl}
              download={`${(project.name || 'video').replace(/\s+/g, '_')}.${exportExt}`}
              style={{ display: 'block', width: '100%', textDecoration: 'none', background: '#10b981', borderColor: '#10b981', fontWeight: 800 }}
            >
              ⬇️ Download {exportExt.toUpperCase()} Video File
            </a>
            <button
              type="button"
              className="btn"
              onClick={handleShareVideo}
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--line)', fontWeight: 700 }}
            >
              📲 Save to Phone Gallery / WhatsApp
            </button>
          </div>
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

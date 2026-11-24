import { Router } from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { UPLOAD_DIR } from '../media/media.routes.js';

const r = Router();
r.use(requireAuth);

function detectVocalSegments(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-i', filePath,
      '-af', 'silencedetect=noise=-28dB:d=0.25',
      '-f', 'null', '-'
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', () => {
      const silences = [];
      const regexStart = /silence_start:\s*([0-9.]+)/g;
      const regexEnd = /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g;
      
      let match;
      const starts = [];
      while ((match = regexStart.exec(stderr)) !== null) {
        starts.push(parseFloat(match[1]));
      }

      const ends = [];
      while ((match = regexEnd.exec(stderr)) !== null) {
        ends.push({ end: parseFloat(match[1]), dur: parseFloat(match[2]) });
      }

      // Convert silences into active vocal/audio segments
      const segments = [];
      let cursor = 0;
      for (let i = 0; i < starts.length; i++) {
        const sStart = starts[i];
        if (sStart - cursor > 0.4) {
          segments.push({ start: cursor, end: sStart, duration: Math.max(0.5, sStart - cursor) });
        }
        cursor = ends[i] ? ends[i].end : sStart;
      }

      // Get total duration from stderr
      const durMatch = /Duration:\s*([0-9:.]+)/.exec(stderr);
      let totalDur = 0;
      if (durMatch) {
        const parts = durMatch[1].split(':');
        totalDur = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      }

      if (totalDur > cursor + 0.5) {
        segments.push({ start: cursor, end: totalDur, duration: totalDur - cursor });
      }

      resolve({ segments, totalDur });
    });

    proc.on('error', () => resolve({ segments: [], totalDur: 0 }));
  });
}

// Optional Whisper transcription via python
function runWhisper(filePath, lang = 'hi') {
  return new Promise((resolve) => {
    const pyScript = `
import sys, json
try:
    from faster_whisper import WhisperModel
    model = WhisperModel("tiny", device="cpu", compute_type="int8", download_root="models")
    segments, info = model.transcribe(sys.argv[1], language=sys.argv[2], vad_filter=True)
    out = []
    for s in segments:
        out.append({"start": round(s.start, 2), "end": round(s.end, 2), "duration": round(s.end - s.start, 2), "text": s.text.strip()})
    print(json.dumps(out))
except Exception as e:
    print(json.dumps([]))
`;
    const proc = spawn('python', ['-c', pyScript, filePath, lang === 'hi' ? 'hi' : 'en'], { timeout: 8000 });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (Array.isArray(parsed) && parsed.length > 0) return resolve(parsed);
      } catch {}
      resolve(null);
    });
    proc.on('error', () => resolve(null));
  });
}

r.post('/analyze', async (req, res) => {
  const { mediaId, lyrics, lang = 'hi' } = req.body;
  
  let filePath = null;
  let mediaDuration = 10;

  if (mediaId) {
    const media = await prisma.projectMedia.findUnique({ where: { id: mediaId } });
    if (media) {
      filePath = path.join(UPLOAD_DIR, path.basename(media.url));
      mediaDuration = media.duration || 10;
    }
  }

  // 1. If lyrics are provided (custom pasted or preset), split and sync to audio
  if (lyrics && typeof lyrics === 'string') {
    const lines = lyrics
      .split(/\r?\n|।|\||\. /)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length > 0) {
      let vocalSegments = [];
      if (filePath) {
        const detected = await detectVocalSegments(filePath);
        vocalSegments = detected.segments;
        if (detected.totalDur > 0) mediaDuration = detected.totalDur;
      }

      // If vocal segments found, map lines onto them
      if (vocalSegments.length >= lines.length) {
        const out = lines.map((text, i) => ({
          start: vocalSegments[i].start,
          duration: Math.max(1.2, vocalSegments[i].duration),
          text,
        }));
        return res.json({ captions: out });
      }

      // Otherwise distribute smoothly across media duration
      const segDur = Math.max(1.8, Math.min(4.5, (mediaDuration - 0.5) / lines.length));
      const out = lines.map((text, i) => ({
        start: +(i * segDur).toFixed(2),
        duration: +(segDur * 0.92).toFixed(2),
        text,
      }));
      return res.json({ captions: out });
    }
  }

  // 2. If no lyrics provided, attempt Whisper transcription if file exists
  if (filePath) {
    const whisperResult = await runWhisper(filePath, lang);
    if (whisperResult && whisperResult.length > 0) {
      return res.json({ captions: whisperResult });
    }

    // Fallback: detect vocal audio segments
    const detected = await detectVocalSegments(filePath);
    if (detected.segments.length > 0) {
      const defaultHindi = [
        'नमस्ते दोस्तों 🙏',
        'वीडियो को लाइक और शेयर करें ✨',
        'कमेंट में बताएं कैसा लगा ❤️',
        'चैनल को सब्सक्राइब ज़रूर करें 🔔',
      ];
      const defaultEnglish = [
        'Welcome everyone! ✨',
        'Don\'t forget to like and share 💥',
        'Let me know in comments ❤️',
        'Subscribe for more awesome videos 🔔',
      ];
      const defaults = lang === 'hi' ? defaultHindi : defaultEnglish;

      const out = detected.segments.slice(0, 12).map((seg, i) => ({
        start: +seg.start.toFixed(2),
        duration: +seg.duration.toFixed(2),
        text: defaults[i % defaults.length],
      }));
      return res.json({ captions: out });
    }
  }

  return res.json({ captions: [] });
});

export default r;

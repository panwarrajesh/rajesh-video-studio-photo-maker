import { Router } from 'express';
import { spawn } from 'child_process';

const tool = (cmd) => new Promise((ok, bad) => { const p = spawn(cmd, ['-version']); const t = setTimeout(() => { p.kill(); bad(new Error('timeout')); }, 4000); p.on('error', () => { clearTimeout(t); bad(new Error(`${cmd} is not installed`)); }); p.on('close', (c) => { clearTimeout(t); c === 0 ? ok() : bad(new Error(`${cmd} failed`)); }); });

// GET /api/health/deep: tells an operator (or the phone app's "Connection check") what is broken. Only yes/no and short messages, never secrets.
export function createHealthRouter({ db, tokenTable, ffmpeg = () => tool('ffmpeg'), env = process.env }) {
  const r = Router();
  r.get('/deep', async (_req, res) => {
    const out = { ok: true, time: new Date().toISOString(), storage: env.S3_BUCKET ? 's3' : 'local', checks: {} };
    const run = async (name, fn) => { try { out.checks[name] = { ok: true, ...(await fn()) }; } catch (e) { out.ok = false; out.checks[name] = { ok: false, error: String(e.message || e).split('\n').filter(Boolean).pop().slice(0, 200) }; } };
    await run('database', async () => { await db(); return {}; });
    await run('refreshTokenTable', async () => { await tokenTable(); return {}; });
    await run('ffmpeg', async () => { await ffmpeg(); return {}; });
    await run('jwtSecret', async () => { if (!env.JWT_SECRET) throw new Error('JWT_SECRET is not set'); return {}; });
    res.status(out.ok ? 200 : 503).json(out);
  });
  return r;
}

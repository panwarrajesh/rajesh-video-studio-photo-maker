// Resumable upload client (no React / Expo imports: file reading and HTTP are injected, so it is tested against the real server code).
// request(method, path, { headers, json, raw }) must return parsed JSON or throw an error with { status, network, data }.
const retryable = (e) => !!e.network || e.status >= 500 || e.status === 408 || e.status === 429;

export async function resumableUpload({ request, readChunk, file, onProgress, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxFailures = 6, resume }) {
  // Every request is retried with backoff when it fails for a reason that can pass (no internet, server busy). Wrong type / too big etc. stop at once.
  const call = async (fn) => { let n = 0; for (;;) { try { return await fn(); } catch (e) { if (!retryable(e) || ++n >= maxFailures) throw e; await sleep(Math.min(8000, 400 * 2 ** n)); } } };

  let id = resume ? await resume.get() : null, session = null;
  if (id) { // an unfinished upload of this same file exists: ask the server how much it already has
    try { session = await call(() => request('GET', `/media/uploads/${id}`)); } catch (e) { if (e.status !== 404) throw e; await resume.clear(); id = null; }
  }
  if (!session) {
    session = await call(() => request('POST', '/media/uploads', { json: { name: file.name, size: file.size, mime: file.mime, projectId: file.projectId || null, duration: file.duration || null } }));
    id = session.uploadId; await resume?.set(id);
  }
  const size = file.size; let offset = session.received || 0;
  onProgress?.(offset / size);
  while (offset < size) {
    const len = Math.min(session.chunkSize, size - offset), bytes = await readChunk(offset, len);
    try {
      const r = await call(() => request('PATCH', `/media/uploads/${id}`, { headers: { 'Upload-Offset': String(offset), 'Content-Type': 'application/octet-stream' }, raw: bytes }));
      offset = r.received;
    } catch (e) {
      // 409 = we are out of step (e.g. the chunk arrived but the reply was lost). Continue from where the server really is.
      if (e.status === 409 && e.data?.received != null) offset = e.data.received; else throw e;
    }
    onProgress?.(Math.min(1, offset / size));
  }
  const media = await call(() => request('POST', `/media/uploads/${id}/complete`)); // idempotent on the server
  await resume?.clear();
  return media;
}

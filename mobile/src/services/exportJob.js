import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api } from './api';
import { API_URL } from '../config';

// The server (FFmpeg) renders the video, so phone and web exports look the same.
export function exportPayload({ clips, tracks }, settings) {
  const send = clips.filter((c) => !tracks[c.track]?.hidden && !(c.track === 'AUDIO' && tracks.AUDIO?.muted))
    .map((c) => (c.track === 'VIDEO' && tracks.VIDEO?.muted ? { ...c, props: { ...c.props, muted: true } } : c));
  return { settings, clips: send };
}
export const startExport = (projectId, body) => api.request(`/projects/${projectId}/export`, { method: 'POST', body });
export const getExport = (id) => api.request(`/exports/${id}`);
const abs = (u) => (/^https?:/.test(u) ? u : `${API_URL.replace(/\/api$/, '')}${u}`);
export async function downloadAndShare(outputUrl, ext) {
  const to = `${FS.cacheDirectory}RVS-${Date.now()}.${ext}`;
  const r = await FS.downloadAsync(abs(outputUrl), to);
  if (r.status !== 200) throw new Error('Download failed. Try again.');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(r.uri, { mimeType: ext === 'mp4' ? 'video/mp4' : 'video/webm', dialogTitle: 'Save or share your video' });
  return r.uri;
}

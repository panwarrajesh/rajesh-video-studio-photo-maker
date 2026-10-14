import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';

// ---- film strip: a few real frames of each video, cached per file, loaded one after another so the phone is never flooded
const strips = new Map(); let queue = Promise.resolve();
export function filmstrip(url, duration, count = 8) {
  const key = `${url}#${count}`;
  if (!strips.has(key)) {
    const job = queue.then(async () => {
      const out = [];
      for (let i = 0; i < count; i++) {
        try { out.push((await VideoThumbnails.getThumbnailAsync(url, { time: Math.round(((i + 0.5) / count) * Math.max(duration, 0.2) * 1000), quality: 0.3 })).uri); }
        catch { out.push(null); } // one bad frame must not break the strip
      }
      return out;
    });
    queue = job.catch(() => {}); strips.set(key, job);
  }
  return strips.get(key);
}
export const frameIndex = (t, duration, n) => Math.max(0, Math.min(n - 1, Math.floor((t / Math.max(duration, 0.001)) * n)));

// ---- project thumbnail for the home screen: small JPEG data-URL (the server accepts up to 80 000 characters)
export async function projectThumb(asset) {
  try {
    let uri = asset.uri;
    if (asset.type === 'video') uri = (await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 500, quality: 0.5 })).uri;
    const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 200 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    const url = `data:image/jpeg;base64,${r.base64}`;
    return url.length < 80000 ? url : null;
  } catch { return null; }
}

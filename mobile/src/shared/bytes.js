// base64 -> bytes, fast enough for multi-MB chunks (used to send file chunks read by expo-file-system)
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', LUT = new Uint8Array(256).fill(255);
for (let i = 0; i < 64; i++) LUT[A.charCodeAt(i)] = i;
export function b64ToBytes(b64) {
  let n = b64.length; while (n && (b64[n - 1] === '=' || b64[n - 1] === '\n' || b64[n - 1] === '\r')) n--;
  const out = new Uint8Array(Math.floor((n * 3) / 4)); let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < n; i++) { const v = LUT[b64.charCodeAt(i)]; if (v === 255) continue; buf = (buf << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; } buf &= (1 << bits) - 1; }
  return o === out.length ? out : out.subarray(0, o);
}

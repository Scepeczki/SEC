// Draws the app icon as a 256×256 PNG (electron/icon.png): a pixel-art ammonite (a self-organising
// logarithmic spiral) on a dark tile with an amber rim, with a few drifting "entropy" sparks.
// Run: node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const N = 32, K = 8, S = N * K;
const grid = Array.from({ length: N * N }, () => [0, 0, 0, 0]);
const put = (x, y, c, a = 255) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y * N + x] = [...c, a]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mul = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

// ---- tile: rounded square, dark gradient, amber rim
const R = 6;
const inTile = (x, y) => {
  const cx = Math.min(Math.max(x, R), N - 1 - R), cy = Math.min(Math.max(y, R), N - 1 - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R + 1;
};
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (!inTile(x, y)) continue;
  const rim = !inTile(x - 1, y) || !inTile(x + 1, y) || !inTile(x, y - 1) || !inTile(x, y + 1);
  const rim2 = !rim && (!inTile(x - 2, y) || !inTile(x + 2, y) || !inTile(x, y - 2) || !inTile(x, y + 2));
  if (rim) put(x, y, y < N / 2 ? [245, 190, 90] : [200, 128, 40]);
  else if (rim2) put(x, y, [70, 50, 24]);
  else put(x, y, mix([52, 44, 30], [20, 18, 13], (x + y) / (2 * N)));
}

// ---- ammonite
const cx = 15.5, cy = 16.5, g = 1.85, a = 0.55, Rmax = 12.6;
const lnG = Math.log(g);
const shell = new Uint8Array(N * N);
const col = Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  const r = Math.hypot(dx, dy);
  let th = Math.atan2(dy, dx) - 0.6; // rotate the aperture to the lower right
  th = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const outer = Rmax * g ** ((th - 2 * Math.PI) / (2 * Math.PI));
  if (r > outer || r < 0.9) continue;
  const k = Math.floor(Math.log(r / a) / lnG - th / (2 * Math.PI));
  const r0 = a * g ** (k + th / (2 * Math.PI)), r1 = r0 * g;
  const t = (r - r0) / (r1 - r0);
  const rib = Math.cos(th * 11 + k * 1.7) > 0.55;
  let c = [222, 150, 58];
  c = mul(c, 0.72 + 0.48 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))); // rounded whorl
  c = mul(c, 1 + 0.16 * (-(dx + dy) / 12)); // light from the upper left
  if (rib) c = mix(c, [255, 222, 150], 0.45);
  if (t < 0.13) c = [92, 54, 20]; // suture between whorls
  shell[y * N + x] = 1;
  col[y * N + x] = c;
}
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const p = y * N + x;
  if (shell[p]) { put(x, y, col[p]); continue; }
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => shell[(y + oy) * N + x + ox] && x + ox >= 0 && x + ox < N && y + oy >= 0 && y + oy < N);
  if (near && inTile(x, y)) put(x, y, [34, 22, 10]);
}
// highlight glints on the shell
for (const [x, y] of [[9, 9], [10, 8], [12, 7]]) if (shell[y * N + x]) put(x, y, [255, 240, 200]);

// ---- entropy sparks drifting off to the upper right
for (const [x, y, c] of [[25, 6, [120, 210, 230]], [27, 9, [180, 140, 255]], [23, 4, [255, 220, 120]], [28, 5, [120, 210, 230]], [26, 12, [180, 140, 255]]]) {
  if (inTile(x, y) && !shell[y * N + x]) put(x, y, c);
}

// ---- upscale + PNG
const px = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const c = grid[Math.floor(y / K) * N + Math.floor(x / K)];
  px.set(c, (y * S + x) * 4);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
writeFileSync('electron/icon.png', png);
console.log('electron/icon.png', png.length, 'bytes');

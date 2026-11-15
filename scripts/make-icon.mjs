// Draws the app icon (pixel-art dinosaur on an amber tile) as a 256×256 PNG: electron/icon.png.
// Run: node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// a long-necked sauropod
const ART = [
  '................',
  '................',
  '...........###..',
  '..........###o#.',
  '..........##....',
  '.........##.....',
  '........##......',
  '.......##.......',
  '...#######......',
  '.##########.....',
  '############....',
  '#...#######.....',
  '....##...##.....',
  '....##...##.....',
  '....##...##.....',
  '................',
];
const N = 16, K = 16, S = N * K;
const BG = [234, 166, 58], BG2 = [205, 136, 38], DINO = [32, 28, 20], EYE = [255, 230, 160];
const px = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const cx = Math.floor(x / K), cy = Math.floor(y / K);
  const corner = (cx === 0 || cx === N - 1) && (cy === 0 || cy === N - 1);
  const i = (y * S + x) * 4;
  if (corner) { px[i + 3] = 0; continue; }
  const ch = ART[cy][cx];
  const shade = cy === N - 1 || cx === N - 1; // bevel on the bottom-right edge
  const c = ch === '#' ? DINO : ch === 'o' ? EYE : shade ? BG2 : BG;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
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

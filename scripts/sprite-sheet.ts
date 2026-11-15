// Render sprite contact sheets to PNG for visual QA.
// Usage: npx tsx scripts/sprite-sheet.ts archetypes|stages|names:A,B,C [out.png] [zoom]

import fs from 'node:fs';
import zlib from 'node:zlib';
import { TAXA, spriteSpec } from '../src/data/db';
import { renderSprite } from '../src/sprites/generator';
import type { Genus } from '../src/data/types';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w: number, h: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mode = process.argv[2] ?? 'archetypes';
const out = process.argv[3] ?? 'sheet.png';
const zoom = Number(process.argv[4] ?? 2);

let rows: Genus[][] = [];
let stages = [1];
if (mode === 'archetypes') {
  const seen = new Map<string, Genus>();
  for (const g of TAXA.genera) {
    const prev = seen.get(g.archetype);
    if (!prev || (g.icon && !prev.icon)) seen.set(g.archetype, g);
  }
  const list = [...seen.values()];
  for (let i = 0; i < list.length; i += 10) rows.push(list.slice(i, i + 10));
} else {
  const names = mode.startsWith('names:') ? mode.slice(6).split(',') : ['Tyrannosaurus', 'Triceratops', 'Stegosaurus', 'Brachiosaurus', 'Velociraptor', 'Parasaurolophus', 'Mammuthus', 'Smilodon', 'Dimetrodon', 'Pteranodon', 'Mosasaurus', 'Dunkleosteus'];
  const byName = new Map(TAXA.genera.map((g) => [g.name, g]));
  const list = names.map((n) => byName.get(n)).filter((g): g is Genus => !!g);
  if (mode.startsWith('names:') && list.length > 12) for (let i = 0; i < list.length; i += 10) rows.push(list.slice(i, i + 10));
  else { rows = list.map((g) => [g]); stages = [0, 1, 2, 3, 4]; }
}

const cellW = 76, cellH = 60;
const cols = Math.max(...rows.map((r) => r.length)) * stages.length;
const W = cols * cellW * zoom, H = rows.length * cellH * zoom;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([206, 214, 190, 255], i * 4);
const legend: string[] = [];
rows.forEach((row, ri) => {
  legend.push(`row ${ri}: ` + row.map((g) => `${g.name}(${g.archetype},${g.size})`).join(', '));
  row.forEach((g, gi) => {
    stages.forEach((st, si) => {
      const spr = renderSprite(spriteSpec(g), st, 0);
      const cx = (gi * stages.length + si) * cellW, cy = ri * cellH;
      // checker border
      for (let x = 0; x < cellW * zoom; x++) img.set([180, 190, 165, 255], ((cy * zoom) * W + cx * zoom + x) * 4);
      const ox = cx + Math.floor((cellW - spr.w) / 2), oy = cy + Math.max(0, cellH - spr.h - 2);
      for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
        const a = spr.data[(y * spr.w + x) * 4 + 3];
        if (!a) continue;
        const px = ox + x, py = oy + y;
        if (px < 0 || py < 0 || px >= cols * cellW || py >= rows.length * cellH) continue;
        for (let zy = 0; zy < zoom; zy++) for (let zx = 0; zx < zoom; zx++) {
          const i = ((py * zoom + zy) * W + px * zoom + zx) * 4;
          const t = a / 255;
          for (let c = 0; c < 3; c++) img[i + c] = Math.round(img[i + c] * (1 - t) + spr.data[(y * spr.w + x) * 4 + c] * t);
        }
      }
    });
  });
});
fs.writeFileSync(out, encodePNG(W, H, img));
console.log(legend.join('\n'));
console.log(`-> ${out} ${W}x${H}`);

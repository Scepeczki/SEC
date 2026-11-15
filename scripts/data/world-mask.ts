// Rasterises Natural Earth land polygons (public domain, via the world-atlas package) into a small
// equirectangular pixel mask for the pixel-art world map: src/data/world.json.
// Run: npx tsx scripts/data/world-mask.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

const W = 480;
const LAT_TOP = 84;
const LAT_BOTTOM = -80;
const DEG = 360 / W;
const H = Math.round((LAT_TOP - LAT_BOTTOM) / DEG);

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf8')) as Topology;
const land = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

const rings: number[][][] = [];
for (const f of land.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const r of p) rings.push(r as number[][]);
}

const mask = new Uint8Array(W * H);
const toX = (lng: number) => ((lng + 180) / 360) * W;
const toY = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;

// scanline fill, one ring at a time (XOR, so lake holes cut out of their continent). Longitudes are unwrapped
// per ring first: rings crossing the 180° meridian (Chukotka, Fiji…) used to flood whole rows with land.
const unwrapped = rings.map((r) => {
  const out: number[][] = [];
  let off = 0;
  for (let i = 0; i < r.length; i++) {
    if (i) { const d = r[i][0] - r[i - 1][0]; if (d > 180) off -= 360; else if (d < -180) off += 360; }
    out.push([r[i][0] + off, r[i][1]]);
  }
  return out;
});
for (const r of unwrapped) {
  const lats = r.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(toY(Math.max(...lats)))), y1 = Math.min(H - 1, Math.ceil(toY(Math.min(...lats))));
  for (let y = y0; y <= y1; y++) {
    const lat = LAT_TOP - (y + 0.5) * DEG;
    const xs: number[] = [];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [lx1, la1] = r[j], [lx2, la2] = r[i];
      if ((la1 > lat) !== (la2 > lat)) xs.push(lx1 + ((lat - la1) / (la2 - la1)) * (lx2 - lx1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(toX(xs[k])), b = Math.round(toX(xs[k + 1]));
      for (let x = a; x < b; x++) { const xx = ((x % W) + W) % W; mask[y * W + xx] ^= 1; }
    }
  }
}
// keep small islands: any vertex marks its pixel
for (const r of rings) {
  const lngs = r.map((p) => p[0]), lats = r.map((p) => p[1]);
  if (Math.max(...lngs) - Math.min(...lngs) < 0.8 && Math.max(...lats) - Math.min(...lats) < 0.8) continue; // skip specks
  for (const [lng, lat] of r) {
    const x = Math.floor(toX(lng)), y = Math.floor(toY(lat));
    if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
  }
}

const rows: string[] = [];
for (let y = 0; y < H; y++) {
  let s = '';
  for (let x = 0; x < W; x += 4) s += ((mask[y * W + x] << 3) | (mask[y * W + x + 1] << 2) | (mask[y * W + x + 2] << 1) | mask[y * W + x + 3]).toString(16);
  rows.push(s);
}
writeFileSync('src/data/world.json', JSON.stringify({ source: 'Natural Earth 1:50m land (public domain) via world-atlas', w: W, h: H, latTop: LAT_TOP, latBottom: LAT_BOTTOM, rows }));
console.log(`world mask ${W}×${H}, land ${mask.reduce((a, b) => a + b, 0)} px`);

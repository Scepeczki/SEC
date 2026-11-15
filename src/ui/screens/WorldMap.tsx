// Pixel-art world map for picking a dig site. Land mask: Natural Earth (public domain), see scripts/data/world-mask.ts.
// Biomes, mountains and lakes are painted procedurally from a hand-made list of real regions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Lock, LockOpen, Minus, Pickaxe, Plus, Search, X } from 'lucide-react';
import world from '../../data/world.json';
import { GENERA, SITES, SITE_BY_ID } from '../../data/db';
import type { Site } from '../../data/types';
import { formatMa } from '../../data/geotime';
import { fmt } from '../../game/balance';
import { SITE_UNLOCK } from '../../game/content';
import { depthMeters } from '../../game/dig';
import { STRATA, siteMinerals, stratumAt } from '../../game/geology';
import { canUnlockSite, parkLevel, unlockSite } from '../../game/meta';
import type { GameState } from '../../game/state';
import { iconUrl } from '../dig/art';
import { Btn, SpriteImg } from '../components';
import { useStore } from '../store';

const W = world.w, H = world.h;
const DEG = 360 / W;
const landAt = (x: number, y: number) => {
  x = ((x % W) + W) % W;
  return y >= 0 && y < H && ((parseInt(world.rows[y][x >> 2], 16) >> (3 - (x & 3))) & 1) === 1;
};
const latOf = (y: number) => world.latTop - (y + 0.5) * DEG;
const lngOf = (x: number) => -180 + (x + 0.5) * DEG;
const toPx = (lat: number, lng: number): [number, number] => [((lng + 180) / 360) * W, ((world.latTop - lat) / (world.latTop - world.latBottom)) * H];
type C3 = [number, number, number];
const hex = (h: string): C3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a: C3, b: C3, t: number): C3 => { const k = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };

// ---------------------------------------------------------------- noise
function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.15 + vnoise(x * 8.7, y * 8.7) * 0.08;

// ---------------------------------------------------------------- real regions (approximate)
type Box = [number, number, number, number, number?]; // lat0, lat1, lng0, lng1, strength
const DESERTS: Box[] = [
  [15, 31, -17, 34], [14, 31, 35, 58], [24, 36, 50, 72], [36, 46, 52, 66, 0.7], [37, 46, 76, 110, 0.8],
  [-31, -19, 118, 141], [-28, -17, 12, 24, 0.8], [-27, -17, -71, -68], [31, 41, -119, -105, 0.7], [-50, -38, -71, -64, 0.5],
  [24, 30, 68, 75, 0.8],
];
const RAINFOREST: Box[] = [[-14, 5, -76, -46], [-5, 5, 9, 30], [-10, 18, 95, 152], [5, 15, -92, -76, 0.6], [-25, -12, 145, 154, 0.5]];
const SAVANNA: Box[] = [[5, 15, -17, 40], [-18, -5, 12, 40], [-24, -12, -60, -40], [-20, -12, 120, 145], [10, 28, 70, 90, 0.6]];
type Ridge = { pts: [number, number][]; w: number; h: number };
const RIDGES: Ridge[] = [
  { pts: [[64, -150], [60, -138], [55, -127], [48, -115], [40, -106], [32, -106]], w: 4, h: 0.85 },
  { pts: [[49, -121], [40, -121], [35, -118]], w: 1.6, h: 0.6 },
  { pts: [[11, -73], [2, -77], [-10, -76], [-18, -69], [-27, -68], [-36, -70], [-48, -73], [-53, -72]], w: 2.4, h: 1 },
  { pts: [[36, 71], [32, 78], [29, 84], [28, 90], [28, 97]], w: 3, h: 1.2 },
  { pts: [[45, 6], [46.5, 9], [47.2, 13]], w: 1.3, h: 0.75 },
  { pts: [[49, 18], [48.5, 23], [46, 25.5]], w: 1, h: 0.4 },
  { pts: [[43.5, 39.5], [42.5, 44], [41.5, 47.5]], w: 1.2, h: 0.75 },
  { pts: [[68, 63], [61, 59.5], [52, 58.5]], w: 1.6, h: 0.35 },
  { pts: [[37.5, 44], [33, 48], [29, 53], [27, 57]], w: 1.8, h: 0.5 },
  { pts: [[31, -9], [33, -4], [35.5, 2], [36.5, 8]], w: 1.6, h: 0.55 },
  { pts: [[12, 39], [5, 38], [-3, 36.5], [-10, 34.5]], w: 2.2, h: 0.5 },
  { pts: [[-14, 144], [-23, 148], [-30, 152], [-37, 148]], w: 1.6, h: 0.35 },
  { pts: [[41, 68], [42.5, 76], [43, 82], [47, 88], [50, 90]], w: 2.4, h: 0.75 },
  { pts: [[69, 18], [65, 14], [61, 9], [59, 7]], w: 1.8, h: 0.45 },
  { pts: [[47, -68], [42, -74], [38, -80], [34, -85]], w: 1.6, h: 0.3 },
  { pts: [[42.8, -1], [42.6, 2]], w: 0.9, h: 0.5 },
  { pts: [[-22, 47], [-17, 49]], w: 1.4, h: 0.35 },
];
const PLATEAUS: Box[] = [[29, 38, 78, 100, 0.85], [-24, -14, -69, -64, 0.7], [-2, 10, 35, 40, 0.45]];
type Lake = [number, number, number, number]; // lat, lng, rLat, rLng
const LAKES: Lake[] = [
  [47.6, -87.6, 0.75, 3.3], [43.9, -87.0, 2.2, 0.6], [44.9, -82.4, 1.0, 1.1], [42.2, -81.2, 0.45, 1.9], [43.6, -77.9, 0.35, 1.3],
  [-1.0, 33.0, 1.1, 1.2], [52.6, 106.6, 0.9, 0.55], [54.4, 109.0, 1.3, 0.55], [-6.4, 29.7, 2.8, 0.35], [-12.0, 34.5, 2.3, 0.35],
  [60.9, 31.5, 0.6, 0.9], [66.0, -121.0, 0.8, 2.4], [61.6, -114.0, 0.5, 2.4], [52.5, -97.8, 1.2, 0.6], [45.2, 60.0, 0.9, 1.1],
];

function boxW(lat: number, lng: number, [a0, a1, o0, o1, s = 1]: Box, soft = 3.5): number {
  const dLat = Math.max(a0 - lat, 0, lat - a1), dLng = Math.max(o0 - lng, 0, lng - o1);
  const d = Math.hypot(dLat, dLng * Math.cos((lat * Math.PI) / 180));
  return s * Math.max(0, 1 - d / soft);
}
function segDist(lat: number, lng: number, [a, b]: [number, number], [c, d]: [number, number]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const px = lng * k, py = lat, ax = b * k, ay = a, bx = d * k, by = c;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function elevation(lat: number, lng: number): number {
  const wob = (fbm(lng * 0.35, lat * 0.35) - 0.5) * 4;
  let e = 0;
  for (const r of RIDGES) {
    let d = Infinity;
    for (let i = 0; i + 1 < r.pts.length; i++) d = Math.min(d, segDist(lat + wob * 0.5, lng + wob, r.pts[i], r.pts[i + 1]));
    e = Math.max(e, r.h * Math.max(0, 1 - d / (r.w * 1.5)) ** 1.1);
  }
  for (const p of PLATEAUS) e = Math.max(e, boxW(lat + wob * 1.5, lng - wob * 1.5, p, 5) * (p[4] ?? 1));
  // break ridges into massifs and valleys instead of straight lines
  const rough = fbm(lng * 1.4 + 11, lat * 1.4 + 7);
  return e * Math.max(0, rough * 1.6 - 0.25);
}

let mapUrlCache = '';
/** the map itself, drawn once into a small image (scaled up with pixelated rendering) */
function mapUrl(): string {
  if (mapUrlCache) return mapUrlCache;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const N = W * H;
  // land / water with painted lakes
  const land = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let l = landAt(x, y);
    if (l) {
      const lat = latOf(y), lng = lngOf(x);
      for (const [la, lo, rla, rlo] of LAKES) if (((lat - la) / rla) ** 2 + ((lng - lo) / rlo) ** 2 <= 1) { l = false; break; }
    }
    land[y * W + x] = l ? 1 : 0;
  }
  // distance to the coast (both ways), for shallows and coastal tundra
  const dist = new Uint8Array(N).fill(255);
  let q: number[] = [];
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p / W) | 0;
    const l = land[p];
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const ny = y + dy; if (ny < 0 || ny >= H) return false; return land[ny * W + ((x + dx + W) % W)] !== l; });
    if (edge) { dist[p] = 0; q.push(p); }
  }
  for (let d = 1; d < 12 && q.length; d++) {
    const nq: number[] = [];
    for (const p of q) {
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        const np = ny * W + ((x + dx + W) % W);
        if (land[np] === land[p] && dist[np] === 255) { dist[np] = d; nq.push(np); }
      }
    }
    q = nq;
  }
  const elev = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (land[y * W + x]) elev[y * W + x] = elevation(latOf(y), lngOf(x));

  const C = {
    deep: hex('#1b344b'), mid: hex('#224563'), shallow: hex('#2f6382'), surf: hex('#3d7896'),
    tundra: hex('#8b9479'), taiga: hex('#3e6844'), temperate: hex('#5c8a4b'), steppe: hex('#97995f'), savanna: hex('#a5a058'),
    rain: hex('#2d6a3a'), sand: hex('#d6b97c'), dune: hex('#c49d62'), rock: hex('#8c8272'), snow: hex('#eef1f1'), ice: hex('#e3ebee'),
  };
  for (let y = 0; y < H; y++) {
    const lat = latOf(y), alat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const p = y * W + x, lng = lngOf(x);
      const n = fbm(lng * 0.25, lat * 0.25), n2 = fbm(lng * 1.3 + 50, lat * 1.3);
      let col: C3;
      if (!land[p]) {
        const d = dist[p];
        col = d === 0 ? C.surf : d < 2 ? C.shallow : d < 5 ? mixc(C.shallow, C.mid, (d - 1) / 4) : mixc(C.mid, C.deep, Math.min(1, (d - 5) / 4 + (n - 0.5)));
        const k = 0.94 + n2 * 0.1;
        col = [col[0] * k, col[1] * k, col[2] * k];
      } else {
        // climate by latitude, softened by noise
        const j = (n - 0.5) * 8;
        const lat2 = alat + j;
        col = lat2 > 64 ? C.tundra : lat2 > 50 ? mixc(C.taiga, C.tundra, (lat2 - 58) / 6) : lat2 > 38 ? mixc(C.temperate, C.taiga, (lat2 - 44) / 6) : lat2 > 23 ? mixc(C.steppe, C.temperate, (lat2 - 30) / 8) : lat2 > 12 ? C.savanna : C.temperate;
        const wob = (n - 0.5) * 5;
        const desert = Math.max(...DESERTS.map((b) => boxW(lat + wob, lng - wob, b)));
        const rain = Math.max(...RAINFOREST.map((b) => boxW(lat - wob, lng + wob, b)));
        const sav = Math.max(...SAVANNA.map((b) => boxW(lat + wob, lng + wob, b)));
        if (sav > 0) col = mixc(col, C.savanna, sav);
        if (rain > 0) col = mixc(col, C.rain, rain);
        if (desert > 0) {
          const ripple = vnoise(lng * 2.4 + lat * 0.8, lat * 4.6) > 0.62 ? C.dune : C.sand;
          col = mixc(col, mixc(ripple, C.steppe, 0.12 * n2), Math.min(1, desert * 1.25));
        }
        // mountains with light from the north-west, snow on the highest ridges
        const e = elev[p];
        if (e > 0.05) {
          const nw = elev[Math.max(0, y - 1) * W + ((x - 1 + W) % W)], se = elev[Math.min(H - 1, y + 1) * W + ((x + 1) % W)];
          col = mixc(col, C.rock, Math.min(0.75, e * 0.9));
          const shade = 1 + Math.max(-0.28, Math.min(0.28, (nw - se) * 2.2));
          col = [col[0] * shade, col[1] * shade, col[2] * shade];
          if (e > 0.85 - alat * 0.003) col = mixc(col, C.snow, (e - 0.75) * 2.5);
        }
        // ice caps: Greenland and the far north
        const greenland = boxW(lat, lng, [59, 84, -60, -18], 2);
        if ((greenland > 0.5 && dist[p] > 2) || lat > 79 + n * 3 || lat < -63 - n * 3) col = mixc(C.ice, C.snow, n2);
        const k = (0.93 + n2 * 0.12) * (dist[p] === 0 ? 1.06 : 1);
        col = [col[0] * k, col[1] * k, col[2] * k];
      }
      const i = p * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  mapUrlCache = c.toDataURL();
  return mapUrlCache;
}

// ---------------------------------------------------------------- eras, regions, pins

const ERAS: { name: string; from: number; to: number; w: number; color: string }[] = [
  { name: 'Paleozoik', from: 541, to: 252, w: 0.36, color: '#4d6152' },
  { name: 'Trias', from: 252, to: 201, w: 0.12, color: '#8a4f3c' },
  { name: 'Jura', from: 201, to: 145, w: 0.14, color: '#4f7a4a' },
  { name: 'Kreda', from: 145, to: 66, w: 0.2, color: '#6f8a45' },
  { name: 'Kenozoik', from: 66, to: 0, w: 0.18, color: '#8a7448' },
];
const eraOf = (ma: number) => ERAS.findIndex((e) => ma <= e.from && ma > e.to);
const midMa = (x: Site) => (x.fromMa + x.toMa) / 2;
/** position 0..1 along the (non-linear) era bar */
function timePos(ma: number): number {
  let acc = 0;
  for (const e of ERAS) {
    if (ma <= e.from && ma >= e.to) return acc + e.w * ((e.from - ma) / (e.from - e.to));
    acc += e.w;
  }
  return 1;
}
const SHORT: Record<string, string> = { burgess: 'Burgess', holzmaden: 'Holzmaden', krasiejow: 'Krasiejów', pampas: 'Pampasy', dinosaur_park: 'Dinosaur Park', hell_creek: 'Hell Creek', mazon_creek: 'Mazon Creek', kem_kem: 'Kem Kem', chinle: 'Chinle', djadokhta: 'Djadochta', green_river: 'Green River', oxford_clay: 'Oxford Clay', white_river: 'White River', fezouata: 'Fezouata' };
const shortName = (x: Site) => SHORT[x.id] ?? x.name.replace(/^(Formacja|Wapienie|Łupki|Basen|Kopalnia)\s+/, '').replace(/\s*\(.*\)$/, '');
function regionOf(x: Site): string {
  if (x.lng < -30) return x.lat > 12 ? 'Ameryka Północna' : 'Ameryka Południowa';
  if (x.lng < 60) return x.lat > 36 ? 'Europa' : 'Afryka';
  return x.lat < -10 && x.lng > 110 ? 'Australia' : 'Azja';
}
const REGIONS = ['Ameryka Północna', 'Europa', 'Afryka', 'Azja', 'Ameryka Południowa', 'Australia'];

type PinState = 'active' | 'open' | 'ready' | 'locked';
function pinState(s: GameState, id: string): PinState {
  if (id === s.activeSite) return 'active';
  if (s.unlockedSites[id]) return 'open';
  return canUnlockSite(s, id).ok ? 'ready' : 'locked';
}
function PinIcon({ st }: { st: PinState }) {
  return st === 'locked' ? <Lock className="ic" /> : st === 'ready' ? <LockOpen className="ic" /> : <Pickaxe className="ic" />;
}

const ZOOMS = [1, 1.6, 2.5, 4, 6.5];

/**
 * Pin positions in map pixels. Sites that lie almost on top of each other (Kem Kem and Fezouata, the
 * Mongolian pair, Morrison and White River…) are pushed a little apart so each gets its own pin when zoomed in.
 */
const PIN_POS: Map<string, [number, number]> = (() => {
  const MIN = 3.4; // map pixels (~2.5°)
  const pts = SITES.map((x) => { const [px, py] = toPx(x.lat, x.lng); return { id: x.id, x: px, y: py }; });
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= MIN) continue;
      if (d < 1e-3) { dx = 1; dy = 0; }
      const push = (MIN - d) / 2 / (d || 1);
      a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    }
  }
  return new Map(pts.map((p) => [p.id, [p.x, p.y]]));
})();
const pinPx = (id: string) => PIN_POS.get(id)!;
const MINI_W = 220;

export function WorldMap({ s, onDig }: { s: GameState; onDig: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 640 });
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sel, setSel] = useState<string | null>(s.activeSite);
  const [hover, setHover] = useState<string | null>(null);
  const [era, setEra] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const url = useMemo(mapUrl, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const S0 = Math.max(size.w / W, size.h / H);
  const S = S0 * ZOOMS[zoom];
  // the world wraps around horizontally; only the vertical pan is limited
  const clamp = (p: { x: number; y: number }, sc = S) => ({ x: ((p.x % (W * sc)) - W * sc) % (W * sc), y: Math.min(0, Math.max(size.h - H * sc, p.y)) });
  const cpan = clamp(pan);
  const wrapX = (x: number) => { const ws = W * S; let v = ((x % ws) + ws) % ws; if (v > size.w + 40 && v - ws > -40) v -= ws; return v; };
  const zoomTo = (z: number, at?: { x: number; y: number }) => {
    const nz = Math.max(0, Math.min(ZOOMS.length - 1, z));
    const p = at ?? { x: size.w / 2, y: size.h / 2 };
    const ns = S0 * ZOOMS[nz];
    const mx = (p.x - cpan.x) / S, my = (p.y - cpan.y) / S;
    setZoom(nz);
    setPan(clamp({ x: p.x - mx * ns, y: p.y - my * ns }, ns));
  };
  const centerOn = (mx: number, my: number) => setPan(clamp({ x: size.w / 2 - mx * S, y: size.h / 2 - my * S }));
  useEffect(() => {
    const a = SITE_BY_ID.get(s.activeSite);
    if (!a) return;
    const [x, y] = pinPx(a.id);
    setPan(clamp({ x: size.w * 0.38 - x * S, y: size.h / 2 - y * S }));
  }, [size.w, size.h]);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.map-overlay')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(zoom + (e.deltaY < 0 ? 1 : -1), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const eraOk = (id: string) => era === null || eraOf(midMa(SITE_BY_ID.get(id)!)) === era;
  const marks = useMemo(() => {
    const pts = SITES.map((x) => { const [mx, my] = pinPx(x.id); return { id: x.id, x: wrapX(mx * S + cpan.x), y: my * S + cpan.y }; });
    const solo = new Set([s.activeSite, sel ?? '']);
    const used = new Set<string>();
    const out: { ids: string[]; x: number; y: number }[] = [];
    for (const p of [...pts].sort((a, b) => Number(solo.has(b.id)) - Number(solo.has(a.id)))) {
      if (used.has(p.id)) continue;
      used.add(p.id);
      const group = [p];
      if (!solo.has(p.id)) {
        for (const q of pts) {
          if (used.has(q.id) || solo.has(q.id)) continue;
          if (Math.hypot(q.x - p.x, q.y - p.y) < 30) { group.push(q); used.add(q.id); }
        }
      }
      out.push({ ids: group.map((g) => g.id), x: group.reduce((a, g) => a + g.x, 0) / group.length, y: group.reduce((a, g) => a + g.y, 0) / group.length });
    }
    return out;
  }, [S, cpan.x, cpan.y, sel, s.activeSite, size.w]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .map-overlay')) return;
    e.preventDefault(); // no text/image selection while dragging (it used to paint the map blue at the seam)
    window.getSelection()?.removeAllRanges();
    drag.current = { x: e.clientX, y: e.clientY, px: cpan.x, py: cpan.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setPan(clamp({ x: d.px + dx, y: d.py + dy }));
  };
  const onUp = () => { drag.current = null; };
  const pick = (id: string) => {
    setSel(id);
    const [mx, my] = pinPx(id);
    const sx = wrapX(mx * S + cpan.x), sy = my * S + cpan.y;
    if (sx < 40 || sx > size.w - 420 || sy < 40 || sy > size.h - 40) setPan(clamp({ x: (size.w - 380) / 2 - mx * S, y: size.h / 2 - my * S }));
  };

  // minimap viewport (in minimap pixels; may wrap around)
  const mk = MINI_W / W;
  const vx = (((-cpan.x / S) * mk) % MINI_W) || 0, vw = (size.w / S) * mk, vy = ((-cpan.y / S) * mk) || 0, vh = ((size.h / S) * mk) || 0;

  return (
    <div className="map-screen">
      <div className="site-head">
        <Btn onClick={onDig}><ArrowLeft className="ic" />Wróć do kopania</Btn>
        <h1>Mapa świata</h1>
        <span className="sub">Prawdziwe formacje skalne i ich fauna · poziom parku {parkLevel(s)}</span>
      </div>
      <div className="map-layout">
        <SitesList s={s} sel={sel} pick={pick} eraOk={eraOk} />
        <div ref={frameRef} className="map-frame" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className={`map-viewport ${drag.current?.moved ? 'drag' : ''}`}>
            <div className="map-canvas" style={{ transform: `translate(${cpan.x}px, ${cpan.y}px)` }}>
              {[-1, 0, 1].map((k) => <img key={k} className="pixel" src={url} width={W * S} height={H * S} alt={k ? '' : 'Mapa świata'} draggable={false} style={{ position: 'absolute', left: k * W * S, top: 0 }} />)}
            </div>
            {marks.map((m2) => {
              if (m2.ids.length > 1) {
                const dim = m2.ids.every((id) => !eraOk(id));
                return (
                  <button key={m2.ids.join()} className={`pin cluster ${dim ? 'dim' : ''}`} style={{ left: m2.x, top: m2.y }} title={m2.ids.map((id) => SITE_BY_ID.get(id)!.name).join(', ')}
                    onClick={() => zoomTo(zoom + 1, { x: m2.x, y: m2.y })}>{m2.ids.length}</button>
                );
              }
              const id = m2.ids[0];
              const site = SITE_BY_ID.get(id)!;
              const ps = pinState(s, id);
              const disc = site.fauna.filter((f) => s.discovered[f.genusId]).length;
              const sub = ps === 'active' ? `Tu kopiesz · fauna ${disc}/${site.fauna.length}` : ps === 'open' ? `Odblokowane · fauna ${disc}/${site.fauna.length}` : ps === 'ready' ? 'Można odblokować!' : `Wymaga poziomu ${SITE_UNLOCK[id]?.level}`;
              return (
                <button key={id} className={`pin ${ps} ${id === sel ? 'sel' : ''} ${eraOk(id) ? '' : 'dim'}`} style={{ left: m2.x || 0, top: m2.y || 0 }}
                  onClick={() => { if (!drag.current?.moved) setSel(id); }} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} aria-label={site.name}>
                  <PinIcon st={ps} />
                  {id === hover && <span className="pin-label">{site.name}<small>{sub}</small></span>}
                </button>
              );
            })}
            <div className="map-vignette" />
          </div>

          <div className="map-overlay map-legend">
            <span><span className="pin active"><Pickaxe className="ic" /></span>Tu kopiesz</span>
            <span><span className="pin open"><Pickaxe className="ic" /></span>Odblokowane</span>
            <span><span className="pin ready"><LockOpen className="ic" /></span>Można odblokować</span>
            <span><span className="pin locked"><Lock className="ic" /></span>Zablokowane</span>
          </div>
          <div className="map-overlay map-nav" style={{ right: sel ? 392 : 16 }}>
            <div className="minimap" style={{ width: MINI_W, height: H * mk }} title="Kliknij, żeby przenieść widok"
              onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); centerOn((e.clientX - r.left) / mk, (e.clientY - r.top) / mk); }}>
              <img className="pixel" src={url} width={MINI_W} height={H * mk} alt="" draggable={false} />
              <i style={{ left: vx, top: vy, width: vw, height: vh }} />
              {vx + vw > MINI_W && <i style={{ left: vx - MINI_W, top: vy, width: vw, height: vh }} />}
            </div>
            <div className="dpad zoom-col">
              <button aria-label="Przybliż" disabled={zoom >= ZOOMS.length - 1} onClick={() => zoomTo(zoom + 1)}><Plus className="ic" /></button>
              <button aria-label="Oddal" disabled={zoom <= 0} onClick={() => zoomTo(zoom - 1)}><Minus className="ic" /></button>
            </div>
          </div>
          {sel && <SiteDrawer s={s} siteId={sel} onClose={() => setSel(null)} onDig={onDig} />}
        </div>
      </div>
      <Timeline s={s} sel={sel} setSel={pick} era={era} setEra={setEra} />
    </div>
  );
}

function SitesList({ s, sel, pick, eraOk }: { s: GameState; sel: string | null; pick: (id: string) => void; eraOk: (id: string) => boolean }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'avail' | 'ready' | 'locked'>('all');
  const needle = q.trim().toLowerCase();
  const match = (x: Site) => {
    if (!eraOk(x.id)) return false;
    const ps = pinState(s, x.id);
    if (filter === 'avail' && !(ps === 'open' || ps === 'active')) return false;
    if (filter === 'ready' && ps !== 'ready') return false;
    if (filter === 'locked' && ps !== 'locked') return false;
    if (!needle) return true;
    if (x.name.toLowerCase().includes(needle) || x.country.toLowerCase().includes(needle)) return true;
    return x.fauna.some((f) => s.discovered[f.genusId] && GENERA.get(f.genusId)?.name.toLowerCase().includes(needle)); // only animals you know — no spoilers
  };
  const unlocked = Object.keys(s.unlockedSites).length;
  const next = SITES.filter((x) => !s.unlockedSites[x.id]).sort((a, b) => (SITE_UNLOCK[a.id]?.level ?? 99) - (SITE_UNLOCK[b.id]?.level ?? 99))[0];
  const counts = { all: SITES.length, avail: SITES.filter((x) => s.unlockedSites[x.id]).length, ready: SITES.filter((x) => pinState(s, x.id) === 'ready').length, locked: SITES.filter((x) => pinState(s, x.id) === 'locked').length };
  return (
    <div className="panel sites-list">
      <div className="row" style={{ justifyContent: 'space-between' }}><b style={{ fontSize: 17 }}>Stanowiska</b><b style={{ color: 'var(--accent)' }}>{unlocked} / {SITES.length}</b></div>
      <div className="bar gold"><div style={{ width: `${(unlocked / SITES.length) * 100}%` }} /></div>
      {next && <span className="small muted">Następne: <b style={{ color: 'var(--text)' }}>{next.name}</b> · poziom {SITE_UNLOCK[next.id]?.level} · {fmt(SITE_UNLOCK[next.id]?.cost ?? 0)} monet</span>}
      <label className="search"><Search className="ic" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj stanowiska lub zwierzęcia" /></label>
      <div className="row" style={{ gap: 6 }}>
        {([['all', 'Wszystkie'], ['avail', 'Dostępne'], ['ready', 'Do odblokowania'], ['locked', 'Zablokowane']] as const).map(([id, label]) => (
          <Btn key={id} small on={filter === id} onClick={() => setFilter(id)}>{label} {counts[id]}</Btn>
        ))}
      </div>
      <div className="list">
        {REGIONS.map((reg) => {
          const list = SITES.filter((x) => regionOf(x) === reg && match(x)).sort((a, b) => (SITE_UNLOCK[a.id]?.level ?? 99) - (SITE_UNLOCK[b.id]?.level ?? 99));
          if (!list.length) return null;
          return (
            <div key={reg}>
              <div className="region lbl">{reg} <span className="spacer" />{list.length}</div>
              {list.map((x) => {
                const ps = pinState(s, x.id);
                const st = s.sites[x.id];
                return (
                  <button key={x.id} className={`site-row ${sel === x.id ? 'sel' : ''}`} onClick={() => pick(x.id)}>
                    <span className={`pin ${ps}`}><PinIcon st={ps} /></span>
                    <span className="t"><b>{x.name}</b><span>{x.period}{st ? ` · −${depthMeters(st.depth)} m` : ''}{ps === 'locked' ? ` · poziom ${SITE_UNLOCK[x.id]?.level}` : ps === 'ready' ? ' · gotowe do odblokowania' : ''}</span></span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SiteDrawer({ s, siteId, onClose, onDig }: { s: GameState; siteId: string; onClose: () => void; onDig: () => void }) {
  const act = useStore((x) => x.act);
  const openGenus = useStore((x) => x.openGenus);
  const site = SITE_BY_ID.get(siteId)!;
  const unlocked = !!s.unlockedSites[siteId];
  const can = canUnlockSite(s, siteId);
  const st = s.sites[siteId];
  const depth = st?.depth ?? 0;
  const discovered = site.fauna.filter((f) => s.discovered[f.genusId]).length;
  const hatched = site.fauna.filter((f) => s.hatched[f.genusId]).length;
  const strata = STRATA[siteId] ?? [];
  const at = stratumAt(siteId, depth);
  const lay = (n: number) => (n >= 99 ? 10 : n);
  const cycle = strata.reduce((a, r) => a + lay(r.layers), 0);
  const posInCycle = ((depth % cycle) + 0.5) / cycle;
  const minerals = siteMinerals(siteId);
  const minFound = minerals.filter((x) => s.minerals?.[x.id]).length;
  return (
    <div className="map-overlay map-drawer">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div className="col" style={{ gap: 2, flex: 1 }}>
          <h2>{site.name}</h2>
          <span className="small muted">{site.country} · {site.period} · {formatMa(site.fromMa)} – {formatMa(site.toMa)}</span>
        </div>
        <button className="iconbtn" aria-label="Zamknij" onClick={onClose}><X className="ic" /></button>
      </div>
      <div>
        <div className="era-bar">
          {[['#4d6152', 0.36], ['#4f7a4a', 0.46], ['#8a7448', 0.18]].map(([c, w]) => <i key={c as string} style={{ flex: w as number, background: c as string }} />)}
          <span className="era-marker" style={{ left: `${timePos(midMa(site)) * 100}%` }} />
        </div>
        <div className="era-labels"><span>Paleozoik</span><span>Mezozoik</span><span>Kenozoik</span></div>
      </div>
      <p className="small" style={{ margin: 0, lineHeight: 1.45 }}>{site.description}</p>
      <div className="fauna-strip">
        {site.fauna.slice(0, 20).map((f) => {
          const g = GENERA.get(f.genusId);
          if (!g) return null;
          const known = !!s.discovered[g.id] || s.settings.revealAll;
          return <span key={g.id} className={known ? 'clickable' : ''} onClick={() => known && openGenus(g.id)} title={known ? g.name : 'Nieodkryty'}><SpriteImg genusId={g.id} scale={1} silhouette={!s.hatched[g.id]} /></span>;
        })}
        {site.fauna.length > 20 && <span className="more">+{site.fauna.length - 20}</span>}
      </div>
      <div className="row small" style={{ justifyContent: 'space-between' }}><b>Fauna {discovered} / {site.fauna.length}</b><span className="muted">{hatched} w kolekcji</span></div>
      <div className="col" style={{ gap: 6 }}>
        <span className="lbl">Skały stanowiska</span>
        <div className="strata-bar">
          {strata.map((r) => <i key={r.name} style={{ flex: lay(r.layers), background: r.color }} title={`${r.name} · ${lay(r.layers)} warstw — ${r.desc}`} />)}
          {unlocked && <span className="mark" style={{ left: `${posInCycle * 100}%` }} title="Tu kopiesz" />}
          <span className="inf" title="Skały powtarzają się głębiej bez końca">∞</span>
        </div>
        <span className="small">{unlocked ? <>Tu kopiesz: <b>{at.s.name}</b> · −{depthMeters(depth)} m</> : <>Na wierzchu: <b>{strata[0]?.name}</b> · najedź na pasek, by zobaczyć resztę</>}</span>
      </div>
      {minerals.length > 0 && (
        <div className="col small" style={{ gap: 6 }}>
          <span className="lbl">Minerały stanowiska · {minFound}/{minerals.length}</span>
          <div className="row" style={{ gap: 2, flexWrap: 'wrap' }}>
            {minerals.map((m) => <img key={m.id} className="pixel" src={iconUrl('mineral', m.id, 1)} width={18} height={18} title={s.minerals?.[m.id] ? m.name : `Jeszcze nieznaleziony (od −${depthMeters(m.minDepth ?? 0)} m)`} style={s.minerals?.[m.id] ? undefined : { filter: 'brightness(0.3)' }} alt="" />)}
          </div>
        </div>
      )}
      {unlocked ? (
        s.activeSite === siteId
          ? <Btn kind="primary" big onClick={onDig}><Pickaxe className="ic" />Kop dalej · −{depthMeters(depth)} m</Btn>
          : <Btn kind="primary" big onClick={() => { act((g) => { g.activeSite = siteId; }); onDig(); }}><Pickaxe className="ic" />Kop tutaj{depth ? ` · −${depthMeters(depth)} m` : ''}</Btn>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          <Btn kind="gold" big onClick={() => act((g) => unlockSite(g, siteId))} disabled={!can.ok} why={can.why}><LockOpen className="ic" />Odblokuj · {fmt(can.cost)} monet</Btn>
          <span className="small muted" style={{ textAlign: 'center' }}>Wymaga poziomu parku {SITE_UNLOCK[siteId]?.level}{can.ok ? '' : ` · ${can.why}`}</span>
        </div>
      )}
      {unlocked && <span className="small muted" style={{ textAlign: 'center' }}><Check className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Ekipy pracują tam, gdzie kopiesz.</span>}
    </div>
  );
}

function Timeline({ s, sel, setSel, era, setEra }: { s: GameState; sel: string | null; setSel: (id: string) => void; era: number | null; setEra: (e: number | null) => void }) {
  const rows = useMemo(() => {
    const items = SITES.map((x) => ({ id: x.id, p: timePos(midMa(x)) })).sort((a, b) => a.p - b.p);
    const lastIn: number[] = [];
    return items.map((it) => {
      let r = 0;
      while (lastIn[r] !== undefined && it.p - lastIn[r] < 0.1) r++;
      lastIn[r] = it.p;
      return { ...it, row: r };
    });
  }, []);
  const maxRow = Math.max(...rows.map((r) => r.row));
  return (
    <div className="panel timeline-panel">
      <div className="row">
        <b style={{ fontSize: 16 }}>Oś czasu</b>
        <span className="small muted">kliknij epokę, żeby pokazać tylko jej stanowiska</span>
        <span className="spacer" />
        {era !== null && <Btn small onClick={() => setEra(null)}>Pokaż wszystkie</Btn>}
      </div>
      <div className="timeline" style={{ marginTop: 30 + maxRow * 20 }}>
        {ERAS.map((e, i) => (
          <button key={e.name} className={`era ${era === i ? 'on' : era !== null ? 'off' : ''}`} style={{ flex: e.w, background: e.color }} onClick={() => setEra(era === i ? null : i)}>
            {e.name}<small>{e.from}–{e.to || 'dziś'} mln lat</small>
          </button>
        ))}
        {rows.map(({ id, p, row }) => {
          const x = SITE_BY_ID.get(id)!;
          const ps = pinState(s, id);
          const col = ps === 'active' ? '#eaa63a' : ps === 'open' ? '#8bb04f' : ps === 'ready' ? '#f6d38d' : '#6f6754';
          return (
            <button key={id} className={`tsite ${ps === 'active' ? 'active' : ''} ${sel === id ? 'sel' : ''}`} style={{ left: `${Math.min(97, Math.max(3, p * 100))}%` }} onClick={() => setSel(id)} title={`${x.name} · ${formatMa(x.fromMa)} – ${formatMa(x.toMa)}`}>
              <span className="tl">{shortName(x)}</span><i style={{ background: col }} /><span className="stem" style={{ height: row * 20 + 2 }} />
            </button>
          );
        })}
      </div>
      <div className="timeline-axis"><span>541 mln lat temu</span><span>252</span><span>201</span><span>145</span><span>66</span><span>dziś</span></div>
    </div>
  );
}

// Procedural pixel art for the dig field: rock tiles (16×16 px per tile) cut from the real rock layers
// of each site, cracks, bones / shells / amber / minerals hidden in the rock, and the per-frame
// renderer with soft tile lighting. Everything is drawn in base pixels and scaled up by CSS.

import { B } from '../../game/balance';
import { type Grain, MINERAL_BY_ID, STRATA, type Stratum, stratumAt } from '../../game/geology';
import type { ItemKind, LayerItem, SiteState } from '../../game/state';

export const TS = 16;
export const GW = B.gridW * TS;
export const GH = B.gridH * TS;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const SHADE = [0.74, 0.87, 1, 1.12];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- item palettes
interface Pal { outline: RGB; shadow: RGB; base: RGB; light: RGB; hi: RGB; pore: RGB; hole: RGB }
const pal = (o: Record<keyof Pal, string>): Pal => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hex(v)])) as unknown as Pal;
const BONE = pal({ outline: '#3a2817', shadow: '#8a6741', base: '#bb976b', light: '#d6b585', hi: '#f2e2ba', pore: '#9c7a52', hole: '#2a1d12' });
const SHELL = pal({ outline: '#2c2d31', shadow: '#7f7b70', base: '#b7b09e', light: '#d3cdb9', hi: '#efe9d6', pore: '#9a9483', hole: '#55504a' });
const AMBER = pal({ outline: '#6a3206', shadow: '#c8701a', base: '#ec9c2c', light: '#f8c058', hi: '#ffe7a0', pore: '#d8841c', hole: '#3e2410' });
/** palette derived from one mineral colour */
function palOf(h: string): Pal {
  const c = hex(h), w: RGB = [255, 255, 255];
  return { outline: mul(c, 0.32), shadow: mul(c, 0.66), base: c, light: mix(c, w, 0.28), hi: mix(c, w, 0.62), pore: mul(c, 0.86), hole: mul(c, 0.42) };
}
const IRIDESCENT: RGB[] = ['#8ff0d8', '#f29ad8', '#9ec0ff', '#fff09a', '#b6ff9a'].map(hex);

/** rarity glow ladder colours (common → legendary) */
export const GLOW_CSS = ['#d7c08e', '#58b0ff', '#c58cff', '#ffcf4a'];
export const GLOW: RGB[] = GLOW_CSS.map(hex);

// ---------------------------------------------------------------- shapes
type Pt = [number, number];
type Fn = (x: number, y: number) => boolean;
interface Shape {
  inside: Fn;
  hole?: Fn;
  /** 0 = normal shading, 1 = light band, 2 = highlight (facets, agate bands…) */
  band?: (x: number, y: number) => number;
  iridescent?: boolean;
}

/** a tube along a quadratic Bézier with a varying radius */
function tube(p0: Pt, c: Pt, p1: Pt, r: (t: number) => number, steps = 48): Fn {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1], r(t)]);
  }
  return (x, y) => pts.some(([px, py, pr]) => (x - px) ** 2 + (y - py) ** 2 <= pr * pr);
}
const disc = (cx: number, cy: number, r: number): Fn => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ell = (cx: number, cy: number, rx: number, ry: number): Fn => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const any = (...fs: Fn[]): Fn => (x, y) => fs.some((f) => f(x, y));

const cc = (c: Pt): Pt => [(c[0] + 0.5) * TS, (c[1] + 0.5) * TS];
const nb = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
/** push p away from q by d pixels */
const ext = (p: Pt, q: Pt, d: number): Pt => {
  const dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1;
  return [p[0] + (dx / l) * d, p[1] + (dy / l) * d];
};

function fossilShape(cells: Pt[], r: () => number): Shape {
  const n = cells.length;
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
  const deg = cells.map((c) => cells.filter((d) => nb(c, d)).length);
  const ends = cells.filter((_, i) => deg[i] === 1);

  if (n === 2) {
    // claw / tooth: thick base tapering to a hooked point
    const [a, b] = r() < 0.5 ? [cells[0], cells[1]] : [cells[1], cells[0]];
    const A = cc(a), Bp = cc(b);
    const s = ext(A, Bp, 4), e = ext(Bp, A, 5);
    const perp: Pt = [-(e[1] - s[1]), e[0] - s[0]];
    const pl = Math.hypot(perp[0], perp[1]) || 1, side = r() < 0.5 ? -1 : 1;
    const ctrl: Pt = [(s[0] + e[0]) / 2 + (perp[0] / pl) * 6 * side, (s[1] + e[1]) / 2 + (perp[1] / pl) * 6 * side];
    return { inside: tube(s, ctrl, e, (t) => 4.8 * (1 - t) + 0.7 * t) };
  }
  if (bw === 1 || bh === 1) {
    // long bone (femur-like): slim shaft, wide knobbly ends
    const [a, b] = ends.length === 2 ? ends : [cells[0], cells[n - 1]];
    const s = ext(cc(a), cc(b), 3.5), e = ext(cc(b), cc(a), 3.5);
    const shaft = tube(s, [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2 + (r() - 0.5) * 2], e, (t) => 2.3 + 2.2 * Math.pow(Math.abs(2 * t - 1), 5));
    const vx = e[0] - s[0], vy = e[1] - s[1], l = Math.hypot(vx, vy);
    const px = -vy / l, py = vx / l;
    const knob = (p: Pt, k: number) => any(disc(p[0] + px * 2.4 * k, p[1] + py * 2.4 * k, 3.1), disc(p[0] - px * 2.4 * k, p[1] - py * 2.4 * k, 2.6));
    return { inside: any(shaft, knob(s, 1), knob(e, -1)) };
  }
  if (n === 4 && bw === 2 && bh === 2) {
    // skull in a 2×2 block, facing left or right
    const ox = Math.min(...xs) * TS, oy = Math.min(...ys) * TS;
    const flip = r() < 0.5;
    const L = (fx: number) => (flip ? 32 - fx : fx);
    const f = (g: Fn): Fn => (x, y) => g(L(x - ox), y - oy);
    const head = any(ell(11, 14, 9.5, 9), ell(21, 17, 10, 5.4), ell(18, 23.5, 10.5, 2.6), ell(7, 20, 4, 5));
    const teeth: Fn = (x, y) => y > 21 && y < 23 && x > 14 && x < 30 && Math.floor(x) % 2 === 0;
    const holes = any(disc(11.5, 12, 3.3), ell(20.5, 15.5, 2.8, 1.8), disc(27.5, 16, 1.2), ell(7, 17, 1.4, 2.4));
    return { inside: f(any(head, teeth)), hole: f(holes) };
  }
  const hub = cells.find((_, i) => deg[i] === 3);
  if (hub) {
    // vertebra: transverse processes along the bar, round centrum at the hub, spine down the stem
    const stem = cells.find((c) => nb(c, hub) && cells.filter((d) => nb(d, hub) && d !== c).every((d) => (d[0] - hub[0]) * (c[0] - hub[0]) + (d[1] - hub[1]) * (c[1] - hub[1]) === 0))!;
    const bar = cells.filter((c) => c !== stem && c !== hub);
    const H = cc(hub), S = cc(stem);
    const b0 = ext(cc(bar[0]), H, 3), b1 = ext(cc(bar[1]), H, 3);
    const dir: Pt = [(S[0] - H[0]) / TS, (S[1] - H[1]) / TS];
    const cen: Pt = [H[0] + dir[0] * 3, H[1] + dir[1] * 3];
    const tip = ext(S, H, 3);
    return {
      inside: any(tube(b0, H, b1, (t) => 1.3 + 1.2 * Math.sin(Math.PI * t)), disc(cen[0], cen[1], 5.6), tube(cen, [(cen[0] + tip[0]) / 2, (cen[1] + tip[1]) / 2], tip, (t) => 2.6 - 1.2 * t)),
      hole: disc(H[0] - dir[0] * 1.5, H[1] - dir[1] * 1.5, 1.6),
    };
  }
  // rib: an arc along an L of cells, thick head → thin tip, with a small knob at the head
  const [a, b] = ends.length === 2 ? (r() < 0.5 ? ends : [ends[1], ends[0]]) : [cells[0], cells[n - 1]];
  const corner = cells.find((c, i) => {
    if (deg[i] !== 2) return false;
    const [n1, n2] = cells.filter((d) => nb(c, d));
    return n1[0] !== n2[0] && n1[1] !== n2[1]; // the bend of the L
  }) ?? cells[1];
  const A = cc(a), Bp = cc(b), C = cc(corner);
  const s = ext(A, C, 4), e = ext(Bp, C, 4);
  const ctrl: Pt = [C[0] + (C[0] - (s[0] + e[0]) / 2) * 0.35, C[1] + (C[1] - (s[1] + e[1]) / 2) * 0.35];
  return { inside: any(tube(s, ctrl, e, (t) => 3.1 - 1.7 * t), disc(s[0], s[1], 3.4)) };
}

function minorShape(cell: Pt, r: () => number): Shape {
  const [cx, cy] = cc(cell);
  const k = r();
  if (k < 0.55) {
    // ammonite-like coiled shell with a spiral groove
    const rot = r() * Math.PI * 2;
    return {
      inside: disc(cx, cy, 5.6),
      hole: (x, y) => {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        if (d > 5) return false;
        const a = (Math.atan2(dy, dx) + rot + Math.PI * 4) % (Math.PI * 2);
        for (let turn = 0; turn < 3; turn++) if (Math.abs(d - (0.6 + (a + turn * Math.PI * 2) * 0.32)) < 0.45) return true;
        return false;
      },
    };
  }
  if (k < 0.85) {
    // clam: fan with ribs
    return { inside: any(ell(cx, cy + 0.5, 5.6, 4.4), ell(cx, cy - 4, 1.8, 1.6)), band: (x, y) => (y > cy - 2 && Math.floor(x - cx + 9.5) % 3 === 0 ? -1 : 0) };
  }
  // snail: small spire
  return { inside: any(ell(cx - 0.5, cy + 1, 4.6, 3.8), ell(cx + 2.5, cy - 2.5, 2.4, 2.2), disc(cx + 4.3, cy - 4.6, 1.2)), hole: disc(cx - 1, cy + 1.5, 1.3) };
}

function amberShape(cell: Pt): Shape {
  const [cx, cy] = cc(cell);
  // a rounded drop of resin with a tiny insect inside
  const bug: Fn = (x, y) =>
    ell(cx + 0.5, cy + 1, 1.6, 0.9)(x, y) || disc(cx - 1.5, cy + 0.5, 0.8)(x, y) ||
    (Math.abs(y - (cy + 2.2)) < 0.5 && [cx - 0.5, cx + 1.5].some((lx) => Math.abs(x - lx) < 0.5)) ||
    (Math.abs(y - (cy - 0.2)) < 0.5 && [cx - 0.5, cx + 1.5].some((lx) => Math.abs(x - lx) < 0.5));
  return { inside: any(ell(cx, cy + 0.5, 5.8, 4.9), ell(cx - 1.2, cy - 2.6, 3.6, 2.8)), hole: bug };
}

/** a pointed crystal prism growing from (bx, by) at angle a */
function prism(bx: number, by: number, a: number, len: number, w: number): { inside: Fn; ridge: Fn } {
  const ux = Math.cos(a), uy = Math.sin(a);
  const loc = (x: number, y: number) => { const dx = x - bx, dy = y - by; return [dx * ux + dy * uy, -dx * uy + dy * ux]; };
  return {
    inside: (x, y) => { const [u, v] = loc(x, y); return u >= -1 && u <= len && Math.abs(v) <= w / 2 && Math.abs(v) <= (len - u) * 0.95; },
    ridge: (x, y) => { const [u, v] = loc(x, y); return Math.abs(v) < 0.6 && u < len - 1; },
  };
}

function mineralShape(cell: Pt, id: string, r: () => number): Shape {
  const [cx, cy] = cc(cell);
  const form = MINERAL_BY_ID.get(id)?.form ?? 'crystal';
  if (form === 'crystal') {
    const ps = [prism(cx, cy + 4, -Math.PI / 2 + (r() - 0.5) * 0.2, 10, 4.2), prism(cx - 2, cy + 4.5, -Math.PI * 0.68, 7, 3.2), prism(cx + 2.2, cy + 4.5, -Math.PI * 0.33, 6.5, 3.2)];
    const base = ell(cx, cy + 4.6, 5.6, 2.2);
    return { inside: any(base, ...ps.map((p) => p.inside)), band: (x, y) => (ps.some((p) => p.ridge(x, y)) ? 2 : base(x, y) && !ps.some((p) => p.inside(x, y)) ? -1 : 0) };
  }
  if (form === 'cube') {
    const sq = (x0: number, y0: number, h: number): Fn => (x, y) => Math.abs(x - x0) <= h && Math.abs(y - y0) <= h;
    // two pyrite cubes: lit top face, striated sides
    const a = sq(cx - 2.2, cy + 1, 3.8), b = sq(cx + 3.6, cy + 2.4, 2.4);
    return { inside: any(a, b), band: (x, y) => (a(x, y) ? (y < cy - 1.5 ? 2 : Math.floor(x) % 3 === 0 ? 1 : 0) : y < cy + 1 ? 2 : 0) };
  }
  if (form === 'nodule' || form === 'opal') {
    const ox = cx + (r() - 0.5), oy = cy + 0.5;
    return {
      inside: ell(ox, oy, 5.6, 4.6),
      band: form === 'opal' ? undefined : (x, y) => (Math.floor(Math.hypot((x - ox) / 1.15, y - oy) / 1.3) % 2 ? 1 : 0),
      iridescent: form === 'opal',
    };
  }
  if (form === 'nugget') return { inside: any(disc(cx - 1.5, cy + 1, 3.6), disc(cx + 2, cy + 0.5, 3), disc(cx + 0.5, cy - 2, 2.6)) };
  // dendrite: black fern-like branches on a small limestone plate
  const branch = new Set<string>();
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    for (let k = 0; k < len; k++) {
      x += Math.cos(a); y += Math.sin(a);
      a += (r() - 0.5) * 0.5;
      branch.add(`${Math.floor(x)},${Math.floor(y)}`);
      if (depth < 2 && r() < 0.28) grow(x, y, a + (r() < 0.5 ? -0.8 : 0.8), len - k - 1, depth + 1);
    }
  };
  grow(cx - 1, cy + 5, -Math.PI / 2 - 0.3, 9, 0);
  grow(cx + 2, cy + 5, -Math.PI / 2 + 0.5, 7, 0);
  return { inside: ell(cx, cy, 6.6, 5.8), hole: (x, y) => branch.has(`${Math.floor(x)},${Math.floor(y)}`) };
}

function shapeOf(it: LayerItem, cells: Pt[], r: () => number): { shape: Shape; P: Pal } {
  if (it.kind === 'fossil') return { shape: fossilShape(cells, r), P: BONE };
  if (it.kind === 'minor') return { shape: minorShape(cells[0], r), P: SHELL };
  if (it.kind === 'amber') return { shape: amberShape(cells[0]), P: AMBER };
  const m = MINERAL_BY_ID.get(it.mineralId ?? '');
  const shape = mineralShape(cells[0], it.mineralId ?? '', r);
  if (m?.form === 'dendrite') return { shape, P: { ...palOf('#d9cba6'), hole: hex(m.color) } };
  return { shape, P: palOf(m?.color ?? '#e6ebf0') };
}

// ---------------------------------------------------------------- rock
/** shade level 0..3 of one pixel for a grain type */
function grainShade(g: Grain, gx: number, gy: number, row: number[], r: () => number): number {
  const q = r();
  switch (g) {
    case 'sand': return q < 0.16 ? 1 : q < 0.28 ? 3 : q < 0.33 ? 0 : 2;
    case 'mud': return q < 0.07 ? row[gy] - 1 : q < 0.12 ? row[gy] + 1 : row[gy];
    case 'shale': return gy % 6 === 5 && q < 0.75 ? 0 : gy % 3 === 0 ? 1 : q < 0.06 ? 3 : 2;
    case 'lime': return gy % 6 === 0 && q < 0.85 ? 1 : q < 0.05 ? 3 : q < 0.1 ? 1 : row[gy] >= 2 ? 2 : 3;
    case 'chalk': return q < 0.012 ? 0 : q < 0.07 ? 3 : 2;
    case 'coal': return q < 0.07 ? 3 : q < 0.18 ? 0 : 1;
    case 'tuff': return q < 0.08 ? 3 : q < 0.24 ? 1 : 2;
    case 'loess': return gx % 7 === 3 && q < 0.22 ? 1 : q < 0.08 ? 1 : q < 0.12 ? 3 : 2;
  }
}

export interface LayerArt {
  rock: Float32Array; // RGB per pixel
  back: Float32Array; // dug-out "back wall"
  crack: Uint8Array; // 0 none, 1..3 = damage stage at which the pixel is a crack
  owner: Int16Array; // item index or -1
  hole: Uint8Array; // cavity inside an item (skull openings, shell grooves)
  edge: Uint8Array; // item outline pixel
  col: Float32Array; // item colour
  tileCss: string[]; // representative rock colour of each tile (rock chips)
  tileRock: string[]; // name of the rock of each tile
  glint: [number, number][]; // per item: a pixel that glints through the rock (amber / minerals)
  urls: Map<number, string>;
}

const cache = new WeakMap<LayerItem[], LayerArt>();

export function artFor(siteId: string, st: SiteState): LayerArt {
  let a = cache.get(st.items);
  if (!a) {
    a = buildArt(siteId, st);
    cache.set(st.items, a);
  }
  return a;
}
export const cachedArt = (items: LayerItem[]) => cache.get(items);

/** deeper = darker and a touch cooler */
function tone(c: RGB, depth: number): RGB {
  const dark = 1 - Math.min(0.36, depth * 0.012);
  const g = (c[0] + c[1] + c[2]) / 3;
  const out = mul(mix(c, [g * 0.94, g * 0.97, g * 1.06], Math.min(0.25, depth * 0.008)), dark);
  // never so dark that the grain disappears (Messel oil shale, Burgess)
  const l = 0.3 * out[0] + 0.59 * out[1] + 0.11 * out[2];
  return l < 62 ? mul(out, 62 / Math.max(1, l)) : out;
}

// ---------------------------------------------------------------- rock features (picked per layer)
// Every layer gets its own mix: lenses of other rock, rusty stains, calcite veins, pebbles, concretions,
// shell hash, burrows and root traces, cross-bedding, manganese dendrites, ash partings.

type FeatureKind = 'lens' | 'stain' | 'vein' | 'pebbles' | 'nodule' | 'shells' | 'burrows' | 'xbed' | 'dendrite' | 'ash';
const FEATURE_NAMES: Record<FeatureKind, string> = {
  lens: 'soczewka', stain: 'rdzawa plama limonitu', vein: 'żyła kalcytu', pebbles: 'otoczaki', nodule: 'konkrecja',
  shells: 'okruchy muszli', burrows: 'ślady norek', xbed: 'warstwowanie przekątne', dendrite: 'dendryty manganowe', ash: 'wkładka popiołu',
};
const LENS_NAME: Record<Grain, string> = { sand: 'piaskowca', mud: 'iłowca', shale: 'łupku', lime: 'wapienia', chalk: 'kredy', coal: 'węgla', tuff: 'tufu', loess: 'lessu' };
/** which features suit which rock (relative odds) */
const FEATURE_ODDS: Record<Grain, Partial<Record<FeatureKind, number>>> = {
  sand: { lens: 1, stain: 1.2, pebbles: 1.4, xbed: 1.6, burrows: 0.6, nodule: 0.4, vein: 0.3 },
  mud: { lens: 1, stain: 1.3, nodule: 1.1, burrows: 1.2, pebbles: 0.4, vein: 0.6, ash: 0.4 },
  shale: { lens: 0.6, nodule: 1.5, vein: 0.8, shells: 0.7, stain: 0.5, ash: 0.5 },
  lime: { vein: 1.5, shells: 1.4, dendrite: 1.1, nodule: 0.6, stain: 0.6, lens: 0.5 },
  chalk: { shells: 1.4, nodule: 1.2, stain: 1, burrows: 0.8, vein: 0.4 },
  coal: { vein: 0.8, nodule: 0.6, lens: 0.8 },
  tuff: { ash: 1.5, lens: 1, vein: 0.8, pebbles: 0.6, stain: 0.6 },
  loess: { burrows: 1.5, stain: 1, nodule: 1, pebbles: 0.6, lens: 0.5 },
};
interface Feature { kind: FeatureKind; x: number; y: number; a: number; b: number; rot: number; c: RGB; grain?: Grain; seed: number; label: string }

function pickFeatures(s: Stratum, others: Stratum[], r: () => number): Feature[] {
  const odds = FEATURE_ODDS[s.grain];
  const kinds = Object.entries(odds) as [FeatureKind, number][];
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  const n = 2 + Math.floor(r() * 2.6); // 2–4 kinds per layer
  const out: Feature[] = [];
  const chosen = new Set<FeatureKind>();
  for (let k = 0; k < n; k++) {
    let q = r() * total, kind = kinds[0][0];
    for (const [id, w] of kinds) { q -= w; if (q <= 0) { kind = id; break; } }
    if (chosen.has(kind)) continue;
    chosen.add(kind);
    const count = kind === 'lens' ? 1 + Math.floor(r() * 2) : kind === 'stain' ? 2 + Math.floor(r() * 3) : kind === 'vein' ? 1 + Math.floor(r() * 3)
      : kind === 'pebbles' ? 2 + Math.floor(r() * 3) : kind === 'nodule' ? 2 + Math.floor(r() * 4) : kind === 'shells' ? 3 : kind === 'burrows' ? 5 + Math.floor(r() * 6)
      : kind === 'dendrite' ? 2 + Math.floor(r() * 3) : 1;
    for (let i = 0; i < count; i++) {
      const other = others.length ? others[Math.floor(r() * others.length)] : s;
      const lensRock = other !== s ? other : s;
      const lensCol: RGB = other !== s ? hex(other.color) : mul(hex(s.color), r() < 0.5 ? 1.2 : 0.78);
      const c: RGB = kind === 'lens' ? lensCol : kind === 'stain' ? (r() < 0.6 ? [168, 98, 48] : [140, 70, 40]) : kind === 'vein' ? [236, 230, 212]
        : kind === 'pebbles' ? [150 + r() * 60, 140 + r() * 50, 120 + r() * 40] : kind === 'nodule' ? mul(hex(s.accent ?? s.color), 0.72) : kind === 'shells' ? [232, 222, 196]
        : kind === 'burrows' ? mul(hex(s.color), 0.82) : kind === 'xbed' ? mul(hex(s.color), 0.86) : kind === 'dendrite' ? [78, 64, 52] : [222, 216, 200];
      out.push({
        kind, seed: r(), c,
        x: r() * GW, y: kind === 'ash' ? 10 + r() * (GH - 20) : r() * GH,
        a: kind === 'lens' ? 18 + r() * 30 : kind === 'stain' ? 6 + r() * 12 : kind === 'pebbles' ? 10 + r() * 14 : kind === 'nodule' ? 2.5 + r() * 3.5 : kind === 'dendrite' ? 4 + r() * 5 : 0,
        b: kind === 'lens' ? 4 + r() * 7 : kind === 'stain' ? 4 + r() * 8 : kind === 'pebbles' ? 5 + r() * 8 : 0,
        rot: (r() - 0.5) * (kind === 'vein' ? 2.4 : 0.5),
        grain: kind === 'lens' ? lensRock.grain : undefined,
        label: kind === 'lens' ? `soczewka ${LENS_NAME[lensRock.grain]}` : FEATURE_NAMES[kind],
      });
    }
  }
  return out;
}

const LENS_ROW = Array.from({ length: GH }, (_, i) => (i % 3 === 2 ? 1 : 2));

function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + Math.floor(s * 1e6), 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** colour + shade of a feature at a pixel, or null when the pixel is plain rock */
function featureAt(fs: Feature[], gx: number, gy: number, base: RGB, sh: number, r: () => number): { c: RGB; sh: number; f: Feature } | null {
  let hit: { c: RGB; sh: number; f: Feature } | null = null;
  for (const f of fs) {
    const dx = gx - f.x, dy = gy - f.y;
    const cs = Math.cos(f.rot), sn = Math.sin(f.rot);
    const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    switch (f.kind) {
      case 'lens': {
        const wob = Math.sin(u / 5 + f.seed * 9) * 1.2;
        if ((u / f.a) ** 2 + ((v - wob) / f.b) ** 2 <= 1) hit = { c: f.c, sh: grainShade(f.grain!, gx, gy, LENS_ROW, r), f };
        break;
      }
      case 'stain': {
        const d = (u / f.a) ** 2 + (v / f.b) ** 2 + (hash2(gx, gy, f.seed) - 0.5) * 0.5;
        if (d <= 1) hit = { c: mix(base, f.c, Math.min(0.75, (1 - d) * 1.1)), sh, f };
        break;
      }
      case 'vein': {
        const off = Math.sin(u / 6 + f.seed * 20) * 1.4 + Math.sin(u / 2.3) * 0.5;
        if (Math.abs(v - off) < 0.7 && Math.abs(u) < 60) hit = { c: f.c, sh: hash2(gx, gy, f.seed) < 0.3 ? 3 : 2, f };
        break;
      }
      case 'pebbles': {
        if ((u / f.a) ** 2 + (v / f.b) ** 2 > 1) break;
        // a cluster of 2–4 px rounded clasts
        const cx = Math.floor(gx / 4), cy = Math.floor(gy / 3);
        const q = hash2(cx, cy, f.seed);
        if (q < 0.45) {
          const px = cx * 4 + 1 + Math.floor(q * 4) % 2, py = cy * 3 + 1;
          const ddx = gx - px, ddy = gy - py;
          if (ddx >= -1 && ddx <= 1 && ddy >= -1 && ddy <= 0 && !(Math.abs(ddx) === 1 && ddy === -1)) {
            const tint = 0.85 + hash2(cx, cy, f.seed + 1) * 0.35;
            hit = { c: mul(f.c, tint), sh: ddy === -1 || ddx === -1 ? 3 : ddx === 1 ? 1 : 2, f };
          }
        }
        break;
      }
      case 'nodule': {
        const d = Math.sqrt(u * u + (v * 1.3) ** 2);
        if (d <= f.a) hit = { c: d > f.a - 1 ? mul(f.c, 0.75) : Math.abs(d - f.a * 0.55) < 0.5 ? mul(f.c, 1.25) : f.c, sh: dy < -f.a * 0.3 ? 3 : dy > f.a * 0.4 ? 1 : 2, f };
        break;
      }
      case 'shells': {
        const q = hash2(gx, gy, f.seed);
        if (q < 0.012) hit = { c: f.c, sh: 3, f };
        else if (q < 0.02 && hash2(gx - 1, gy, f.seed) < 0.012) hit = { c: mul(f.c, 0.85), sh: 2, f };
        break;
      }
      case 'burrows': {
        const wig = Math.sin(dy / 2.2 + f.seed * 30) * 1.1;
        if (Math.abs(dx - wig) < 0.8 && dy > 0 && dy < 9 + f.seed * 10) hit = { c: f.c, sh: 1, f };
        break;
      }
      case 'xbed': {
        // inclined laminae inside wavy sets
        const set = Math.floor((gy + Math.sin(gx / 13 + f.seed * 9) * 2) / 9);
        const t = (gx * 0.55 + gy * (set % 2 ? 1 : -1) + set * 7) % 5;
        if (t < 0.9) hit = { c: mix(base, f.c, 0.6), sh: Math.max(0, sh - 1), f };
        break;
      }
      case 'dendrite': {
        const d = Math.hypot(dx, dy);
        if (d < f.a && dy >= -1) {
          const ang = Math.atan2(dy, dx);
          const branch = Math.abs(Math.sin(ang * 5 + f.seed * 10)) < 0.25 + (1 - d / f.a) * 0.4;
          if (branch && hash2(gx, gy, f.seed) < 0.75) hit = { c: f.c, sh: 1, f };
        }
        break;
      }
      case 'ash': {
        const yy = f.y + Math.sin(gx / 10 + f.seed * 7) * 1.5;
        if (gy >= yy && gy < yy + 2) hit = { c: f.c, sh: hash2(gx, gy, f.seed) < 0.3 ? 3 : 2, f };
        break;
      }
    }
  }
  return hit;
}

function buildArt(siteId: string, st: SiteState): LayerArt {
  const N = GW * GH;
  const r = mulberry(hashStr(`${siteId}:${st.depth}:${st.layersDone}`));
  const at = stratumAt(siteId, st.depth);
  // the last layer of a rock already shows the next rock along a wavy line near the bottom
  const boundary = at.left === 1 && at.next !== at.s;
  const bPhase = r() * 10, bY = GH - 22 - Math.floor(r() * 10);
  const isNext = (gx: number, gy: number) => boundary && gy > bY + Math.round(Math.sin(gx / 11 + bPhase) * 3 + Math.sin(gx / 4.3) * 1);
  const kinds = new Map<Stratum, { base: RGB; accent: RGB; seam: RGB; row: number[]; blobs: [number, number, number, number][]; seams: [number, number, number][]; feats: Feature[] }>();
  const siteRocks = STRATA[siteId] ?? [];
  // every layer is a little warmer or cooler than the last one
  const hue: RGB = [1 + (r() - 0.5) * 0.08, 1 + (r() - 0.5) * 0.05, 1 + (r() - 0.5) * 0.08];
  for (const s of boundary ? [at.s, at.next] : [at.s]) {
    const b0 = tone(hex(s.color), st.depth + (s === at.next ? 1 : 0));
    const base: RGB = [b0[0] * hue[0], b0[1] * hue[1], b0[2] * hue[2]];
    const feats = pickFeatures(s, siteRocks.filter((x) => x.name !== s.name.replace(/ [IVX]+$/, '')), r);
    const row = Array.from({ length: GH }, () => (r() < 0.72 ? 2 : 1));
    const blobs: [number, number, number, number][] = [];
    if (s.accent) for (let k = 0, n = 5 + Math.floor(r() * 6); k < n; k++) blobs.push([r() * GW, r() * GH, 1.4 + r() * (s.grain === 'shale' ? 3.5 : 2.4), s.grain === 'shale' ? 0.55 : 0.85]);
    const seams: [number, number, number][] = [];
    if (s.seam) for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) seams.push([8 + r() * (GH - 16), 1 + Math.floor(r() * 2.6), r() * 10]);
    feats.forEach((f) => { f.c = tone(f.c, f.kind === 'lens' ? st.depth : st.depth * 0.5); });
    kinds.set(s, { base, accent: tone(hex(s.accent ?? s.color), st.depth), seam: tone(hex(s.seam ?? s.color), st.depth), row, blobs, seams, feats });
  }

  const rock = new Float32Array(N * 3), back = new Float32Array(N * 3);
  const crack = new Uint8Array(N);
  const tileCss: string[] = [];
  const tileRock: string[] = [];
  const tileFeat: string[] = [];
  const set = (arr: Float32Array, p: number, c: RGB) => { arr[p * 3] = c[0]; arr[p * 3 + 1] = c[1]; arr[p * 3 + 2] = c[2]; };
  const tint = Array.from({ length: B.gridW * B.gridH }, () => 0.96 + r() * 0.08);

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const s = isNext(gx, gy) ? at.next : at.s;
      const K = kinds.get(s)!;
      const x = gx % TS, y = gy % TS;
      const ti = ((gy / TS) | 0) * B.gridW + ((gx / TS) | 0);
      let c = K.base;
      let sh = Math.max(0, Math.min(3, grainShade(s.grain, gx, gy, K.row, r)));
      for (const [y0, th, ph] of K.seams) {
        const yy = y0 + Math.sin(gx / 9 + ph) * 1.6;
        if (gy >= yy && gy < yy + th) { c = K.seam; sh = r() < 0.2 ? 1 : 2; }
      }
      for (const [bx, by, br, sq] of K.blobs) {
        if (((gx - bx) / br) ** 2 + ((gy - by) / (br * sq)) ** 2 <= 1) { c = K.accent; sh = r() < 0.25 ? 1 : 2; }
      }
      const ft = featureAt(K.feats, gx, gy, c, sh, r);
      if (ft) { c = ft.c; sh = Math.max(0, Math.min(3, ft.sh)); }
      if (x === 8 && y === 8) tileFeat.push(ft && ft.f.kind !== 'xbed' ? ft.f.label : '');
      const pc = mul(c, SHADE[sh] * tint[ti] * (1 - (gy / GH) * 0.06));
      // tile edges: soft light top/left, shadow bottom/right — tiles read as separate blocks
      const bevel = y === 0 ? 1.1 : x === 0 ? 1.06 : y === TS - 1 ? 0.76 : x === TS - 1 ? 0.82 : 1;
      const p = gy * GW + gx;
      set(rock, p, mul(pc, bevel));
      set(back, p, mul(pc, 0.56 * (y < 3 ? 0.72 : 1) * (x < 2 ? 0.84 : 1)));
      if (x === 8 && y === 8) { tileCss.push(css(pc)); tileRock.push(tileFeat[tileFeat.length - 1] ? `${s.name} · ${tileFeat[tileFeat.length - 1]}` : s.name); }
    }
  }

  // cracks: 1 / 3 / 5 jagged lines from near the centre, plus a chipped corner at stage 3
  for (let ti = 0; ti < B.gridW * B.gridH; ti++) {
    const tx = ti % B.gridW, ty = (ti / B.gridW) | 0;
    for (let stage = 1; stage <= 3; stage++) {
      for (let l = 0; l < (stage === 1 ? 1 : 2); l++) {
        let x = 6 + r() * 4, y = 6 + r() * 4;
        let ang = r() * Math.PI * 2;
        const len = 4 + r() * 3 + stage * 2;
        for (let k = 0; k < len; k++) {
          ang += (r() - 0.5) * 0.9;
          x += Math.cos(ang);
          y += Math.sin(ang);
          const ix = Math.round(x), iy = Math.round(y);
          if (ix < 1 || iy < 1 || ix > TS - 2 || iy > TS - 2) break;
          const p = (ty * TS + iy) * GW + tx * TS + ix;
          if (!crack[p]) crack[p] = stage;
        }
      }
    }
    const corner = Math.floor(r() * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4 - y; x++) {
      const lx = corner & 1 ? TS - 1 - x : x, ly = corner & 2 ? TS - 1 - y : y;
      const p = (ty * TS + ly) * GW + tx * TS + lx;
      if (!crack[p]) crack[p] = 3;
    }
  }

  // items hidden in the rock
  const owner = new Int16Array(N).fill(-1);
  const hole = new Uint8Array(N), edge = new Uint8Array(N);
  const col = new Float32Array(N * 3);
  const glint: [number, number][] = [];
  st.items.forEach((it, idx) => {
    const cells: Pt[] = it.cells.map((i) => [i % B.gridW, Math.floor(i / B.gridW)]);
    const { shape, P } = shapeOf(it, cells, r);
    const mine = rasterise(shape, cells, (p) => { owner[p] = idx; }, (p) => { hole[p] = 1; });
    shade(mine, shape, P, r, (p) => owner[p] === idx && !hole[p], (p, c, e) => { set(col, p, c); if (e) edge[p] = 1; }, hole);
    glint.push([cells[0][0] * TS + 4 + Math.floor(r() * 8), cells[0][1] * TS + 4 + Math.floor(r() * 7)]);
  });
  return { rock, back, crack, owner, hole, edge, col, tileCss, tileRock, glint, urls: new Map() };
}

function rasterise(shape: Shape, cells: Pt[], own: (p: number) => void, isHole: (p: number) => void, W = GW): number[] {
  const mine: number[] = [];
  for (const [cx, cy] of cells) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const gx = cx * TS + x, gy = cy * TS + y, px = gx + 0.5, py = gy + 0.5;
      if (!shape.inside(px, py)) continue;
      const p = gy * W + gx;
      own(p);
      if (shape.hole?.(px, py)) isHole(p);
      mine.push(p);
    }
  }
  return mine;
}

function shade(mine: number[], shape: Shape, P: Pal, r: () => number, solid: (p: number) => boolean, out: (p: number, c: RGB, edge: boolean) => void, hole: Uint8Array, W = GW) {
  const ok = (p: number, dx: number) => {
    const x = (p % W) + dx;
    return x >= 0 && x < W && p + dx >= 0 && solid(p + dx);
  };
  const isEdge = (p: number) => !ok(p - W, 0) || !ok(p + W, 0) || !ok(p, -1) || !ok(p, 1);
  for (const p of mine) {
    const x = (p % W) + 0.5, y = Math.floor(p / W) + 0.5;
    if (hole[p]) { out(p, P.hole, false); continue; }
    if (isEdge(p)) { out(p, P.outline, true); continue; }
    const b = shape.band?.(x, y) ?? 0;
    let c: RGB;
    if (isEdge(p - W) || isEdge(p - 1)) c = P.hi;
    else if (isEdge(p + W) || isEdge(p + 1)) c = P.shadow;
    else if (b === 2) c = P.hi;
    else if (b === 1) c = P.light;
    else if (b === -1) c = P.shadow;
    else if (shape.iridescent && r() < 0.5) c = IRIDESCENT[Math.floor(r() * IRIDESCENT.length)];
    else { const q = r(); c = q < 0.07 ? P.pore : q < 0.4 ? P.light : P.base; }
    out(p, c, false);
  }
}

/** an item cut out of the layer as a standalone image (for the flight to the tray) */
export function itemUrl(art: LayerArt, idx: number, scale = 3): string {
  const key = idx * 10 + scale;
  const hit = art.urls.get(key);
  if (hit) return hit;
  let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
  for (let p = 0; p < art.owner.length; p++) {
    if (art.owner[p] !== idx) continue;
    const x = p % GW, y = (p / GW) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return '';
  const c = document.createElement('canvas');
  c.width = (x1 - x0 + 1) * scale;
  c.height = (y1 - y0 + 1) * scale;
  const ctx = c.getContext('2d')!;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = y * GW + x;
    if (art.owner[p] !== idx) continue;
    ctx.fillStyle = css([art.col[p * 3], art.col[p * 3 + 1], art.col[p * 3 + 2]]);
    ctx.fillRect((x - x0) * scale, (y - y0) * scale, scale, scale);
  }
  const url = c.toDataURL();
  art.urls.set(key, url);
  return url;
}

const iconCache = new Map<string, string>();
/** standalone pixel icon of a minor fossil / amber / mineral (trays, lists) */
export function iconUrl(kind: Exclude<ItemKind, 'fossil'>, key: string | number = 0, scale = 2): string {
  const ck = `${kind}:${key}:${scale}`;
  const hit = iconCache.get(ck);
  if (hit) return hit;
  const r = mulberry(hashStr(String(key)) + 13);
  const it = { kind, mineralId: kind === 'mineral' ? String(key) : undefined, quality: 0, cells: [0], found: false } as LayerItem;
  const { shape, P } = shapeOf(it, [[0, 0]], r);
  const W = TS, own = new Uint8Array(TS * TS), hole = new Uint8Array(TS * TS);
  const mine = rasterise(shape, [[0, 0]], (p) => { own[p] = 1; }, (p) => { hole[p] = 1; }, W);
  const c = document.createElement('canvas');
  c.width = c.height = TS * scale;
  const ctx = c.getContext('2d')!;
  shade(mine, shape, P, r, (p) => p >= 0 && p < own.length && !!own[p] && !hole[p], (p, col) => {
    ctx.fillStyle = css(col);
    ctx.fillRect((p % W) * scale, Math.floor(p / W) * scale, scale, scale);
  }, hole, W);
  const url = c.toDataURL();
  iconCache.set(ck, url);
  return url;
}

// ---------------------------------------------------------------- renderer
export interface Light { x: number; y: number; r: number; i: number; c: RGB }

export interface FrameState {
  st: SiteState;
  art: LayerArt;
  t: number; // ms
  hover: number;
  hoverPx: Pt | null;
  hammer: boolean;
  /** tiles the hammer would hit / that risk damaging a bone */
  area: number[];
  risk: Set<number>;
  /** georadar level 0–4 */
  scanner: number;
  fever: boolean;
  golden: number; // tile index or -1
  press: Map<number, number>; // tile → end of the "pressed in" look after a hit
  glow: (item: number) => number; // shown rarity of a partially uncovered fossil, -1 = none
  glowFlash: (item: number) => number; // 0..1 brightness boost after the glow went up
  /** georadar upgrades */
  sonar?: boolean;
  glintAll?: boolean;
}

const LB = 2; // light block size
const LW = GW / LB, LH = GH / LB;
const lightBuf = new Float32Array(LW * LH * 3);
const ITEM_GLINT: Record<string, RGB> = { amber: [255, 190, 90] };

export function drawFrame(img: ImageData, f: FrameState): void {
  const { st, art } = f;
  const d = img.data;
  const W = B.gridW;
  const tileOf = (x: number, y: number) => ((y / TS) | 0) * W + ((x / TS) | 0);
  const cleared = st.tiles.map((t) => t.hp <= 0);
  const stage = st.tiles.map((t) => (t.hp <= 0 ? 0 : t.hp / t.max < 0.3 ? 3 : t.hp / t.max < 0.55 ? 2 : t.hp / t.max < 0.8 ? 1 : 0));

  // ---- lights
  const amb = 0.88 - Math.min(0.12, st.depth * 0.004);
  const lights: Light[] = [];
  if (f.hoverPx) lights.push({ x: f.hoverPx[0], y: f.hoverPx[1], r: 60, i: 0.22, c: [1, 0.86, 0.62] });
  st.items.forEach((it, k) => {
    if (it.found) return;
    const open = it.cells.filter((c) => cleared[c]);
    if (!open.length) return;
    const cx = open.reduce((a, c) => a + ((c % W) + 0.5) * TS, 0) / open.length;
    const cy = open.reduce((a, c) => a + (((c / W) | 0) + 0.5) * TS, 0) / open.length;
    const rar = f.glow(k);
    lights.push({ x: cx, y: cy, r: 30, i: 0.18 + 0.06 * Math.max(0, rar), c: rar === 3 ? [1, 0.85, 0.45] : [1, 0.93, 0.8] });
  });
  if (f.golden >= 0) {
    const pulse = 0.75 + 0.25 * Math.sin(f.t / 140);
    lights.push({ x: ((f.golden % W) + 0.5) * TS, y: (((f.golden / W) | 0) + 0.5) * TS, r: 26, i: 0.5 * pulse, c: [1, 0.8, 0.3] });
  }
  for (const b of st.burns ?? []) lights.push({ x: ((b.tile % W) + 0.5) * TS, y: (((b.tile / W) | 0) + 0.5) * TS, r: 26, i: 0.28 + 0.06 * Math.sin(f.t / 70 + b.tile), c: [1, 0.55, 0.2] });
  if (f.fever) lights.push({ x: GW / 2, y: GH / 2, r: 140, i: 0.2 + 0.04 * Math.sin(f.t / 90), c: [1, 0.55, 0.2] });
  for (let by = 0; by < LH; by++) {
    for (let bx = 0; bx < LW; bx++) {
      const px = bx * LB + 1, py = by * LB + 1;
      let lr = amb * 0.96, lg = amb * 0.97, lb = amb;
      for (const L of lights) {
        const dd = Math.hypot(px - L.x, py - L.y);
        if (dd >= L.r) continue;
        const k = L.i * Math.pow(1 - dd / L.r, 1.4);
        lr += k * L.c[0]; lg += k * L.c[1]; lb += k * L.c[2];
      }
      const q = (v: number) => Math.round(Math.min(1.35, v) / 0.05) * 0.05; // stepped, Terraria-style
      const o = (by * LW + bx) * 3;
      lightBuf[o] = q(lr); lightBuf[o + 1] = q(lg); lightBuf[o + 2] = q(lb);
    }
  }

  // ---- base pixels × light
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const p = y * GW + x;
      const ti = tileOf(x, y);
      let r: number, g: number, b: number;
      const o = art.owner[p];
      if (!cleared[ti]) {
        r = art.rock[p * 3]; g = art.rock[p * 3 + 1]; b = art.rock[p * 3 + 2];
        const cs = art.crack[p];
        if (cs && cs <= stage[ti]) { r *= 0.3; g *= 0.28; b *= 0.27; }
        else if (stage[ti] && x > 0 && y > 0 && art.crack[p - GW - 1] && art.crack[p - GW - 1] <= stage[ti]) { r *= 1.14; g *= 1.12; b *= 1.1; }
        const pr = f.press.get(ti);
        if (pr && pr > f.t) { r *= 0.86; g *= 0.86; b *= 0.86; } // pressed in for a moment
      } else if (o >= 0 && !st.items[o].found) {
        r = art.col[p * 3]; g = art.col[p * 3 + 1]; b = art.col[p * 3 + 2];
      } else if (o >= 0) {
        // imprint left behind by a find that was lifted out
        const k = art.edge[p] ? 0.55 : 0.32;
        r = art.back[p * 3] * k + 8; g = art.back[p * 3 + 1] * k + 6; b = art.back[p * 3 + 2] * k + 5;
      } else {
        r = art.back[p * 3]; g = art.back[p * 3 + 1]; b = art.back[p * 3 + 2];
      }
      const l = (((y / LB) | 0) * LW + ((x / LB) | 0)) * 3;
      const i = p * 4;
      d[i] = r * lightBuf[l]; d[i + 1] = g * lightBuf[l + 1]; d[i + 2] = b * lightBuf[l + 2]; d[i + 3] = 255;
    }
  }

  // ---- overlays (full brightness)
  const put = (x: number, y: number, c: RGB, a = 1) => {
    if (x < 0 || y < 0 || x >= GW || y >= GH) return;
    const i = (y * GW + x) * 4;
    d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a;
  };
  const tx0 = (ti: number) => (ti % W) * TS, ty0 = (ti: number) => ((ti / W) | 0) * TS;
  const rect = (ti: number, c: RGB, a: number, inset = 0, dashed = false) => {
    const x0 = tx0(ti) + inset, y0 = ty0(ti) + inset, s = TS - 1 - inset * 2;
    for (let k = 0; k <= s; k++) {
      if (dashed && ((k + (f.t / 160) | 0) % 4) >= 2) continue;
      put(x0 + k, y0, c, a); put(x0 + k, y0 + s, c, a); put(x0, y0 + k, c, a); put(x0 + s, y0 + k, c, a);
    }
  };
  const corners = (ti: number, c: RGB, a: number) => {
    const x0 = tx0(ti) + 1, y0 = ty0(ti) + 1, s = TS - 3;
    for (let k = 0; k < 4; k++) {
      put(x0 + k, y0, c, a); put(x0, y0 + k, c, a);
      put(x0 + s - k, y0, c, a); put(x0 + s, y0 + k, c, a);
      put(x0 + k, y0 + s, c, a); put(x0, y0 + s - k, c, a);
      put(x0 + s - k, y0 + s, c, a); put(x0 + s, y0 + s - k, c, a);
    }
  };
  const plus = (x: number, y: number, rr: number, c: RGB, a: number) => {
    put(x, y, c, a);
    for (let k = 1; k <= rr; k++) { put(x + k, y, c, a * 0.8); put(x - k, y, c, a * 0.8); put(x, y + k, c, a * 0.8); put(x, y - k, c, a * 0.8); }
  };

  // glowing cracks during the fever
  if (f.fever) {
    const hot: RGB = [255, 154, 60];
    for (let p = 0; p < art.crack.length; p++) {
      const cs = art.crack[p];
      if (!cs) continue;
      const ti = tileOf(p % GW, (p / GW) | 0);
      if (!cleared[ti] && cs <= stage[ti]) put(p % GW, (p / GW) | 0, hot, 0.85);
    }
  }

  // smouldering tiles: flickering embers on the tile and its edges
  for (const b of st.burns ?? []) {
    for (const ti of [b.tile, b.tile - W, b.tile + W, b.tile % W ? b.tile - 1 : -1, b.tile % W < W - 1 ? b.tile + 1 : -1]) {
      if (ti < 0 || ti >= st.tiles.length || cleared[ti]) continue;
      const x0 = tx0(ti), y0 = ty0(ti), main = ti === b.tile;
      for (let k = 0; k < (main ? 14 : 5); k++) {
        const h = (k * 73 + ti * 31 + ((f.t / 90) | 0) * 17) % 256;
        const px = x0 + 1 + (h % 14), py = y0 + 1 + ((h * 7) % 14);
        put(px, py, k % 3 ? [255, 140, 40] : [255, 220, 120], main ? 0.85 : 0.55);
      }
    }
  }

  // amber / minerals glint through cracked rock: "something shiny in there"
  st.items.forEach((it, k) => {
    if (it.found || (it.kind !== 'amber' && it.kind !== 'mineral')) return;
    const ti = it.cells[0];
    if (cleared[ti] || (stage[ti] < 2 && !f.glintAll)) return;
    const ph = (f.t + k * 431) % 1400;
    if (ph > 380) return;
    const [gx, gy] = art.glint[k];
    const c = ITEM_GLINT[it.kind] ?? hex(MINERAL_BY_ID.get(it.mineralId ?? '')?.color ?? '#e6ebf0');
    plus(gx, gy, ph < 190 ? 1 : 0, c, 0.9);
  });

  // partially uncovered items: rarity glow around the visible part + "dig here" brackets on the rest
  const W1 = (Math.sin(f.t / 260) + 1) / 2;
  st.items.forEach((it, k) => {
    if (it.found) return;
    const open = it.cells.filter((c) => cleared[c]);
    if (!open.length) return;
    const lvl = f.glow(k);
    if (lvl >= 0) {
      const gc = GLOW[lvl];
      const boost = f.glowFlash(k);
      let minP = -1, maxP = -1;
      for (const ti of open) {
        for (let y = ty0(ti); y < ty0(ti) + TS; y++) for (let x = tx0(ti); x < tx0(ti) + TS; x++) {
          const p = y * GW + x;
          if (art.owner[p] !== k) continue;
          if (minP < 0 || x < minP % GW) minP = p;
          if (maxP < 0 || x > maxP % GW) maxP = p;
          for (const q of [p - 1, p + 1, p - GW, p + GW]) {
            if (q < 0 || q >= art.owner.length || art.owner[q] === k) continue;
            const qx = q % GW, qy = (q / GW) | 0;
            if (Math.abs(qx - x) > 1 || !cleared[tileOf(qx, qy)]) continue;
            put(qx, qy, gc, Math.min(1, (lvl ? 0.75 : 0.55) + boost * 0.25));
          }
        }
      }
      if (lvl > 0) {
        const tw = ((f.t / 400) | 0) % 2;
        if (minP >= 0) plus((minP % GW) - 1, ((minP / GW) | 0) - 1, 1 + tw, gc, 0.85);
        if (maxP >= 0) plus((maxP % GW) + 1, ((maxP / GW) | 0) - 1, 2 - tw, gc, 0.85);
      }
    }
    const gold: RGB = [242, 193, 78];
    for (const c of it.cells) if (!cleared[c]) corners(c, gold, 0.55 + 0.45 * W1);
  });

  // georadar: low levels show rough zones (with empty rock around), higher levels sharpen them
  if (f.scanner) {
    const W2 = B.gridW;
    for (const z of radarZones(st, f.scanner)) {
      const it = st.items[z.item];
      if (it.found || it.cells.some((c) => cleared[c])) continue;
      const inZone = (t: number) => z.tiles.has(t) && !cleared[t];
      for (const ti of z.tiles) {
        if (cleared[ti]) continue;
        const x0 = tx0(ti), y0 = ty0(ti), e = TS - 1;
        const tx = ti % W2;
        const dash = (k: number) => ((k + ((f.t / 160) | 0)) % 4) < 2;
        // faint tint inside the zone
        for (let y = y0 + 2; y < y0 + e - 1; y += 3) for (let x = x0 + 2 + (y % 2); x < x0 + e - 1; x += 3) put(x, y, z.color, 0.18);
        // outline only where the zone ends
        for (let k = 0; k <= e; k++) {
          if (!dash(k)) continue;
          if (!inZone(ti - W2)) put(x0 + k, y0 + 1, z.color, 0.7);
          if (!inZone(ti + W2)) put(x0 + k, y0 + e - 1, z.color, 0.7);
          if (tx === 0 || !inZone(ti - 1)) put(x0 + 1, y0 + k, z.color, 0.7);
          if (tx === W2 - 1 || !inZone(ti + 1)) put(x0 + e - 1, y0 + k, z.color, 0.7);
        }
      }
    }
  }

  // echo: a dug tile next to something still hidden shows faint ripples (8 neighbours when only one find is left)
  const left = st.items.filter((it) => !it.found).length;
  const echoC: RGB = [120, 200, 240];
  for (let ti = 0; ti < st.tiles.length; ti++) {
    if (!cleared[ti] || st.tiles[ti].item >= 0) continue;
    if (!echoNear(st, ti, f.sonar ? 1 : left)) continue;
    const cx = tx0(ti) + 8, cy = ty0(ti) + 10;
    const ph = (f.t / 700 + ti * 0.37) % 1;
    for (const [rad, a] of [[3, 0.7], [5.5, 0.45]] as [number, number][]) {
      const al = a * (0.5 + 0.5 * Math.sin((ph + rad / 8) * Math.PI * 2));
      for (let ang = -2.5; ang <= -0.64; ang += 0.18) put(Math.round(cx + Math.cos(ang) * rad), Math.round(cy + Math.sin(ang) * rad), echoC, al);
    }
  }

  // golden flash
  if (f.golden >= 0) {
    const g: RGB = [255, 205, 80];
    const pulse = 0.55 + 0.45 * Math.sin(f.t / 110);
    rect(f.golden, g, pulse, 0);
    rect(f.golden, g, pulse * 0.5, 1);
    const cx = tx0(f.golden) + 8, cy = ty0(f.golden) + 7;
    plus(cx, cy, 2 + (((f.t / 220) | 0) % 2), [255, 222, 120], 1);
    plus(cx + 4, cy + 4, 1, g, pulse);
  }

  // hover: tile outline, hammer area (red = could crack a bone), remaining strength
  if (f.hover >= 0 && !cleared[f.hover]) {
    const warm: RGB = [255, 196, 110];
    if (f.hammer) {
      for (const c of f.area) rect(c, f.risk.has(c) ? [255, 110, 96] : warm, f.risk.has(c) ? 0.9 : 0.35);
    } else rect(f.hover, warm, 0.4);
    const t = st.tiles[f.hover];
    const x0 = tx0(f.hover) + 2, y0 = ty0(f.hover) + 13;
    const w = TS - 4, fill = Math.max(1, Math.round((t.hp / t.max) * w));
    for (let k = 0; k < w; k++) { put(x0 + k, y0, k < fill ? [226, 196, 140] : [30, 24, 20], k < fill ? 0.9 : 0.7); put(x0 + k, y0 + 1, [20, 16, 12], 0.6); }
  }
}

/** a dug tile that has something still hidden right next to it */
export function echoNear(st: SiteState, ti: number, left = st.items.filter((it) => !it.found).length): boolean {
  const W = B.gridW;
  const x = ti % W, y = (ti / W) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    if (dx && dy && left > 1) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= B.gridH) continue;
    const t = st.tiles[ny * W + nx];
    if (t.hp > 0 && t.item >= 0 && !st.items[t.item].found) return true;
  }
  return false;
}

// ---------------------------------------------------------------- georadar zones
export interface RadarZone { item: number; tiles: Set<number>; color: RGB }
const ZONE_NEUTRAL: RGB = [150, 220, 170];
const ZONE_KIND: Record<ItemKind, RGB> = { fossil: [87, 227, 137], minor: [90, 169, 255], amber: [255, 179, 71], mineral: [200, 150, 255] };
const zoneCache = new WeakMap<LayerItem[], Map<number, RadarZone[]>>();

/**
 * What the georadar shows for each hidden find at a given level (fixed for the whole layer):
 * 1 — kości only, a blurry zone around the bone, shifted by up to one tile, with plenty of empty rock;
 * 2 — kości + bursztyn + minerały, tighter zone (about half the empty tiles around);
 * 3 — near-exact outline in the colour of the kind, sometimes one false tile;
 * 4 — exact outline of every find, minor ones included.
 */
export function radarZones(st: SiteState, level: number): RadarZone[] {
  let byLevel = zoneCache.get(st.items);
  if (!byLevel) { byLevel = new Map(); zoneCache.set(st.items, byLevel); }
  const hit = byLevel.get(level);
  if (hit) return hit;
  const W = B.gridW, H = B.gridH;
  const r = mulberry(hashStr(`radar:${st.depth}:${st.layersDone}:${level}`));
  const zones: RadarZone[] = [];
  const near = (c: number, ox: number, oy: number, rad: number) => {
    const out: number[] = [];
    const cx = (c % W) + ox, cy = Math.floor(c / W) + oy;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) out.push(y * W + x);
    }
    return out;
  };
  st.items.forEach((it, k) => {
    if (level <= 1 && it.kind !== 'fossil') return;
    if (level <= 3 && it.kind === 'minor') return;
    const tiles = new Set<number>(it.cells);
    if (level === 1) {
      const ox = Math.floor(r() * 3) - 1, oy = Math.floor(r() * 3) - 1;
      for (const c of it.cells) for (const t of near(c, ox, oy, 1)) if (!it.cells.includes(t) && r() < 0.8) tiles.add(t);
      for (const c of it.cells) for (const t of near(c, 0, 0, 1)) if (r() < 0.35) tiles.add(t); // keep the bone inside a fuzzy blob
    } else if (level === 2) {
      for (const c of it.cells) for (const t of near(c, 0, 0, 1)) if (r() < 0.4) tiles.add(t);
    } else if (level === 3 && r() < 0.6) {
      const ring = it.cells.flatMap((c) => near(c, 0, 0, 1)).filter((t) => !it.cells.includes(t));
      if (ring.length) tiles.add(ring[Math.floor(r() * ring.length)]);
    }
    zones.push({ item: k, tiles, color: level <= 2 ? ZONE_NEUTRAL : ZONE_KIND[it.kind] });
  });
  byLevel.set(level, zones);
  return zones;
}

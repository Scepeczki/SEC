// Park 2.0 pixel art, drawn procedurally: island terrain (cached per island) and every placeable object
// (cached per definition, level, size and seed). Top-down with a slight 3/4 tilt: buildings show a roof and a front wall
// and may rise up to LIFT pixels above their footprint.

import type { Habitat } from '../../data/types';
import { CHUNK, ISLAND_BY_ID, type Biome } from '../../game/parkContent';
import { Tile, Wild, terrain } from '../../game/islands';
import type { PlaceDef } from '../../game/parkContent';

export const TS = 16;

type Ctx = CanvasRenderingContext2D;
const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function blob(c: Ctx, cx: number, cy: number, r: number, col: string) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

// ---------------------------------------------------------------- terrain

const LAND: Record<Biome, [string, string, string]> = {
  meadow: ['#6f9e4c', '#76a552', '#679645'],
  marsh: ['#5f8a4a', '#668f4e', '#577f44'],
  reef: ['#7aa54e', '#82ad55', '#719c48'],
  cliffs: ['#86965f', '#8f9e66', '#7c8c58'],
  volcanic: ['#5f6b46', '#66724b', '#56603f'],
  mainland: ['#739c4e', '#7aa354', '#6a9348'],
};
export const WATER_DEEP = '#1c4866';
const SHALLOW = ['#2f7597', '#33799b'];
const SAND = ['#d8c48e', '#d1bc85', '#ddca96'];
const PATH = ['#cdb88e', '#c6b086', '#d4c096'];

/** the whole island (terrain, wild cover, paths) drawn at TS px per tile; open sea stays transparent */
export function drawIsland(island: number, cleared: Set<number>, paths: Set<number>, locked = false): HTMLCanvasElement {
  const t = terrain(island);
  const biome = ISLAND_BY_ID.get(island)!.biome;
  const cv = document.createElement('canvas');
  cv.width = t.w * TS;
  cv.height = t.h * TS;
  const c = cv.getContext('2d')!;
  const land = LAND[biome];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= t.w || y >= t.h ? Tile.Deep : t.tiles[y * t.w + x]);
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    const i = y * t.w + x, v = t.vary[i], px = x * TS, py = y * TS;
    const tile = t.tiles[i];
    if (tile === Tile.Deep) continue;
    if (tile === Tile.Shallow) {
      R(c, px, py, TS, TS, SHALLOW[v & 1]);
      if (v < 40) R(c, px + (v % 10) + 2, py + 4 + (v % 7), 5, 1, '#5aa0bf');
      // foam where it meets the beach
      for (const [dx, dy, fx, fy, fw, fh] of [[0, -1, 0, 0, TS, 2], [0, 1, 0, TS - 2, TS, 2], [-1, 0, 0, 0, 2, TS], [1, 0, TS - 2, 0, 2, TS]] as const)
        if (at(x + dx, y + dy) >= Tile.Sand) R(c, px + fx, py + fy, fw, fh, '#bfe2ea');
      continue;
    }
    const sand = tile === Tile.Sand;
    R(c, px, py, TS, TS, sand ? SAND[v % 3] : land[v % 3]);
    if (!sand) {
      if (v % 5 === 0) { R(c, px + (v % 11) + 2, py + (v % 9) + 3, 1, 2, '#4f7f35'); R(c, px + (v % 11) + 4, py + (v % 9) + 4, 1, 2, '#4f7f35'); }
      if (v % 23 === 1) R(c, px + 6, py + 7, 2, 2, biome === 'volcanic' ? '#c9673a' : '#e8d36a');
      // soft sand edge on land next to the beach
      for (const [dx, dy, fx, fy, fw, fh] of [[0, -1, 0, 0, TS, 2], [0, 1, 0, TS - 2, TS, 2], [-1, 0, 0, 0, 2, TS], [1, 0, TS - 2, 0, 2, TS]] as const)
        if (at(x + dx, y + dy) === Tile.Sand) R(c, px + fx, py + fy, fw, fh, '#b9b47a');
    } else if (v % 9 === 0) R(c, px + (v % 12) + 1, py + (v % 10) + 2, 2, 1, '#b8a372');
  }
  // paths (under wild cover never happens: paths need cleared land)
  for (const i of paths) {
    const x = i % t.w, y = (i - x) / t.w, px = x * TS, py = y * TS, v = t.vary[i];
    R(c, px, py, TS, TS, PATH[v % 3]);
    const has = (dx: number, dy: number) => paths.has((y + dy) * t.w + x + dx);
    if (!has(0, -1)) R(c, px, py, TS, 2, '#a68f63');
    if (!has(0, 1)) R(c, px, py + TS - 2, TS, 2, '#9c855a');
    if (!has(-1, 0)) R(c, px, py, 2, TS, '#a68f63');
    if (!has(1, 0)) R(c, px + TS - 2, py, 2, TS, '#a68f63');
    for (let k = 0; k < 3; k++) R(c, px + ((v * (k + 3)) % 12) + 2, py + ((v * (k + 7)) % 12) + 2, 1, 1, '#a99572');
  }
  // wild cover on chunks that are not cleared yet
  for (const ch of t.landChunks) {
    if (cleared.has(ch)) continue;
    const cx0 = (ch % t.cw) * CHUNK, cy0 = Math.floor(ch / t.cw) * CHUNK;
    for (let y = cy0; y < Math.min(t.h, cy0 + CHUNK); y++) for (let x = cx0; x < Math.min(t.w, cx0 + CHUNK); x++) {
      const i = y * t.w + x;
      if (t.tiles[i] < Tile.Sand) continue;
      drawWild(c, x * TS, y * TS, t.wild[i], t.vary[i], biome);
    }
  }
  if (locked) {
    // islands you do not own yet: dimmed (only the island itself, not the sea around it)
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#0a1a28a0';
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
  }
  return cv;
}

function drawWild(c: Ctx, px: number, py: number, kind: number, v: number, biome: Biome) {
  if (kind === Wild.Rocks) {
    R(c, px, py, TS, TS, biome === 'volcanic' ? '#4e4740' : '#7b7a6e');
    blob(c, px + 5 + (v % 4), py + 6, 4, biome === 'volcanic' ? '#38322d' : '#8d8a80');
    blob(c, px + 11, py + 11 - (v % 3), 3, biome === 'volcanic' ? '#2f2a26' : '#6f6c64');
    R(c, px + 3 + (v % 4), py + 3, 3, 1, biome === 'volcanic' ? '#6a5a4c' : '#b0ad9f');
    if (biome === 'volcanic' && v % 7 === 0) R(c, px + 8, py + 9, 2, 1, '#e0602e');
  } else if (kind === Wild.Marsh) {
    R(c, px, py, TS, TS, '#4c6e3e');
    blob(c, px + 8, py + 9, 5, '#456f72');
    R(c, px + 5, py + 8, 4, 1, '#6b9a9c');
    for (let k = 0; k < 4; k++) R(c, px + ((v + k * 5) % 14) + 1, py + 2 + (k % 2) * 7, 1, 5, '#3d6a2f');
  } else {
    const dark = biome === 'reef' ? ['#3f7a35', '#4d8c3d', '#2f5f2a'] : ['#3a6430', '#467738', '#2d5226'];
    R(c, px, py, TS, TS, dark[2]);
    blob(c, px + 5, py + 6, 5, dark[0]);
    blob(c, px + 11, py + 10, 5, dark[1]);
    blob(c, px + 4 + (v % 5), py + 12, 3, dark[0]);
    R(c, px + 4, py + 3, 3, 1, '#6aa04e');
    R(c, px + 10, py + 7, 3, 1, '#78ad58');
  }
}

// ---------------------------------------------------------------- objects

/** pixels an object's art rises above its footprint */
export function liftOf(def: PlaceDef): number {
  if (def.id === 'v_balloon') return 44;
  if (def.id === 'v_view' || def.id === 'v_hotel') return 26;
  if (def.cat === 'station' || def.cat === 'farm' || def.cat === 'visitor') return 12;
  if (def.id === 'd_araucaria' || def.id === 'd_ginkgo' || def.id === 'd_amber' || def.id === 'd_statue') return 14;
  if (def.cat === 'decor') return 6;
  if (def.cat === 'gate') return 10;
  return 4;
}

export const tierOf = (level: number) => (level >= 20 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1);

/** pens inside an enclosure, in tiles relative to its top-left (inset by the fence) */
export function penRects(w: number, h: number, pens: number): { x: number; y: number; w: number; h: number }[] {
  const iw = w - 1, ih = h - 1;
  const rows = pens > 4 ? 2 : pens > 2 && h > w ? 2 : 1;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const perRow = [Math.ceil(pens / rows), pens - Math.ceil(pens / rows)];
  for (let r = 0; r < rows; r++) {
    const n = perRow[r];
    for (let k = 0; k < n; k++) out.push({ x: 0.5 + (iw * k) / n, y: 0.5 + (ih * r) / rows, w: iw / n, h: ih / rows });
  }
  return out;
}

const GROUND: Record<Habitat, [string, string]> = {
  land: ['#86b35a', '#7cab52'],
  freshwater: ['#6d7f48', '#62743f'],
  marine: ['#3d8db4', '#3584ab'],
  air: ['#a2ad7c', '#98a372'],
};

export interface ObjArtOpts { level: number; w: number; h: number; pens?: number; decor?: string[]; seed: number }

const cache = new Map<string, HTMLCanvasElement>();

/** cached art of an object: canvas of (w·TS) × (h·TS + lift), the footprint is the bottom part */
export function objectArt(def: PlaceDef, o: ObjArtOpts): HTMLCanvasElement {
  const key = `${def.id}|${o.level}|${o.w}x${o.h}|${o.pens ?? 0}|${(o.decor ?? []).join(',')}|${o.seed}`;
  let cv = cache.get(key);
  if (cv) return cv;
  const lift = liftOf(def);
  cv = document.createElement('canvas');
  cv.width = o.w * TS;
  cv.height = o.h * TS + lift;
  const c = cv.getContext('2d')!;
  c.translate(0, lift);
  const W = o.w * TS, H = o.h * TS;
  const r = rng(o.seed * 7919 + o.level * 13 + 1);
  switch (def.cat) {
    case 'enclosure': drawEnclosure(c, def.habitat!, W, H, o, r); break;
    case 'station': drawStation(c, def, W, H, o.level, r); break;
    case 'farm': drawFarm(c, def.id, W, H, o.level, r); break;
    case 'visitor': drawVisitor(c, def.id, W, H, o.level, r); break;
    case 'decor': drawDecor(c, def.id, W, H, r); break;
    case 'gate': drawGate(c, W, H); break;
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, cv);
  return cv;
}

// ---- enclosures

function drawEnclosure(c: Ctx, hab: Habitat, W: number, H: number, o: ObjArtOpts, r: () => number) {
  const [g1, g2] = GROUND[hab];
  R(c, 0, 0, W, H, g1);
  for (let k = 0; k < (W * H) / 90; k++) R(c, r() * W, r() * H, 2 + r() * 3, 1, g2);
  const pens = penRects(o.w, o.h, o.pens ?? 2);
  // habitat features per pen
  for (const p of pens) {
    const px = p.x * TS, py = p.y * TS, pw = p.w * TS, ph = p.h * TS;
    if (hab === 'land') {
      for (let k = 0; k < Math.max(1, Math.round((pw * ph) / 900)); k++) { const x = px + 6 + r() * (pw - 12), y = py + 6 + r() * (ph * 0.4); R(c, x - 1, y + 3, 2, 4, '#6e4f30'); blob(c, x, y, 4, '#4f8a3a'); R(c, x - 2, y - 2, 2, 1, '#79b25a'); }
      for (let k = 0; k < (pw * ph) / 250; k++) R(c, px + r() * pw, py + r() * ph, 1, 2, '#5f9440');
    } else if (hab === 'freshwater') {
      blob(c, px + pw * 0.55, py + ph * 0.55, Math.min(pw, ph) * 0.3, '#4a7f86');
      R(c, px + pw * 0.45, py + ph * 0.5, pw * 0.15, 1, '#79aeb2');
      for (let k = 0; k < pw / 5; k++) { const x = px + 3 + r() * (pw - 6), y = py + 3 + r() * (ph * 0.35); R(c, x, y, 1, 5, '#3d6a2f'); R(c, x, y - 1, 1, 2, '#8a6a3a'); }
    } else if (hab === 'marine') {
      for (let k = 0; k < (pw * ph) / 120; k++) R(c, px + r() * pw, py + r() * ph, 4, 1, '#59a6c8');
      R(c, px + 2, py + ph - 6, pw - 4, 4, '#d8c690');
      for (let k = 0; k < pw / 8; k++) { const x = px + 4 + r() * (pw - 8); R(c, x, py + ph - 10, 2, 5, k % 2 ? '#e07a7a' : '#3f8f5a'); }
    } else {
      blob(c, px + pw * 0.3, py + ph * 0.6, Math.min(pw, ph) * 0.18, '#8a8678');
      R(c, px + pw * 0.3 - 3, py + ph * 0.6 - 4, 5, 1, '#b5b1a3');
      R(c, px + pw * 0.7, py + ph * 0.3, 2, ph * 0.4, '#7a5634');
      R(c, px + pw * 0.62, py + ph * 0.3, pw * 0.2, 2, '#7a5634');
    }
  }
  // interior decorations (small icons along the bottom of the first pens)
  (o.decor ?? []).forEach((id, k) => {
    const p = pens[k % pens.length];
    const x = (p.x + p.w * (0.2 + 0.25 * Math.floor(k / pens.length))) * TS, y = (p.y + p.h * 0.8) * TS;
    if (id === 'i_log') { R(c, x - 6, y - 2, 12, 4, '#7a5634'); R(c, x + 5, y - 2, 2, 4, '#c9a26a'); }
    else if (id === 'i_boulder' || id === 'i_ledge') { blob(c, x, y - 2, 4, '#8d8a80'); R(c, x - 2, y - 5, 3, 1, '#b0ad9f'); }
    else if (id === 'i_trough' || id === 'i_mud') { R(c, x - 6, y - 3, 12, 5, id === 'i_mud' ? '#5a4632' : '#6e5a40'); R(c, x - 5, y - 2, 10, 3, id === 'i_mud' ? '#7a5f42' : '#5aa0bf'); }
    else if (id === 'i_ferns' || id === 'i_kelp' || id === 'i_reeds') { for (let j = -4; j <= 4; j += 2) R(c, x + j, y - 6 + Math.abs(j), 1, 6 - Math.abs(j) / 2, id === 'i_kelp' ? '#2f7a4a' : '#3f7a35'); }
    else if (id === 'i_nest') { blob(c, x, y - 1, 4, '#8a6a3a'); R(c, x - 2, y - 3, 2, 2, '#efe6cf'); R(c, x + 1, y - 2, 2, 2, '#efe6cf'); }
    else if (id === 'i_reef') { for (let j = -5; j <= 5; j += 3) R(c, x + j, y - 4, 2, 4, j % 2 ? '#e07a7a' : '#e0b04a'); }
    else if (id === 'i_perch') { R(c, x - 6, y - 6, 12, 1, '#7a5634'); R(c, x - 1, y - 6, 2, 6, '#6e4f30'); }
  });
  // pen dividers
  const fence = fenceStyle(o.level);
  for (let k = 0; k < pens.length; k++) {
    const p = pens[k];
    const x2 = (p.x + p.w) * TS, y2 = (p.y + p.h) * TS;
    if (x2 < W - TS * 0.6) for (let y = p.y * TS; y < y2; y += 3) R(c, x2 - 1, y, 2, 2, fence.inner);
    if (y2 < H - TS * 0.6) for (let x = p.x * TS; x < x2; x += 3) R(c, x, y2 - 1, 2, 2, fence.inner);
  }
  if (hab === 'air') for (let x = 4; x < W; x += 6) R(c, x, 0, 1, H, '#ffffff22');
  // outer fence
  drawFence(c, W, H, fence);
}

interface FenceStyle { post: string; rail: string; inner: string; wall?: string; top?: string; warn?: boolean; tower?: boolean }
function fenceStyle(level: number): FenceStyle {
  if (level >= 5) return { post: '#5b6670', rail: '#8a96a0', inner: '#6f7b85', warn: true, tower: true };
  if (level >= 4) return { post: '#857f72', rail: '#a49d8c', inner: '#8a8374', wall: '#9a958a', top: '#b8b3a5', tower: true };
  if (level >= 3) return { post: '#857f72', rail: '#a49d8c', inner: '#8a8374', wall: '#9a958a', top: '#b8b3a5' };
  if (level >= 2) return { post: '#6a4a2c', rail: '#9a7246', inner: '#8a6a40' };
  return { post: '#7a5634', rail: '#a07a4c', inner: '#9a7a50' };
}

function drawFence(c: Ctx, W: number, H: number, f: FenceStyle) {
  if (f.wall) {
    R(c, 0, 0, W, 4, f.wall); R(c, 0, H - 5, W, 5, f.wall); R(c, 0, 0, 4, H, f.wall); R(c, W - 4, 0, 4, H, f.wall);
    R(c, 0, 0, W, 1, f.top!); R(c, 0, H - 5, W, 1, f.top!);
    for (let x = 4; x < W; x += 8) R(c, x, H - 3, 4, 1, '#7c776b');
  } else {
    R(c, 0, 1, W, 2, f.rail); R(c, 0, H - 4, W, 2, f.rail); R(c, 1, 0, 2, H, f.rail); R(c, W - 3, 0, 2, H, f.rail);
    for (let x = 0; x < W; x += 8) { R(c, x, 0, 3, 4, f.post); R(c, x, H - 5, 3, 5, f.post); }
    for (let y = 0; y < H; y += 8) { R(c, 0, y, 4, 3, f.post); R(c, W - 4, y, 4, 3, f.post); }
  }
  if (f.warn) for (let x = 6; x < W - 6; x += 16) { R(c, x, H - 4, 4, 2, '#e8c23a'); R(c, x + 1, H - 4, 1, 2, '#2a2a2a'); }
  if (f.tower) { R(c, W - 10, -4, 8, 10, '#6c675c'); R(c, W - 11, -6, 10, 3, '#4a463e'); R(c, W - 8, -2, 4, 2, '#e8d9a0'); }
  // gate opening on the bottom side
  R(c, W / 2 - 6, H - 5, 12, 5, '#c9b48a');
  R(c, W / 2 - 7, H - 7, 2, 7, f.post); R(c, W / 2 + 5, H - 7, 2, 7, f.post);
}

// ---- buildings

const GLYPHS: Record<string, string[]> = {
  pick: ['  ###  ', ' #   # ', '#  #  #', '   #   ', '   #   ', '   #   ', '   #   '],
  brush: ['     ##', '    ## ', '   ##  ', '  ##   ', ' ###   ', '####   ', '##     '],
  dna: ['#    # ', ' #  #  ', '  ##   ', ' #  #  ', '#    # ', ' #  #  ', '  ##   '],
  egg: ['  ###  ', ' ##### ', ' ##### ', '#######', '#######', '#######', ' ##### '],
  scope: ['  ##   ', '  ##   ', '  ###  ', '   ##  ', ' #  #  ', '##### #', '#######'],
  hazard: ['  ###  ', ' #   # ', '#  #  #', '# ### #', '#  #  #', ' #   # ', '  ###  '],
  column: ['#######', ' # # # ', ' # # # ', ' # # # ', ' # # # ', ' # # # ', '#######'],
  ticket: ['#######', '#  #  #', '#######', '#  #  #', '#######', '       ', '       '],
  meat: ['   ### ', '  #####', ' ######', '###### ', '##     ', '#      ', '       '],
  leaf: ['    ###', '  #####', ' ######', ' ##### ', '#####  ', '##     ', '#      '],
  fish: ['       ', ' ###  #', '#####  ', '###### ', '#####  ', ' ###  #', '       '],
  gift: ['  # #  ', '#######', '#  #  #', '#######', '#  #  #', '#  #  #', '#######'],
  cup: ['#######', '#     #', '#     #', ' #   # ', '  ###  ', '   #   ', ' ##### '],
  wc: ['#   #  ', '# # #  ', '# # #  ', ' # #   ', '    ###', '    #  ', '    ###'],
  fork: ['# # #  ', '# # #  ', '#####  ', '  #    ', '  #  ##', '  #  ##', '  #  # '],
  eye: ['       ', ' ##### ', '#  #  #', '# ### #', '#  #  #', ' ##### ', '       '],
  bed: ['#      ', '#   ###', '#######', '#######', '#     #', '       ', '       '],
};

const STATION_LOOK: Record<string, { wall: string; roof: string; roof2: string; glyph: string }> = {
  st_expedition: { wall: '#b49a6c', roof: '#6f8a4a', roof2: '#5d7a3c', glyph: 'pick' },
  st_prep: { wall: '#c9b48a', roof: '#a0623e', roof2: '#8a5233', glyph: 'brush' },
  st_sequencer: { wall: '#d8dde0', roof: '#4a7fa8', roof2: '#3d6c90', glyph: 'dna' },
  st_hatchery: { wall: '#e0d4b8', roof: '#d39a3a', roof2: '#b8832c', glyph: 'egg' },
  st_research: { wall: '#cfd4d8', roof: '#5d6a8a', roof2: '#4d5876', glyph: 'scope' },
  st_mutation: { wall: '#b8c4a8', roof: '#6a9a3a', roof2: '#5a852f', glyph: 'hazard' },
  st_museum: { wall: '#e6dcc4', roof: '#9a8f78', roof2: '#857a64', glyph: 'column' },
  st_visitor: { wall: '#e6d8b8', roof: '#c25a4a', roof2: '#a84c3e', glyph: 'ticket' },
};

function glyph(c: Ctx, name: string, x: number, y: number, s: number, col: string) {
  const g = GLYPHS[name];
  if (!g) return;
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 7; xx++) if (g[yy][xx] === '#') R(c, x + xx * s, y + yy * s, s, s, col);
}

/** a building: shadow, front wall with windows and a door, roof, emblem; nicer with each tier */
function building(c: Ctx, W: number, H: number, look: { wall: string; roof: string; roof2: string; glyph: string }, level: number, inset = 3) {
  const tier = tierOf(level);
  const x0 = inset, x1 = W - inset, bw = x1 - x0;
  const wallTop = Math.round(H * 0.5), wallBot = H - 3;
  const roofTop = -8;
  R(c, x0 + 3, wallBot - 1, bw, 4, '#00000033');
  // wall
  R(c, x0, wallTop, bw, wallBot - wallTop, tier >= 3 ? shade(look.wall, -10) : look.wall);
  if (tier >= 2) for (let x = x0; x < x1; x += 6) R(c, x, wallTop + 2, 1, wallBot - wallTop - 2, shade(look.wall, -18));
  R(c, x0, wallBot - 2, bw, 2, shade(look.wall, -30));
  // windows
  const wy = wallTop + 4;
  for (let x = x0 + 4; x < x1 - 8; x += 9) {
    if (Math.abs(x + 3 - W / 2) < 6) continue;
    R(c, x, wy, 5, 5, tier >= 3 ? '#9fd4ea' : '#6f9fb8');
    R(c, x, wy, 5, 1, '#ffffff66');
  }
  // door
  R(c, W / 2 - 3, wallBot - 9, 6, 9, '#5a3f28');
  R(c, W / 2 - 3, wallBot - 9, 6, 1, '#7a5634');
  // roof
  R(c, x0 - 2, roofTop, bw + 4, wallTop - roofTop, look.roof);
  for (let y = roofTop + 3; y < wallTop; y += 4) R(c, x0 - 2, y, bw + 4, 1, look.roof2);
  R(c, x0 - 2, wallTop - 2, bw + 4, 2, shade(look.roof, -25));
  if (tier >= 4) { R(c, x0 - 2, roofTop, bw + 4, 2, '#f2c14e'); R(c, x0 - 2, wallTop - 2, bw + 4, 1, '#f2c14e'); }
  // emblem plate
  const s = Math.max(1, Math.floor(Math.min(bw, wallTop - roofTop) / 14));
  const gx = W / 2 - 3.5 * s - 2, gy = roofTop + (wallTop - roofTop) / 2 - 3.5 * s - 2;
  R(c, gx, gy, 7 * s + 4, 7 * s + 4, tier >= 4 ? '#f2c14e' : '#efe7d3');
  glyph(c, look.glyph, gx + 2, gy + 2, s, tier >= 4 ? '#5a3d0c' : shade(look.roof, -40));
  // tier extras
  if (tier >= 2) { R(c, x1 - 8, roofTop - 6, 4, 7, '#7a6e60'); R(c, x1 - 9, roofTop - 7, 6, 2, '#5a5048'); }
  if (tier >= 3) { R(c, x0 + 2, roofTop + 2, 10, 6, '#2f4a6a'); R(c, x0 + 3, roofTop + 3, 8, 1, '#6a8ab0'); R(c, x0 + 3, roofTop + 5, 8, 1, '#6a8ab0'); }
  if (tier >= 4) { R(c, x0, roofTop - 10, 1, 10, '#efe7d3'); R(c, x0 + 1, roofTop - 10, 6, 4, '#c25a4a'); }
}

function shade(hex: string, d: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + d));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawStation(c: Ctx, def: PlaceDef, W: number, H: number, level: number, _r: () => number) {
  R(c, 0, 0, W, H, '#c9b48a55');
  building(c, W, H, STATION_LOOK[def.id] ?? STATION_LOOK.st_prep, level);
}

function drawFarm(c: Ctx, id: string, W: number, H: number, level: number, r: () => number) {
  const tier = tierOf(level);
  if (id === 'farm_meat') {
    R(c, 0, 0, W, H, '#8fa85a');
    // yard with animals
    R(c, W * 0.5, 4, W * 0.5 - 2, H - 8, '#9a8a5a');
    for (let x = W * 0.5; x < W - 2; x += 5) { R(c, x, 3, 2, 3, '#7a5634'); R(c, x, H - 6, 2, 3, '#7a5634'); }
    for (let k = 0; k < 2 + tier; k++) { const x = W * 0.55 + r() * (W * 0.38), y = 8 + r() * (H - 18); R(c, x, y, 6, 4, k % 2 ? '#8a5a3a' : '#e8dcc0'); R(c, x + 5, y - 1, 2, 2, '#5a3a24'); }
    building(c, Math.round(W * 0.55), H, { wall: '#b4513e', roof: '#7a3a2e', roof2: '#6a3026', glyph: 'meat' }, level, 2);
  } else if (id === 'farm_plants') {
    R(c, 0, 0, W, H, '#7a9a4a');
    for (let y = 6; y < H - 4; y += 5) for (let x = 3; x < W - 3; x += 3) R(c, x, y, 2, 2, r() < 0.5 ? '#4f8a3a' : '#6aa04e');
    // glass house
    const gx = 3, gy = -6, gw = W - 6, gh = H * 0.62;
    R(c, gx, gy, gw, gh, '#bfe2ea99');
    for (let x = gx; x <= gx + gw; x += 6) R(c, x, gy, 1, gh, '#e8f4f6');
    R(c, gx, gy, gw, 1, '#ffffff'); R(c, gx, gy + gh / 2, gw, 1, '#e8f4f6'); R(c, gx, gy + gh, gw, 2, '#7a8a8e');
    for (let k = 0; k < 6; k++) R(c, gx + 3 + r() * (gw - 6), gy + 4 + r() * (gh - 8), 3, 3, '#3f7a35');
    if (tier >= 3) R(c, gx + gw / 2 - 4, gy - 3, 8, 3, '#f2c14e');
    glyph(c, 'leaf', W / 2 - 4, H - 12, 1, '#2d5226');
  } else {
    R(c, 0, 0, W, H, '#c9b48a');
    const n = 2 + Math.min(2, tier - 1);
    for (let k = 0; k < n; k++) {
      const x = 3 + (k % 2) * (W / 2 - 1), y = 3 + Math.floor(k / 2) * (H / 2 - 1), w = W / 2 - 5, h = H / 2 - 5;
      R(c, x, y, w, h, '#5a6670'); R(c, x + 2, y + 2, w - 4, h - 4, k % 2 ? '#3f8fb5' : '#4aa0a0');
      R(c, x + 4, y + 4, w / 3, 1, '#9fd4ea');
      R(c, x + w / 2, y + h / 2, 3, 2, k % 2 ? '#e0a050' : '#c0d8a0');
    }
    glyph(c, 'fish', W / 2 - 4, H / 2 - 4, 1, '#1f4d6d');
  }
}

function drawVisitor(c: Ctx, id: string, W: number, H: number, level: number, r: () => number) {
  const tier = tierOf(level);
  if (id === 'v_kiosk' || id === 'v_bar') {
    R(c, 3, 8, W - 6, H - 11, '#e6d8b8');
    R(c, 3, H - 4, W - 6, 1, '#a08a60');
    const col = id === 'v_kiosk' ? ['#c25a4a', '#efe7d3'] : ['#3f8fb5', '#efe7d3'];
    for (let x = 1; x < W - 1; x += 4) R(c, x, 2, 4, 8, col[(x >> 2) & 1]);
    R(c, 1, 9, W - 2, 2, shade(col[0], -30));
    R(c, W / 2 - 4, 14, 8, 4, '#6f9fb8');
    glyph(c, id === 'v_kiosk' ? 'gift' : 'cup', W / 2 - 3.5, -8, 1, '#efe7d3');
    R(c, W / 2 - 5, -9, 10, 9, '#00000055');
    glyph(c, id === 'v_kiosk' ? 'gift' : 'cup', W / 2 - 3.5, -8, 1, '#f2c14e');
    if (id === 'v_bar') for (let k = 0; k < 2; k++) { const x = 4 + k * (W - 14); R(c, x + 2, H - 2, 1, 3, '#7a5634'); blob(c, x + 2, H - 4, 3, k ? '#e0a050' : '#c25a4a'); }
  } else if (id === 'v_toilet') {
    building(c, W, H, { wall: '#d8e4ea', roof: '#4a7fa8', roof2: '#3d6c90', glyph: 'wc' }, level, 2);
  } else if (id === 'v_restaurant') {
    building(c, W, H * 0.8, { wall: '#efe0c0', roof: '#b84a3a', roof2: '#a03e30', glyph: 'fork' }, level);
    for (let k = 0; k < 3; k++) { const x = 6 + k * (W - 12) / 2.5; R(c, x, H - 7, 6, 4, '#8a6a3a'); blob(c, x + 3, H - 9, 3, '#efe7d3'); }
  } else if (id === 'v_view') {
    R(c, 4, H - 6, W - 8, 4, '#00000033');
    R(c, W / 2 - 5, -14, 10, H + 10, '#8a8374'); R(c, W / 2 - 5, -14, 2, H + 10, '#a49d8c');
    R(c, W / 2 - 9, -24, 18, 10, '#6c675c'); R(c, W / 2 - 10, -26, 20, 3, '#4a463e');
    R(c, W / 2 - 7, -21, 14, 4, '#9fd4ea');
    glyph(c, 'eye', W / 2 - 3.5, H - 14, 1, '#efe7d3');
  } else if (id === 'v_balloon') {
    R(c, 4, H - 10, W - 8, 8, '#8a6a3a'); R(c, 6, H - 9, W - 12, 6, '#c9a26a');
    for (const dx of [-6, 6]) R(c, W / 2 + dx, -6, 1, H - 4, '#5a4632');
    R(c, W / 2 - 5, H - 16, 10, 7, '#7a5634');
    const bx = W / 2, by = -26;
    blob(c, bx, by, 15, '#c25a4a');
    for (let k = -12; k <= 12; k += 6) R(c, bx + k - 1, by - 13 + Math.abs(k) / 2, 3, 26 - Math.abs(k), '#efe7d3');
    R(c, bx - 9, by - 8, 4, 3, '#ffffff55');
    if (tier >= 3) R(c, bx - 2, by - 17, 4, 3, '#f2c14e');
  } else if (id === 'v_hotel') {
    R(c, 4, H - 4, W - 8, 4, '#00000033');
    const top = -22;
    R(c, 4, top, W - 8, H - top - 3, '#e6dcc4');
    for (let y = top + 4; y < H - 10; y += 7) for (let x = 8; x < W - 10; x += 7) R(c, x, y, 4, 4, r() < 0.3 ? '#f2d98a' : '#6f9fb8');
    R(c, 2, top - 3, W - 4, 4, tier >= 4 ? '#f2c14e' : '#7a6a58');
    R(c, W / 2 - 4, H - 11, 8, 8, '#5a3f28');
    glyph(c, 'bed', W / 2 - 3.5, top + 2, 1, '#7a6a58');
  }
}

function drawDecor(c: Ctx, id: string, W: number, H: number, r: () => number) {
  const cx = W / 2, cy = H / 2;
  switch (id) {
    case 'd_fern': for (let k = -5; k <= 5; k += 2) R(c, cx + k, cy - 6 + Math.abs(k), 1, 8 - Math.abs(k) / 2, k % 4 ? '#3f7a35' : '#5f9a45'); R(c, cx - 1, cy + 1, 2, 5, '#6e4f30'); break;
    case 'd_cycad': R(c, cx - 1, cy - 1, 3, 7, '#8a6a3a'); for (const [dx, dy] of [[-6, -4], [6, -4], [-4, -7], [4, -7], [0, -8]]) R(c, cx + Math.min(0, dx), cy + dy, Math.abs(dx) || 2, 2, '#4f8a3a'); break;
    case 'd_bush': blob(c, cx, cy + 1, 5, '#4f8a3a'); blob(c, cx - 3, cy - 1, 3, '#5f9a45'); R(c, cx + 1, cy - 2, 2, 2, '#e07a7a'); break;
    case 'd_flowers': R(c, 2, 4, W - 4, H - 6, '#6a4a2c'); for (let k = 0; k < 10; k++) R(c, 3 + r() * (W - 7), 5 + r() * (H - 9), 2, 2, ['#e07a7a', '#f2c14e', '#b98be3', '#efe7d3'][k % 4]); break;
    case 'd_bench': R(c, 2, cy, W - 4, 3, '#9a7246'); R(c, 2, cy - 4, W - 4, 2, '#7a5634'); R(c, 3, cy + 3, 2, 3, '#4a3a2a'); R(c, W - 5, cy + 3, 2, 3, '#4a3a2a'); break;
    case 'd_lamp': R(c, cx - 1, cy - 8, 2, 14, '#3a3a3a'); R(c, cx - 3, cy - 11, 6, 4, '#f2d98a'); R(c, cx - 3, cy - 12, 6, 1, '#3a3a3a'); break;
    case 'd_rock': blob(c, cx, cy + 1, 5, '#8d8a80'); R(c, cx - 3, cy - 3, 4, 1, '#b0ad9f'); R(c, cx, cy + 3, 4, 2, '#6f6c64'); break;
    case 'd_araucaria': R(c, cx - 1, cy - 2, 3, 16, '#6e4f30'); for (let k = 0; k < 5; k++) R(c, cx - 2 - k * 2, cy - 18 + k * 5, 5 + k * 4, 3, k % 2 ? '#2f5f2a' : '#3a7034'); break;
    case 'd_ginkgo': R(c, cx - 1, cy, 3, 14, '#6e4f30'); blob(c, cx, cy - 8, 11, '#c9b040'); blob(c, cx - 4, cy - 11, 5, '#e0c850'); break;
    case 'd_sign': R(c, cx - 1, cy - 2, 2, 9, '#6e4f30'); R(c, cx - 6, cy - 8, 12, 7, '#9a7246'); R(c, cx - 4, cy - 6, 8, 1, '#efe7d3'); R(c, cx - 4, cy - 4, 6, 1, '#efe7d3'); break;
    case 'd_pond': blob(c, cx, cy, 12, '#6a5a40'); blob(c, cx, cy, 10, '#4a7f86'); R(c, cx - 5, cy - 3, 6, 1, '#79aeb2'); R(c, cx + 3, cy + 2, 3, 2, '#5f9a45'); break;
    case 'd_fountain': blob(c, cx, cy + 2, 12, '#a49d8c'); blob(c, cx, cy + 2, 10, '#5aa0bf'); R(c, cx - 2, cy - 8, 4, 10, '#b8b3a5'); R(c, cx - 1, cy - 12, 2, 4, '#bfe2ea'); R(c, cx - 4, cy - 10, 1, 3, '#bfe2ea'); R(c, cx + 3, cy - 10, 1, 3, '#bfe2ea'); break;
    case 'd_statue': R(c, cx - 8, cy + 4, 16, 6, '#8a8374'); R(c, cx - 8, cy + 4, 16, 1, '#b8b3a5');
      // a little sauropod silhouette
      R(c, cx - 6, cy - 4, 10, 6, '#9a958a'); R(c, cx + 2, cy - 14, 3, 11, '#9a958a'); R(c, cx + 2, cy - 15, 5, 3, '#9a958a'); R(c, cx - 11, cy - 2, 6, 2, '#9a958a');
      R(c, cx - 5, cy + 2, 2, 3, '#857f72'); R(c, cx + 1, cy + 2, 2, 3, '#857f72'); break;
    case 'd_waterfall': R(c, 0, cy - 10, W, H / 2 + 10, '#7b7a6e'); blob(c, cx, cy + 6, 11, '#4a7f86'); R(c, cx - 4, cy - 10, 8, 16, '#bfe2ea'); R(c, cx - 2, cy - 10, 1, 16, '#ffffff'); R(c, cx - 8, cy + 6, 16, 2, '#e8f4f6'); break;
    case 'd_amber': R(c, cx - 7, cy + 6, 14, 5, '#8a8374'); R(c, cx - 4, cy - 16, 8, 22, '#e09a2e'); R(c, cx - 3, cy - 18, 6, 2, '#f2c14e'); R(c, cx - 2, cy - 12, 2, 10, '#f6d38d'); R(c, cx, cy - 6, 2, 2, '#7a4a1a'); break;
  }
}

function drawGate(c: Ctx, W: number, H: number) {
  R(c, 0, 0, W, H, '#c9b48a');
  for (let x = 0; x < W; x += 4) R(c, x, H - 6, 3, 6, '#9a7246');
  R(c, 0, H - 7, W, 1, '#6e4f30');
  // arch
  R(c, 6, -8, 4, H + 2, '#7a5634'); R(c, W - 10, -8, 4, H + 2, '#7a5634');
  R(c, 3, -11, W - 6, 5, '#a0623e'); R(c, 3, -11, W - 6, 1, '#c9875a');
  R(c, W / 2 - 10, -10, 20, 3, '#efe7d3');
  for (let x = W / 2 - 8; x < W / 2 + 8; x += 3) R(c, x, -9, 2, 1, '#6e4f30');
  R(c, 12, 2, 2, 6, '#3f7a35'); R(c, W - 14, 2, 2, 6, '#3f7a35');
}

/** a small picture of a definition for the build bar */
export function thumbOf(def: PlaceDef, maxW = 56, maxH = 46): HTMLCanvasElement {
  const level = def.cat === 'station' ? 1 : 1;
  const [w, h] = def.size(level);
  const art = objectArt(def, { level, w, h, pens: def.cat === 'enclosure' ? 2 : undefined, seed: 1 });
  const k = Math.min(maxW / art.width, maxH / art.height, 2);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(art.width * k));
  cv.height = Math.max(1, Math.round(art.height * k));
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(art, 0, 0, cv.width, cv.height);
  return cv;
}

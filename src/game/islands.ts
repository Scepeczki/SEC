// Island terrain: generated deterministically from the island definition (never stored in the save).
// Tiles: deep water, shallow water, sand, land. Land outside the cleared chunks is covered by wild growth
// (jungle, rocks or marsh) that the player clears 4×4 chunk by chunk.

import { CHUNK, ISLAND_BY_ID, type Biome, type IslandDef } from './parkContent';

export const Tile = { Deep: 0, Shallow: 1, Sand: 2, Land: 3 } as const;
export const Wild = { None: 0, Jungle: 1, Rocks: 2, Marsh: 3 } as const;

export interface Terrain {
  def: IslandDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** wild cover type of each tile (what you would see if its chunk is not cleared) */
  wild: Uint8Array;
  /** small per-tile variation 0–255 for drawing */
  vary: Uint8Array;
  cw: number;
  ch: number;
  /** chunks that hold any sand or land */
  landChunks: Set<number>;
  /** chunks clear from the start */
  startChunks: Set<number>;
  /** top-left of the gate (4×2) */
  gate: [number, number];
}

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(seed, x0, y0), b = hash(seed, x0 + 1, y0), c = hash(seed, x0, y0 + 1), d = hash(seed, x0 + 1, y0 + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

const fbm = (seed: number, x: number, y: number) => valueNoise(seed, x, y) * 0.6 + valueNoise(seed + 7, x * 2.1, y * 2.1) * 0.3 + valueNoise(seed + 13, x * 4.3, y * 4.3) * 0.1;

const WILD_MIX: Record<Biome, [number, number, number]> = {
  // jungle, rocks, marsh weights
  meadow: [0.75, 0.25, 0],
  marsh: [0.35, 0.05, 0.6],
  reef: [0.7, 0.3, 0],
  cliffs: [0.25, 0.75, 0],
  volcanic: [0.35, 0.65, 0],
  mainland: [0.5, 0.3, 0.2],
};

const cache = new Map<number, Terrain>();

export function terrain(islandId: number): Terrain {
  let t = cache.get(islandId);
  if (t) return t;
  const def = ISLAND_BY_ID.get(islandId)!;
  const { w, h } = def;
  const seed = islandId * 9973;
  const tiles = new Uint8Array(w * h), wild = new Uint8Array(w * h), vary = new Uint8Array(w * h);
  const p1 = hash(seed, 1, 0) * 6.28, p2 = hash(seed, 2, 0) * 6.28, p3 = hash(seed, 3, 0) * 6.28;
  const cx = w / 2, cy = h / 2;
  const mix = WILD_MIX[def.biome];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / (w / 2), dy = (y + 0.5 - cy) / (h / 2);
    const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const edge = 0.84 + 0.06 * Math.sin(3 * a + p1) + 0.04 * Math.sin(5 * a + p2) + 0.025 * Math.sin(8 * a + p3) + 0.06 * (fbm(seed, x / 6, y / 6) - 0.5);
    const i = y * w + x;
    tiles[i] = r < edge - 0.08 ? Tile.Land : r < edge ? Tile.Sand : r < edge + 0.09 ? Tile.Shallow : Tile.Deep;
    const n = fbm(seed + 31, x / 5, y / 5);
    wild[i] = n < mix[0] ? Wild.Jungle : n < mix[0] + mix[1] ? Wild.Rocks : Wild.Marsh;
    if (tiles[i] === Tile.Sand && wild[i] === Wild.Marsh) wild[i] = Wild.Jungle;
    vary[i] = Math.floor(hash(seed + 5, x, y) * 256);
  }
  // keep the border of the map always water
  for (let x = 0; x < w; x++) { tiles[x] = Tile.Deep; tiles[(h - 1) * w + x] = Tile.Deep; }
  for (let y = 0; y < h; y++) { tiles[y * w] = Tile.Deep; tiles[y * w + w - 1] = Tile.Deep; }

  const cw = Math.ceil(w / CHUNK), ch = Math.ceil(h / CHUNK);
  const landChunks = new Set<number>(), startChunks = new Set<number>();
  for (let cy2 = 0; cy2 < ch; cy2++) for (let cx2 = 0; cx2 < cw; cx2++) {
    let land = 0;
    for (let y = cy2 * CHUNK; y < Math.min(h, cy2 * CHUNK + CHUNK); y++) for (let x = cx2 * CHUNK; x < Math.min(w, cx2 * CHUNK + CHUNK); x++) if (tiles[y * w + x] >= Tile.Sand) land++;
    if (!land) continue;
    const c = cy2 * cw + cx2;
    landChunks.add(c);
    const dx = ((cx2 + 0.5) * CHUNK - cx) / (w / 2), dy = ((cy2 + 0.5) * CHUNK - cy) / (h / 2);
    if (Math.hypot(dx, dy) < def.startClear) startChunks.add(c);
  }
  // gate: the lowest 4×2 spot on the middle column that is clear from the start
  let gate: [number, number] = [Math.floor(cx) - 2, Math.floor(cy)];
  const gx = Math.floor(cx) - 2;
  outer: for (let y = h - 3; y > 0; y--) {
    for (let yy = y; yy < y + 2; yy++) for (let xx = gx; xx < gx + 4; xx++) {
      const i = yy * w + xx;
      if (tiles[i] < Tile.Sand || !startChunks.has(Math.floor(yy / CHUNK) * cw + Math.floor(xx / CHUNK))) continue outer;
    }
    gate = [gx, y];
    break;
  }
  t = { def, w, h, tiles, wild, vary, cw, ch, landChunks, startChunks, gate };
  cache.set(islandId, t);
  return t;
}

export const chunkOf = (t: Terrain, x: number, y: number) => Math.floor(y / CHUNK) * t.cw + Math.floor(x / CHUNK);
export const inside = (t: Terrain, x: number, y: number) => x >= 0 && y >= 0 && x < t.w && y < t.h;
export const isWater = (t: Terrain, x: number, y: number) => !inside(t, x, y) || t.tiles[y * t.w + x] <= Tile.Shallow;

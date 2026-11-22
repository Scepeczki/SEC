// Dig sites (dig 2.0): layer generation, the brush, chain reactions, the player's own modifiers, crews, chests.
//
// Every layer is a small puzzle. Tiles take a few brush strokes to break — but some carry a modifier, and a
// tile with a modifier sets off others when it breaks (arrows, blasts, veins, keystones, resonance, links).
// Everything that breaks from one manual break is one chain; a long chain is a combo with a reward multiplier.
// Whether you plan the perfect chain or just smash modifiers as they come is up to you.

import { GENERA, SITE_BY_ID } from '../data/db';
import { B } from './balance';
import { START_SITE } from './content';
import { type Mods, mods } from './mods';
import {
  type ChestTier, type CrewMode, type Dir, type FindEntry, type GameState, type LayerItem, type LayerOutcome, type Loot, type ModKind, type PendingChest,
  type PlayerTool, type Quality, type SiteState, type Tile, log, rand,
} from './state';
import type { Food } from '../data/types';
import { addFame, onFossilFound } from './meta';
import { MINERAL_BY_ID, mineralWeights } from './geology';

const SHAPES: number[][][] = [
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
];
const SHAPES_BY_Q: number[][][][] = [
  SHAPES.filter((s) => s.length === 2),
  SHAPES.filter((s) => s.length === 3),
  SHAPES.filter((s) => s.length === 4),
];

function pickWeighted<T>(s: GameState, items: T[], w: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += w(it);
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const it of items) { r -= w(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

/** layer size in tiles (saves from before 0.4 have no size: the old 10 × 7) */
export const dims = (st: { w?: number; h?: number }) => ({ w: st.w ?? B.gridW, h: st.h ?? B.gridH });

export function siteState(s: GameState, siteId: string): SiteState {
  let st = s.sites[siteId];
  if (!st) {
    st = { depth: 0, tiles: [], items: [], layersDone: 0, fossilsFound: 0 };
    s.sites[siteId] = st;
    generateLayer(s, siteId);
  }
  return st;
}

/** most common rarity-0 genus at a site (used for the tutorial layer) */
export function tutorialGenus(siteId: string): number | undefined {
  const site = SITE_BY_ID.get(siteId);
  return site?.fauna.find((f) => GENERA.get(f.genusId)?.rarity === 0)?.genusId;
}

/**
 * how often a genus turns up in the rock: PBDB occurrences, rarity, depth — and much less often once its genome
 * is complete, so new and unfinished species come up more
 */
export function faunaWeight(s: GameState, genusId: number, occ: number, depth: number, m: Mods): number {
  const g = GENERA.get(genusId);
  if (!g) return 0;
  const r = g.rarity;
  const done = (s.genome[genusId] ?? 0) >= 100 ? B.fullGenomeWeight : 1;
  return Math.pow(occ, 0.6) * B.rarityWeight[r] * (r ? m.rareBoost : 1) * (1 + depth * B.rarityDepthBonus[r] * m.rarityDepthMult) * done;
}

const MOD_ORDER: ModKind[] = ['arrow', 'bomb', 'key', 'vein', 'echo', 'gem'];

export function generateLayer(s: GameState, siteId: string, m: Mods = mods(s)): void {
  const st = s.sites[siteId];
  const site = SITE_BY_ID.get(siteId)!;
  const W = m.gridW, H = m.gridH;
  st.w = W;
  st.h = H;
  const area = (W * H) / (B.gridW * B.gridH);
  const hp = B.tileHp * (1 + st.depth * B.tileHpPerDepth) * Math.pow(B.tileHpExp, st.depth);
  st.tiles = Array.from({ length: W * H }, () => {
    const h = Math.max(1, Math.round(hp * (0.75 + rand(s) * 0.5)));
    return { hp: h, max: h, item: -1 };
  });
  st.items = [];
  const place = (cells: number[][], item: LayerItem): boolean => {
    for (let tries = 0; tries < 60; tries++) {
      const ox = Math.floor(rand(s) * W), oy = Math.floor(rand(s) * H);
      const idx: number[] = [];
      let ok = true;
      for (const [dx, dy] of cells) {
        const x = ox + dx, y = oy + dy;
        if (x >= W || y >= H || st.tiles[y * W + x].item !== -1) { ok = false; break; }
        idx.push(y * W + x);
      }
      if (!ok) continue;
      item.cells = idx;
      const n = st.items.push(item) - 1;
      idx.forEach((i) => (st.tiles[i].item = n));
      return true;
    }
    return false;
  };
  const tutorial = siteId === START_SITE && s.stats.layers === 0 && st.depth === 0 ? tutorialGenus(siteId) : undefined;
  const shift = m.qualityShift + st.depth * B.qualityDepthShift;
  // how many finds a layer holds varies (never shown to the player: you only see what you dig out); bigger layers hold more
  const fossilCount = tutorial !== undefined ? 4 : Math.max(1, Math.round((m.fossilsPerLayer - 1 + Math.floor(rand(s) * 3) + (rand(s) < st.depth * 0.01 ? 1 : 0)) * area));
  const minorCount = Math.round((1 + Math.floor(rand(s) * (2 + Math.min(4, site.minorFossils.length / 4)))) * area);
  const amberCount = rand(s) < m.amberChance * area ? (rand(s) < 0.15 ? 2 : 1) : 0;
  const mineralCount = rand(s) < mineralChanceAt(st.depth) * m.mineralMult * area * (isTreasure(st.depth) ? 1.5 : 1) ? (rand(s) < 0.2 ? 2 : 1) : 0;
  for (let i = 0; i < fossilCount; i++) {
    let genusId: number | undefined;
    let quality: Quality;
    if (tutorial !== undefined) {
      genusId = tutorial;
      quality = 2;
    } else {
      genusId = pickWeighted(s, site.fauna, (f) => faunaWeight(s, f.genusId, f.occ, st.depth, m))?.genusId;
      const p2 = Math.min(0.35, B.qualityOdds[2] + shift);
      const p1 = Math.min(0.45, B.qualityOdds[1] + shift);
      const r = rand(s);
      quality = (r < p2 ? 2 : r < p2 + p1 ? 1 : 0) as Quality;
    }
    if (genusId === undefined) continue;
    const shapes = SHAPES_BY_Q[quality];
    place(shapes[Math.floor(rand(s) * shapes.length)], { kind: 'fossil', genusId, quality, cells: [], found: false });
  }
  for (let i = 0; i < minorCount; i++) {
    const mf = pickWeighted(s, site.minorFossils, (x) => Math.sqrt(x.occ));
    place([[0, 0]], { kind: 'minor', minorName: mf ? `${mf.name} (${mf.group})` : 'skamieniałość', quality: 0, cells: [], found: false });
  }
  for (let i = 0; i < amberCount; i++) place([[0, 0]], { kind: 'amber', quality: 0, cells: [], found: false });
  for (let i = 0; i < mineralCount; i++) {
    const mn = pickWeighted(s, mineralWeights(siteId, st.depth), ([, w]) => w)?.[0];
    if (mn) place([[0, 0]], { kind: 'mineral', mineralId: mn.id, quality: 0, cells: [], found: false });
  }
  // flint grows with depth: chains stop at it, so deep layers stay a puzzle
  const plain = st.tiles.map((t, i) => (t.item < 0 ? i : -1)).filter((i) => i >= 0);
  const flint = flintRate(st.depth);
  if (flint) for (const i of plain) if (rand(s) < flint) { const t = st.tiles[i]; t.flint = true; t.hp = t.max = t.max * 1.5; }
  // rock modifiers (workshop „Skała”): only on plain rock, so finds and modifiers never share a tile
  for (const k of MOD_ORDER) {
    const rate = m.modRate[k] * (isTreasure(st.depth) ? 2 : 1);
    if (!rate) continue;
    const want = Math.floor(plain.length * rate + rand(s));
    for (let n = 0; n < want; n++) {
      const free = plain.filter((i) => !st.tiles[i].mod && !st.tiles[i].flint);
      if (!free.length) break;
      const t = st.tiles[free[Math.floor(rand(s) * free.length)]];
      t.mod = k;
      if (k === 'arrow') t.dir = Math.floor(rand(s) * 4) as Dir;
    }
  }
  st.manual = 0;
  st.best = 0;
  st.combo = undefined;
  st.uses = { ...m.uses };
}

/** share of plain tiles that are flint: none near the surface, then more and more (max 22%) */
export const flintRate = (depth: number) => Math.max(0, Math.min(0.22, (depth - 5) * 0.006));

// ---------------------------------------------------------------- chain reactions

/** what broke a tile: your brush, a crew, a modifier or a link */
export type Cause = 'hit' | 'crew' | 'link' | ModKind;
export interface ChainStep { idx: number; gen: number; cause: Cause; from: number }

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
export const DIR_NAMES = ['w prawo', 'w dół', 'w lewo', 'w górę'] as const;

/**
 * Break `starts` and everything they set off, wave by wave (gen 0 = the start tiles).
 * Works on any tile array, so the UI can preview a chain on a copy. `onBreak` runs for every broken tile.
 */
export function runChain(tiles: Tile[], w: number, h: number, m: Mods, starts: { idx: number; cause: Cause }[], onBreak?: (idx: number) => void): { steps: ChainStep[]; gems: number } {
  const steps: ChainStep[] = [];
  let gems = 0;
  const brk = (idx: number, gen: number, cause: Cause, from: number) => {
    const t = tiles[idx];
    if (!t || t.hp <= 0) return;
    if (t.flint && gen > 0 && cause !== 'bomb') return; // flint stops a chain; only a blast cracks it
    t.hp = 0;
    steps.push({ idx, gen, cause, from });
    onBreak?.(idx);
  };
  for (const s0 of starts) brk(s0.idx, 0, s0.cause, -1);
  for (let k = 0; k < steps.length; k++) {
    const { idx, gen } = steps[k];
    const t = tiles[idx];
    const x = idx % w, y = (idx / w) | 0, g = gen + 1;
    if (t.link !== undefined) brk(t.link, g, 'link', idx);
    switch (t.mod) {
      case 'arrow': {
        const d = t.dir ?? 0;
        for (let r = 1; r <= m.arrowReach; r++) {
          const nx = x + DX[d] * r, ny = y + DY[d] * r;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
          brk(ny * w + nx, g, 'arrow', idx);
        }
        break;
      }
      case 'bomb': {
        const R = m.bombRadius;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          if (R > 1 && Math.abs(dx) + Math.abs(dy) > 3) continue; // the big blast is a rounded 5×5
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) brk(ny * w + nx, g, 'bomb', idx);
        }
        break;
      }
      case 'key': {
        // only when this was the last rock standing in its row
        let alone = true;
        for (let xx = 0; xx < w; xx++) if (xx !== x && tiles[y * w + xx].hp > 0) { alone = false; break; }
        if (alone) for (let yy = 0; yy < h; yy++) brk(yy * w + x, g, 'key', idx);
        break;
      }
      case 'vein': {
        // flood through the empty space this tile opens onto; every rock touching that space breaks
        const seen = new Uint8Array(w * h);
        const stack = [idx];
        seen[idx] = 1;
        const hit: number[] = [];
        while (stack.length) {
          const c = stack.pop()!;
          const cx = c % w, cy = (c / w) | 0;
          for (let d = 0; d < 4; d++) {
            const nx = cx + DX[d], ny = cy + DY[d];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (seen[n]) continue;
            seen[n] = 1;
            if (tiles[n].hp <= 0) stack.push(n);
            else hit.push(n);
          }
        }
        for (const n of hit) brk(n, g, 'vein', idx);
        break;
      }
      case 'echo': {
        // sets off the nearest other modifiers still in the rock (deterministic, so the preview never lies)
        const cand = tiles.map((tt, i) => (tt.hp > 0 && tt.mod ? i : -1)).filter((i) => i >= 0)
          .sort((a, b) => (Math.abs((a % w) - x) + Math.abs(((a / w) | 0) - y)) - (Math.abs((b % w) - x) + Math.abs(((b / w) | 0) - y)) || a - b);
        for (const n of cand.slice(0, m.echoCount)) brk(n, g, 'echo', idx);
        break;
      }
      case 'gem':
        gems++;
        break;
    }
  }
  return { steps, gems };
}

/** tiles that would break if `starts` broke now (for the hover preview) */
export function previewChain(st: SiteState, starts: number[], m: Mods): ChainStep[] {
  const { w, h } = dims(st);
  const copy = st.tiles.map((t) => ({ ...t }));
  return runChain(copy, w, h, m, starts.filter((i) => copy[i]?.hp > 0).map((idx) => ({ idx, cause: 'hit' as Cause })), undefined).steps;
}

/** reward multiplier of a chain of n tiles (with crystals in it) */
export function comboMult(n: number, m: Mods, gems = 0): number {
  if (n < m.comboMin) return 1;
  // grows with every tile up to 15 over the threshold, then stays (shards already grow with the chain's length)
  const over = Math.min(15, n - m.comboMin + 1);
  let k = 1 + m.comboStep * over;
  if (m.comboCap && n >= 20) k *= 1.5;
  return k * Math.pow(2, Math.min(2, gems));
}

export interface ComboLoot { kind: 'coins' | 'pb' | 'mutagen' | 'mineral'; amount: number; at: number; mineralId?: string }
export interface ComboResult {
  /** tiles in the whole combo so far (over several breaks with „Dwutakt”) */
  n: number;
  /** tiles this break added */
  added: number;
  mult: number;
  gems: number;
  /** the combo can still go on with the next manual break */
  open: boolean;
  loot: ComboLoot[];
  /** tool uses given back („Oszczędna ręka”) */
  refund: boolean;
  quake: boolean;
  record: boolean;
}
export interface HitResult {
  collected: LayerItem[];
  layerDone: boolean;
  crit: boolean;
  /** shards earned by this hit */
  shards?: number;
  /** everything that broke, wave by wave (empty when the hit only cracked the rock) */
  steps: ChainStep[];
  combo?: ComboResult;
}

/**
 * The epoch rhythm (5 layers, chest at the end): a lean layer after the chest, two ordinary ones, a richer one and the
 * treasure layer — so progress comes in waves: calm, normal, and a moment where you can suddenly buy a lot.
 */
export const RICHNESS = [0.7, 1, 1, 1.5, 4] as const;
export const richness = (depth: number) => RICHNESS[depth % B.chestEvery] ?? 1;
/** the last layer of an epoch: shards ×4, twice the modifiers, more minerals */
export const isTreasure = (depth: number) => depth % B.chestEvery === B.chestEvery - 1;

/** rock shards for one broken tile at this depth (with the epoch rhythm) */
export const shardValue = (depth: number) => (1.5 + depth * 0.03) * richness(depth);

/** coins / research points of minor finds and minerals scale with the multiplier of the chain that dug them out */
function collect(s: GameState, siteId: string, st: SiteState, it: LayerItem, m: Mods, byCrew: boolean, mult = 1) {
  it.found = true;
  const f: FindEntry = { kind: it.kind, genusId: it.genusId, name: it.minorName, quality: it.quality, siteId, byCrew, t: s.now };
  if (it.kind === 'fossil' && it.genusId !== undefined) {
    st.fossilsFound++;
    s.stats.fossils++;
    f.isNew = !s.discovered[it.genusId];
    const pb0 = s.pb;
    onFossilFound(s, it.genusId, it.quality, siteId, m, byCrew);
    if (s.pb > pb0) f.pb = s.pb - pb0; // gene bank turned it into research points
  } else if (it.kind === 'minor') {
    f.pb = B.minorPB * (1 + st.depth * 0.05) * mult;
    f.coins = B.minorCoins * (1 + st.depth * 0.1) * mult;
    s.pb += f.pb;
    s.coins += f.coins;
    s.stats.minor++;
  } else if (it.kind === 'amber') {
    f.mutagen = 1;
    s.mutagen += 1;
    s.stats.amber++;
    log(s, 'Znaleziono bursztyn z mutagenem!', 'good');
  } else if (it.kind === 'mineral' && it.mineralId) {
    const mn = MINERAL_BY_ID.get(it.mineralId);
    f.mineral = it.mineralId;
    f.name = mn?.name;
    f.isNew = !(s.minerals ??= {})[it.mineralId];
    s.minerals[it.mineralId] = (s.minerals[it.mineralId] ?? 0) + 1;
    f.coins = Math.round((mn?.coins ?? 20) * (1 + st.depth * 0.08) * mult);
    s.coins += f.coins;
    if (mn && mn.rarity >= 2) log(s, `Rzadki minerał: ${mn.name}!`, 'good');
  }
  (s.finds ??= []).unshift(f);
  if (s.finds.length > 60) s.finds.length = 60;
}

/** after a break: collect every find whose tiles are all dug out */
function collectOpened(s: GameState, siteId: string, st: SiteState, broken: number[], m: Mods, byCrew: boolean, mult: number, out: LayerItem[]) {
  for (const idx of broken) {
    const t = st.tiles[idx];
    if (t.item < 0) continue;
    const it = st.items[t.item];
    if (!it.found && it.cells.every((c) => st.tiles[c].hp <= 0)) {
      collect(s, siteId, st, it, m, byCrew, mult);
      out.push(it);
    }
  }
}

/** depth in metres shown to the player */
export const depthMeters = (depth: number) => depth * B.metersPerLayer;

/** a layer is finished only when every single tile has been dug out */
export const layerCleared = (st: SiteState) => st.tiles.every((t) => t.hp <= 0);

export const layerShards = (depth: number) => Math.round(25 * (1 + depth * 0.1));

/** tiles the brush touches at idx: one, two (with the tile on the right) or a 2×2 square */
export function brushCells(st: SiteState, idx: number, area: number): number[] {
  const { w, h } = dims(st);
  const x = idx % w, y = (idx / w) | 0;
  const out = [idx];
  if (area >= 1 && x + 1 < w) out.push(idx + 1);
  if (area >= 2 && y + 1 < h) { out.push(idx + w); if (x + 1 < w) out.push(idx + w + 1); }
  return out.filter((c) => st.tiles[c]?.hp > 0);
}

const LOOT_AT = [10, 15, 25];

/** a manual brush stroke at idx: damage, maybe a break, and everything the break sets off */
export function hitTile(s: GameState, siteId: string, idx: number, m: Mods = mods(s)): HitResult {
  const st = siteState(s, siteId);
  const { w, h } = dims(st);
  const res: HitResult = { collected: [], layerDone: false, crit: false, steps: [] };
  s.stats.clicks++;
  const cells = brushCells(st, idx, m.brushArea);
  if (!cells.length) return res;
  res.crit = !!m.critBrush && rand(s) < m.critBrush;
  const starts: { idx: number; cause: Cause }[] = [];
  for (const c of cells) {
    const t = st.tiles[c];
    t.hp = Math.max(0, t.hp - (res.crit ? Infinity : m.brushPower));
    if (t.hp <= 0) { t.hp = 1e-9; starts.push({ idx: c, cause: 'hit' }); } // runChain does the actual break
  }
  if (!starts.length) return res;
  const { steps, gems } = runChain(st.tiles, w, h, m, starts);
  res.steps = steps;
  st.manual = (st.manual ?? 0) + 1;
  // ---- combo: this break alone, or the continuation of an open one („Dwutakt”)
  const n = steps.length;
  const prev = st.combo && st.combo.left > 0 ? st.combo : undefined;
  const total = (prev?.n ?? 0) + n;
  const allGems = (prev?.gems ?? 0) + gems;
  const left = prev ? prev.left - 1 : m.comboCarry;
  st.combo = left > 0 ? { n: total, left, gems: allGems } : undefined;
  const mult = comboMult(total, m, allGems);
  const before = prev?.n ?? 0;
  const crossed = (at: number) => before < at && total >= at;
  const shards = n * shardValue(st.depth) * m.shardMult * mult;
  s.shards = (s.shards ?? 0) + shards;
  res.shards = shards;
  // finds share a little of the chain bonus (shards get all of it)
  collectOpened(s, siteId, st, steps.map((x) => x.idx), m, false, Math.min(3, 1 + (mult - 1) * 0.25), res.collected);
  const combo: ComboResult = { n: total, added: n, mult, gems: allGems, open: left > 0, loot: [], refund: false, quake: false, record: false };
  if (total >= m.comboMin) {
    const k = m.comboLoot, d = st.depth;
    if (k && crossed(LOOT_AT[0])) { const a = Math.round(20 * total * (1 + d * 0.1) * k); s.coins += a; combo.loot.push({ kind: 'coins', amount: a, at: 10 }); }
    if (k && crossed(LOOT_AT[1])) { const a = Math.round(3 * (1 + d * 0.05) * k * (total / 15)); s.pb += a; combo.loot.push({ kind: 'pb', amount: a, at: 15 }); }
    if (k && crossed(LOOT_AT[2])) {
      if (k >= 2 && rand(s) < 0.5) { s.mutagen += 1; combo.loot.push({ kind: 'mutagen', amount: 1, at: 25 }); }
      else if (k >= 2) {
        const mn = pickWeighted(s, mineralWeights(siteId, d), ([x, wt]) => wt * (1 + x.rarity))?.[0];
        if (mn) {
          (s.minerals ??= {})[mn.id] = (s.minerals[mn.id] ?? 0) + 1;
          const a = Math.round(mn.coins * (1 + d * 0.08));
          s.coins += a;
          combo.loot.push({ kind: 'mineral', amount: a, at: 25, mineralId: mn.id });
        }
      } else { const a = Math.round(40 * total * (1 + d * 0.1)); s.coins += a; combo.loot.push({ kind: 'coins', amount: a, at: 25 }); }
    }
    if (m.thriftAt && crossed(m.thriftAt)) {
      for (const k2 of Object.keys(m.uses) as PlayerTool[]) if (m.uses[k2] > 0) (st.uses ??= {})[k2] = Math.min(m.uses[k2], (st.uses?.[k2] ?? 0) + 1);
      combo.refund = true;
    }
    if (m.quake && crossed(12)) {
      for (const t of st.tiles) if (t.hp > 0) t.hp = Math.max(t.max * 0.05, t.hp - t.max * m.quake);
      combo.quake = true;
    }
  }
  st.best = Math.max(st.best ?? 0, total);
  const rec = (s.digRecords ??= { combo: 0, fewest: 0, oneHit: 0, stars3: 0 });
  if (total > rec.combo) { combo.record = total >= 5 && rec.combo > 0; rec.combo = total; }
  res.combo = combo;
  checkLayer(s, siteId, st, m, res);
  return res;
}

// ---------------------------------------------------------------- the player's own modifiers („Ręka geologa”)

export interface ToolCheck { ok: boolean; why?: string }
const usesLeft = (st: SiteState, t: PlayerTool) => st.uses?.[t] ?? 0;
const spend = (st: SiteState, t: PlayerTool) => { (st.uses ??= {})[t] = usesLeft(st, t) - 1; };

/** can the tool be used on tile a (and, for two-step tools, b)? */
export function canUseTool(st: SiteState, tool: PlayerTool, a: number, b?: number): ToolCheck {
  const ta = st.tiles[a];
  if (usesLeft(st, tool) <= 0) return { ok: false, why: 'Brak użyć w tej warstwie' };
  if (!ta || ta.hp <= 0) return { ok: false, why: 'Tu nie ma już kamienia' };
  switch (tool) {
    case 'bomb': return ta.mod ? { ok: false, why: 'Ten kamień ma już modyfikator' } : { ok: true };
    case 'rotate': return ta.mod === 'arrow' ? { ok: true } : { ok: false, why: 'Obrócić można tylko strzałkę' };
    case 'link':
      if (b === undefined) return { ok: true };
      if (b === a) return { ok: false, why: 'Wybierz inny kamień' };
      return st.tiles[b]?.hp > 0 ? { ok: true } : { ok: false, why: 'Tu nie ma już kamienia' };
    case 'move':
    case 'copy':
      if (!ta.mod) return { ok: false, why: 'Najpierw wskaż kamień z modyfikatorem' };
      if (b === undefined) return { ok: true };
      if (b === a) return { ok: false, why: 'Wybierz inny kamień' };
      if (!(st.tiles[b]?.hp > 0)) return { ok: false, why: 'Tu nie ma już kamienia' };
      return st.tiles[b].mod ? { ok: false, why: 'Ten kamień ma już modyfikator' } : { ok: true };
  }
}

/** use a tool (two-step tools take the target as b); false when not possible */
export function useTool(s: GameState, siteId: string, tool: PlayerTool, a: number, b?: number): boolean {
  const st = siteState(s, siteId);
  if (!canUseTool(st, tool, a, b).ok) return false;
  if ((tool === 'link' || tool === 'move' || tool === 'copy') && b === undefined) return false;
  const ta = st.tiles[a];
  switch (tool) {
    case 'bomb': ta.mod = 'bomb'; break;
    case 'rotate': ta.dir = (((ta.dir ?? 0) + 1) % 4) as Dir; break;
    case 'link': {
      const tb = st.tiles[b!];
      for (const t of [ta, tb]) if (t.link !== undefined && st.tiles[t.link]?.link !== undefined) delete st.tiles[t.link].link;
      ta.link = b; tb.link = a;
      break;
    }
    case 'move':
    case 'copy': {
      const tb = st.tiles[b!];
      tb.mod = ta.mod; tb.dir = ta.dir;
      if (tool === 'move') { delete ta.mod; delete ta.dir; }
      break;
    }
  }
  spend(st, tool);
  return true;
}

// ---------------------------------------------------------------- epoch chests: earned every 5 layers, opened by hand

export const CHEST_NAMES = ['Skrzynia brązowa', 'Skrzynia srebrna', 'Skrzynia złota'] as const;
const FOODS: Food[] = ['meat', 'plants', 'fish', 'plankton'];

/** roll and grant the contents of a waiting chest */
export function openChest(s: GameState, id: number, m: Mods = mods(s)): Loot[] {
  const i = (s.chests ?? []).findIndex((c) => c.id === id);
  if (i < 0) return [];
  const c = s.chests.splice(i, 1)[0];
  const d = c.depth, tier = c.tier;
  const k = (1 + d * 0.12) * [1, 1.8, 3.5][tier];
  const out: Loot[] = [];
  const coins = Math.round(B.chestCoins * (1 + d * 0.5) * [1, 1.6, 3][tier] * (0.8 + rand(s) * 0.4));
  s.coins += coins;
  out.push({ kind: 'coins', amount: coins, rare: 0 });
  // the epoch's payday: always a pile of shards worth several layers of digging (bronze 2, silver 4, gold 8)
  const pile = Math.round(70 * (1.5 + d * 0.03) * [2, 4, 8][tier] * (0.9 + rand(s) * 0.2));
  s.shards = (s.shards ?? 0) + pile;
  out.push({ kind: 'shards', amount: pile, rare: tier + 1 });
  const rolls = [2, 3, 5][tier];
  const table: [Loot['kind'], number][] = [['shards', 30], ['pb', 20], ['food', 20], ['coins', 10], ['mutagen', [4, 8, 16][tier]], ['mineral', 6], ['fossil', [4, 7, 12][tier]]];
  for (let n = 0; n < rolls; n++) {
    const kind = pickWeighted(s, table, ([, w]) => w)![0];
    if (kind === 'shards') { const a = Math.round(40 * k * (0.7 + rand(s) * 0.6)); s.shards = (s.shards ?? 0) + a; out.push({ kind, amount: a, rare: 1 }); }
    else if (kind === 'pb') { const a = Math.round(B.chestPB * k * (0.7 + rand(s) * 0.6)); s.pb += a; out.push({ kind, amount: a, rare: 1 }); }
    else if (kind === 'coins') { const a = Math.round(coins * (0.4 + rand(s) * 0.4)); s.coins += a; out.push({ kind, amount: a, rare: 0 }); }
    else if (kind === 'food') { const food = FOODS[Math.floor(rand(s) * 4)]; const a = Math.round(25 * k * (0.7 + rand(s) * 0.6)); s.food[food] += a; out.push({ kind, amount: a, food, rare: 0 }); }
    else if (kind === 'mutagen') { const a = tier === 2 && rand(s) < 0.4 ? 2 : 1; s.mutagen += a; out.push({ kind, amount: a, rare: 2 }); }
    else if (kind === 'mineral') {
      const mn = pickWeighted(s, mineralWeights(c.siteId, d), ([x, w]) => w * (1 + x.rarity * tier))?.[0];
      if (!mn) continue;
      const isNew = !(s.minerals ??= {})[mn.id];
      s.minerals[mn.id] = (s.minerals[mn.id] ?? 0) + 1;
      const a = Math.round(mn.coins * (1 + d * 0.08));
      s.coins += a;
      out.push({ kind, amount: a, mineralId: mn.id, rare: 1 + Math.min(2, mn.rarity), isNew });
    } else if (kind === 'fossil') {
      const site = SITE_BY_ID.get(c.siteId);
      const f = site && pickWeighted(s, site.fauna, (f) => { const g = GENERA.get(f.genusId); return g ? faunaWeight(s, f.genusId, f.occ, 0, m) * (1 + g.rarity * tier * 0.8) : 0; });
      if (!f) continue;
      const g = GENERA.get(f.genusId)!;
      const quality = (rand(s) < 0.2 * tier ? 2 : rand(s) < 0.5 ? 1 : 0) as Quality;
      const isNew = !s.discovered[f.genusId];
      onFossilFound(s, f.genusId, quality, c.siteId, m);
      s.stats.fossils++;
      (s.finds ??= []).unshift({ kind: 'fossil', genusId: f.genusId, quality, siteId: c.siteId, byCrew: false, t: s.now, isNew });
      out.push({ kind, amount: 1, genusId: f.genusId, quality, rare: Math.max(1, Math.min(3, g.rarity + (isNew ? 1 : 0))), isNew });
    }
  }
  if (s.finds && s.finds.length > 60) s.finds.length = 60;
  log(s, `Otwarto: ${CHEST_NAMES[tier].toLowerCase()} (−${depthMeters(d)} m).`, 'good');
  return out;
}

/** reward for clearing a layer (depth = 1-based number of the layer just finished) */
export function layerReward(depth: number) {
  return { coins: Math.round(B.fullLayerCoins * (1 + depth * 0.1)), pb: Math.round(B.fullLayerPB * (1 + depth * 0.05)) };
}

/** 1–3 stars for a layer: the fewer manual breaks, the better (a layer dug only by crews gets 1) */
export function layerStars(manual: number, m: Mods): number {
  if (manual <= 0) return 1;
  return manual <= m.starsAt ? 3 : manual <= m.starsAt * 2 + 2 ? 2 : 1;
}

function pushChest(s: GameState, siteId: string, depth: number, tier: ChestTier): PendingChest {
  const chest: PendingChest = { id: (s.nextChestId = (s.nextChestId ?? 1) + 1), siteId, depth, tier, t: s.now };
  (s.chests ??= []).push(chest);
  return chest;
}

function finishLayer(s: GameState, siteId: string, st: SiteState, m: Mods) {
  st.layersDone++;
  st.depth++;
  s.stats.layers++;
  addFame(s, 2);
  const manual = st.manual ?? 0;
  const stars = layerStars(manual, m);
  const base = layerReward(st.depth);
  const k = 1 + m.starBonus * (stars - 1);
  const out: LayerOutcome = { n: st.layersDone, full: true, stars, manual, best: st.best ?? 0, bonus: { coins: Math.round(base.coins * k), pb: Math.round(base.pb * k) } };
  s.coins += out.bonus!.coins;
  s.pb += out.bonus!.pb;
  s.shards = (s.shards ?? 0) + Math.round(layerShards(st.depth) * k * richness(st.depth - 1));
  const rec = (s.digRecords ??= { combo: 0, fewest: 0, oneHit: 0, stars3: 0 });
  if (manual > 0 && (!rec.fewest || manual < rec.fewest)) rec.fewest = manual;
  if (stars === 3 && manual > 0) rec.stars3++;
  if (manual === 1) {
    rec.oneHit++;
    log(s, `Cała warstwa jednym uderzeniem! (−${depthMeters(st.depth)} m)`, 'good');
    if (m.comboCap) out.chest = pushChest(s, siteId, st.depth, 2);
  }
  if (st.depth % B.chestEvery === 0 && !out.chest) {
    const r = rand(s);
    const gold = 0.06 + Math.min(0.14, st.depth * 0.002), silver = 0.25 + Math.min(0.15, st.depth * 0.003);
    // a cleanly dug layer raises the odds of a better chest
    const up = stars === 3 ? 1.6 : stars === 2 ? 1.2 : 1;
    const tier: ChestTier = r < gold * up ? 2 : r < (gold + silver) * up ? 1 : 0;
    out.chest = pushChest(s, siteId, st.depth, tier);
    log(s, `Granica epok na −${depthMeters(st.depth)} m: ${CHEST_NAMES[tier].toLowerCase()} czeka na otwarcie!`, 'good');
  }
  st.lastDone = out;
  generateLayer(s, siteId, m);
}

function checkLayer(s: GameState, siteId: string, st: SiteState, m: Mods, res: { layerDone: boolean }) {
  if (st.tiles.length && layerCleared(st)) {
    finishLayer(s, siteId, st, m);
    res.layerDone = true;
  }
}

export type GoldenReward = 'coins' | 'charge' | 'pb' | 'mutagen' | 'reveal';

/** golden flash clicked: roll a reward */
export function claimGolden(s: GameState, siteId: string, m: Mods = mods(s)): { kind: GoldenReward; amount: number; cell?: number } {
  const st = siteState(s, siteId);
  const r = rand(s);
  const coins = () => { const n = B.goldenCoins * (st.depth + 1); s.coins += n; return { kind: 'coins' as const, amount: n }; };
  if (r < 0.4) return coins();
  // a free charge to plant this layer (even before „Własny ładunek” is unlocked)
  if (r < 0.65) { (st.uses ??= {}).bomb = (st.uses.bomb ?? 0) + 1; return { kind: 'charge', amount: 1 }; }
  if (r < 0.85) { const n = Math.round(B.goldenPB * (1 + st.depth * 0.1)); s.pb += n; return { kind: 'pb', amount: n }; }
  if (r < 0.95) { s.mutagen += 1; return { kind: 'mutagen', amount: 1 }; }
  // "sure bone": uncover one cell of a hidden fossil (never its last cell — that one stays yours to dig)
  const cand: number[] = [];
  st.tiles.forEach((t, i) => {
    if (t.hp <= 0 || t.item < 0) return;
    const it = st.items[t.item];
    if (it.kind === 'fossil' && !it.found && it.cells.filter((c) => st.tiles[c].hp > 0).length > 1) cand.push(i);
  });
  if (!cand.length) return coins();
  const pick = cand[Math.floor(rand(s) * cand.length)];
  st.tiles[pick].hp = 0;
  void m;
  return { kind: 'reveal', amount: 1, cell: pick };
}

// ---------------------------------------------------------------- crews

export function crewMode(s: GameState): CrewMode {
  return s.settings.crewMode ?? 'helpers';
}

/** in 'helpers' mode crews wear a reserved tile down to this, so one brush stroke finishes it */
export const helperFloor = (t: Tile, m: Mods) => Math.min(t.max, m.brushPower) * 0.5;

/** a tile the crews leave to you in 'helpers' mode: it hides a find, carries a modifier or a link */
export const reserved = (st: SiteState, t: Tile) => (t.item >= 0 && !st.items[t.item].found) || !!t.mod || t.link !== undefined;

/**
 * 'helpers': crews clear plain rock; finds, modifiers and links they only wear down to one brush stroke (so they never spoil your chain);
 * 'full': crews dig everything, set off modifiers too (without combo rewards), also offline.
 */
export function crewTick(s: GameState, dt: number, m: Mods): void {
  const mode = crewMode(s);
  if (mode === 'off') { s.crewAcc = 0; return; }
  s.crewAcc += (dt * m.crews * m.crewSpeed) / B.crewInterval;
  if (s.crewAcc < 1) return;
  const siteId = s.activeSite;
  if (!s.unlockedSites[siteId]) { s.crewAcc = 0; return; }
  const st = siteState(s, siteId);
  let guard = 0;
  while (s.crewAcc >= 1 && guard++ < 100000) {
    s.crewAcc -= 1;
    const open: number[] = [];
    const target: number[] = [];
    st.tiles.forEach((t, i) => {
      if (t.hp <= 0) return;
      if (mode === 'helpers' && reserved(st, t) && t.hp <= helperFloor(t, m) + 1e-9) return; // worn down: the last stroke is yours
      open.push(i);
      if (t.item >= 0 && !st.items[t.item].found) target.push(i);
    });
    if (!open.length) { s.crewAcc = Math.min(s.crewAcc, 1); break; }
    // a better georadar lets crews aim at hidden finds more often
    const pool = m.crewAim && target.length && rand(s) < m.crewAim ? target : open;
    const idx = pool[Math.floor(rand(s) * pool.length)];
    const t = st.tiles[idx];
    const crit = m.crewCrit && rand(s) < m.crewCrit;
    // helpers wear finds, modifiers and links down to one brush stroke but never break them (the find and the chain stay yours)
    if (mode === 'helpers' && reserved(st, t)) { t.hp = Math.max(helperFloor(t, m), t.hp - m.crewPower); continue; }
    t.hp = Math.max(0, t.hp - (crit ? Infinity : m.crewPower));
    if (t.hp > 0) continue;
    t.hp = 1e-9;
    const { w, h } = dims(st);
    const { steps } = runChain(st.tiles, w, h, m, [{ idx, cause: 'crew' }]);
    s.shards = (s.shards ?? 0) + steps.length * shardValue(st.depth) * m.shardMult * m.crewShardMult;
    const res = { collected: [] as LayerItem[], layerDone: false };
    collectOpened(s, siteId, st, steps.map((x) => x.idx), m, true, 1, res.collected);
    checkLayer(s, siteId, st, m, res);
  }
}

// ---------------------------------------------------------------- odds shown in the dig UI

/** share of each rarity among fossils generated at this site and depth */
export function fossilRarityOdds(s: GameState, siteId: string, depth: number, m: Mods): number[] {
  const site = SITE_BY_ID.get(siteId);
  const w = [0, 0, 0, 0];
  for (const f of site?.fauna ?? []) {
    const g = GENERA.get(f.genusId);
    if (g) w[g.rarity] += faunaWeight(s, f.genusId, f.occ, depth, m);
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

/** [fragment, partial, complete] odds at this depth */
export function qualityOddsAt(depth: number, m: Mods): number[] {
  const shift = m.qualityShift + depth * B.qualityDepthShift;
  const p2 = Math.min(0.35, B.qualityOdds[2] + shift);
  const p1 = Math.min(0.45, B.qualityOdds[1] + shift);
  return [1 - p1 - p2, p1, p2];
}

export const mineralChanceAt = (depth: number) => Math.min(B.mineralChanceMax, B.mineralChance + depth * B.mineralChancePerDepth);

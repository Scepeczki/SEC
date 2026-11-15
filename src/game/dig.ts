// Dig sites: layer generation, clicking (brush / hammer), automatic crews, item collection.

import { GENERA, SITE_BY_ID } from '../data/db';
import { B } from './balance';
import { type Mods, mods } from './mods';
import { type ChestTier, type CrewMode, type FindEntry, type GameState, type LayerItem, type LayerOutcome, type Loot, type PendingChest, type Quality, type SiteState, type Tile, type Tool, log, rand } from './state';
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

export function generateLayer(s: GameState, siteId: string, m: Mods = mods(s)): void {
  const st = s.sites[siteId];
  const site = SITE_BY_ID.get(siteId)!;
  const W = B.gridW, H = B.gridH;
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
  const tutorial = siteId === 'morrison' && s.stats.layers === 0 && st.depth === 0 ? tutorialGenus(siteId) : undefined;
  const shift = m.qualityShift + st.depth * B.qualityDepthShift;
  // how many finds a layer holds varies (never shown to the player: you only see what you dig out)
  const fossilCount = tutorial !== undefined ? 4 : Math.max(1, m.fossilsPerLayer - 1 + Math.floor(rand(s) * 3) + (rand(s) < st.depth * 0.01 ? 1 : 0));
  const minorCount = 1 + Math.floor(rand(s) * (2 + Math.min(4, site.minorFossils.length / 4)));
  const amberCount = rand(s) < m.amberChance ? (rand(s) < 0.15 ? 2 : 1) : 0;
  const mineralCount = rand(s) < mineralChanceAt(st.depth) * m.mineralMult ? (rand(s) < 0.2 ? 2 : 1) : 0;
  for (let i = 0; i < fossilCount; i++) {
    let genusId: number | undefined;
    let quality: Quality;
    if (tutorial !== undefined) {
      genusId = tutorial;
      quality = 2;
    } else {
      const f = pickWeighted(s, site.fauna, (f) => {
        const g = GENERA.get(f.genusId);
        if (!g) return 0;
        const r = g.rarity;
        return Math.pow(f.occ, 0.6) * B.rarityWeight[r] * (r ? m.rareBoost : 1) * (1 + st.depth * B.rarityDepthBonus[r] * m.rarityDepthMult);
      });
      genusId = f?.genusId;
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
  st.burns = [];
}

export interface HitResult { collected: LayerItem[]; layerDone: boolean; damaged: boolean; crit: boolean; /** shards earned by this hit */ shards?: number; /** extra tiles hit (brush sweep, hammer after-shock) */ extra?: number[] }

/** rock shards for one broken tile at this depth */
export const shardValue = (depth: number) => 1 + depth * 0.06;
export interface HitOpts { /** chance that this hit breaks the centre tile outright (player only) */ critChance?: number }

function collect(s: GameState, siteId: string, st: SiteState, it: LayerItem, m: Mods, byCrew: boolean) {
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
    f.pb = B.minorPB * (1 + st.depth * 0.05);
    f.coins = B.minorCoins * (1 + st.depth * 0.1);
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
    f.coins = Math.round((mn?.coins ?? 20) * (1 + st.depth * 0.08));
    s.coins += f.coins;
    if (mn && mn.rarity >= 2) log(s, `Rzadki minerał: ${mn.name}!`, 'good');
  }
  (s.finds ??= []).unshift(f);
  if (s.finds.length > 60) s.finds.length = 60;
}

function damage(s: GameState, siteId: string, st: SiteState, idx: number, power: number, m: Mods, res: HitResult, byCrew = false) {
  const t = st.tiles[idx];
  if (!t || t.hp <= 0) return;
  t.hp = Math.max(0, t.hp - power);
  if (t.hp <= 0) {
    const n = shardValue(st.depth) * m.shardMult * (byCrew ? m.crewShardMult : 1);
    s.shards = (s.shards ?? 0) + n;
    res.shards = (res.shards ?? 0) + n;
  }
  if (t.hp <= 0 && t.item >= 0) {
    const it = st.items[t.item];
    if (!it.found && it.cells.every((c) => st.tiles[c].hp <= 0)) {
      collect(s, siteId, st, it, m, byCrew);
      res.collected.push(it);
    }
  }
}

/** depth in metres shown to the player */
export const depthMeters = (depth: number) => depth * B.metersPerLayer;

/** a layer is finished only when every single tile has been dug out */
export const layerCleared = (st: SiteState) => st.tiles.every((t) => t.hp <= 0);

export const layerShards = (depth: number) => Math.round(15 * (1 + depth * 0.1));

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
      const f = site && pickWeighted(s, site.fauna, (f) => { const g = GENERA.get(f.genusId); return g ? Math.pow(f.occ, 0.5) * B.rarityWeight[g.rarity] * (1 + g.rarity * tier * 0.8) : 0; });
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

function finishLayer(s: GameState, siteId: string, st: SiteState, m: Mods) {
  st.layersDone++;
  st.depth++;
  s.stats.layers++;
  addFame(s, 2);
  const out: LayerOutcome = { n: st.layersDone, full: true, bonus: layerReward(st.depth) };
  s.coins += out.bonus!.coins;
  s.pb += out.bonus!.pb;
  s.shards = (s.shards ?? 0) + layerShards(st.depth);
  if (st.depth % B.chestEvery === 0) {
    const r = rand(s);
    const gold = 0.06 + Math.min(0.14, st.depth * 0.002), silver = 0.25 + Math.min(0.15, st.depth * 0.003);
    const tier: ChestTier = r < gold ? 2 : r < gold + silver ? 1 : 0;
    const chest: PendingChest = { id: (s.nextChestId = (s.nextChestId ?? 1) + 1), siteId, depth: st.depth, tier, t: s.now };
    (s.chests ??= []).push(chest);
    out.chest = chest;
    log(s, `Granica epok na −${depthMeters(st.depth)} m: ${CHEST_NAMES[tier].toLowerCase()} czeka na otwarcie!`, 'good');
  }
  st.lastDone = out;
  generateLayer(s, siteId, m);
}

function checkLayer(s: GameState, siteId: string, st: SiteState, m: Mods, res: HitResult) {
  if (st.tiles.length && layerCleared(st)) {
    finishLayer(s, siteId, st, m);
    res.layerDone = true;
  }
}

/** cells a hammer blow at idx touches (centre first): a plus, or a 3×3 square with the upgrade */
export function hammerCells(st: SiteState, idx: number, square = false): number[] {
  const W = B.gridW;
  const x = idx % W;
  const out = [idx, idx - W, idx + W, x > 0 ? idx - 1 : -1, x < W - 1 ? idx + 1 : -1];
  if (square) out.push(x > 0 ? idx - W - 1 : -1, x < W - 1 ? idx - W + 1 : -1, x > 0 ? idx + W - 1 : -1, x < W - 1 ? idx + W + 1 : -1);
  return out.filter((c) => c >= 0 && c < st.tiles.length && st.tiles[c].hp > 0);
}

/** damage a tile takes from a hammer blow at `center` */
export function hammerPower(m: Mods, c: number, center: number): number {
  return m.hammerPower * (c === center ? B.hammerCenterMult : B.hammerArmMult);
}

/** a hammer blow risks a fossil only when it breaks through to one of its cells */
export function hammerRisk(st: SiteState, c: number, center: number, m: Mods): boolean {
  const t = st.tiles[c];
  if (!t || t.hp <= 0 || t.item < 0) return false;
  const it = st.items[t.item];
  return it.kind === 'fossil' && !it.found && it.quality > 0 && t.hp <= hammerPower(m, c, center);
}

const hides = (st: SiteState, t: Tile) => t.item >= 0 && !st.items[t.item].found;
/** indirect damage (splash, smouldering, shock wave) never breaks a tile that hides something */
function soften(s: GameState, siteId: string, st: SiteState, idx: number, amount: number, m: Mods, res: HitResult, canBreakRock = true) {
  const t = st.tiles[idx];
  if (!t || t.hp <= 0 || amount <= 0) return;
  if (hides(st, t) || !canBreakRock) {
    const floor = hides(st, t) ? helperFloor(t, m) : t.max * 0.1;
    if (t.hp <= floor) return;
    t.hp = Math.max(floor, t.hp - amount);
    return;
  }
  damage(s, siteId, st, idx, amount, m, res);
}
export const neighbours4 = (idx: number) => {
  const W = B.gridW, x = idx % W;
  return [idx - W, idx + W, x > 0 ? idx - 1 : -1, x < W - 1 ? idx + 1 : -1].filter((c) => c >= 0 && c < W * B.gridH);
};

export function hitTile(s: GameState, siteId: string, idx: number, tool: Tool, m: Mods = mods(s), opts: HitOpts = {}): HitResult {
  const st = siteState(s, siteId);
  const res: HitResult = { collected: [], layerDone: false, damaged: false, crit: false };
  s.stats.clicks++;
  const crit = !!opts.critChance && rand(s) < opts.critChance;
  res.crit = crit;
  if (tool === 'hammer' && m.hammer) {
    const cells = hammerCells(st, idx, m.hammerSquare);
    const hurt = new Set<LayerItem>();
    for (const c of cells) {
      if (c === idx && crit) continue; // a clean crit on the centre never hurts the bone
      if (m.hammerCenterRisk && c !== idx) continue;
      if (hammerRisk(st, c, idx, m)) hurt.add(st.items[st.tiles[c].item]);
    }
    for (const it of hurt) {
      if (rand(s) < m.hammerRisk) { it.quality = (it.quality - 1) as Quality; res.damaged = true; }
    }
    for (const c of cells) damage(s, siteId, st, c, c === idx && crit ? Infinity : hammerPower(m, c, idx), m, res);
    if (m.quake) for (let i = 0; i < st.tiles.length; i++) if (!cells.includes(i)) soften(s, siteId, st, i, st.tiles[i].max * m.quake, m, res, false);
    if (crit && m.hammerAfter && rand(s) < m.hammerAfter) {
      const nb = neighbours4(idx).filter((c) => st.tiles[c].hp > 0);
      if (nb.length) { const c = nb[Math.floor(rand(s) * nb.length)]; damage(s, siteId, st, c, m.hammerPower, m, res); (res.extra ??= []).push(c); }
    }
  } else {
    damage(s, siteId, st, idx, crit ? Infinity : m.brushPower, m, res);
    if (m.sweep && rand(s) < m.sweep) {
      const nb = neighbours4(idx).filter((c) => st.tiles[c].hp > 0);
      if (nb.length) { const c = nb[Math.floor(rand(s) * nb.length)]; damage(s, siteId, st, c, m.brushPower, m, res); (res.extra ??= []).push(c); }
    }
    if (m.splash) for (const c of neighbours4(idx)) soften(s, siteId, st, c, m.brushPower * m.splash, m, res);
    if (m.emberDps && rand(s) < 0.2) (st.burns ??= []).push({ tile: idx, until: s.now + 4000, dps: m.emberDps });
  }
  checkLayer(s, siteId, st, m, res);
  return res;
}

/** smouldering tiles (brush upgrade) keep eating the rock around them */
export function burnTick(s: GameState, dt: number, m: Mods): void {
  const st = s.sites[s.activeSite];
  if (!st?.burns?.length) return;
  const dying = st.burns.filter((b) => b.until <= s.now);
  st.burns = st.burns.filter((b) => b.until > s.now);
  if (m.wildfire) for (const b of dying) {
    if (rand(s) >= m.wildfire) continue;
    const nb = neighbours4(b.tile).filter((c) => st.tiles[c].hp > 0 && !st.burns!.some((x) => x.tile === c));
    if (nb.length) st.burns.push({ tile: nb[Math.floor(rand(s) * nb.length)], until: s.now + 4000, dps: b.dps });
  }
  const res: HitResult = { collected: [], layerDone: false, damaged: false, crit: false };
  for (const b of st.burns) for (const c of [b.tile, ...neighbours4(b.tile)]) soften(s, s.activeSite, st, c, b.dps * dt, m, res);
  checkLayer(s, s.activeSite, st, m, res);
}

export type GoldenReward = 'coins' | 'fever' | 'pb' | 'mutagen' | 'reveal';

/** golden flash clicked: roll a reward (fever itself is run by the UI) */
export function claimGolden(s: GameState, siteId: string, m: Mods = mods(s)): { kind: GoldenReward; amount: number; cell?: number } {
  const st = siteState(s, siteId);
  const r = rand(s);
  const coins = () => { const n = B.goldenCoins * (st.depth + 1); s.coins += n; return { kind: 'coins' as const, amount: n }; };
  if (r < 0.4) return coins();
  if (r < 0.65) return m.feverSec ? { kind: 'fever', amount: m.feverSec } : coins();
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
  return { kind: 'reveal', amount: 1, cell: pick };
}

export function crewMode(s: GameState): CrewMode {
  return s.settings.crewMode ?? 'helpers';
}

/**
 * In 'helpers' mode crews clear plain rock, but a tile that hides something (bone, shell, amber, mineral)
 * is only worn down to this much strength and never broken: one brush hit from the player finishes it.
 */
export function helperFloor(t: Tile, m: Mods): number {
  return Math.min(t.max, m.brushPower) * 0.5;
}

/** automatic crews dig on the active site */
export function crewTick(s: GameState, dt: number, m: Mods): void {
  const mode = crewMode(s);
  if (mode === 'off') { s.crewAcc = 0; return; }
  s.crewAcc += (dt * m.crews * m.crewSpeed) / B.crewInterval;
  if (s.crewAcc < 1) return;
  const siteId = s.activeSite;
  const st = siteState(s, siteId);
  let guard = 0;
  while (s.crewAcc >= 1 && guard++ < 100000) {
    s.crewAcc -= 1;
    const open: number[] = [];
    const target: number[] = [];
    st.tiles.forEach((t, i) => {
      if (t.hp <= 0) return;
      const hides = t.item >= 0 && !st.items[t.item].found;
      if (mode === 'helpers' && hides && t.hp <= helperFloor(t, m) + 1e-9) return; // left for the player
      open.push(i);
      if (hides) target.push(i);
    });
    if (!open.length) { s.crewAcc = Math.min(s.crewAcc, 1); break; }
    // a better georadar lets crews aim at hidden finds more often
    const pool = m.crewAim && target.length && rand(s) < m.crewAim ? target : open;
    const idx = pool[Math.floor(rand(s) * pool.length)];
    const t = st.tiles[idx];
    const hides = t.item >= 0 && !st.items[t.item].found;
    const crit = m.crewCrit && rand(s) < m.crewCrit;
    const full = crit ? t.hp : m.crewPower;
    const power = mode === 'helpers' && hides ? Math.min(full, t.hp - helperFloor(t, m)) : full;
    const res: HitResult = { collected: [], layerDone: false, damaged: false, crit: false };
    damage(s, siteId, st, idx, power, m, res, true);
    checkLayer(s, siteId, st, m, res);
  }
}

// ---------------------------------------------------------------- odds shown in the dig UI

/** share of each rarity among fossils generated at this site and depth */
export function fossilRarityOdds(siteId: string, depth: number, m: Mods): number[] {
  const site = SITE_BY_ID.get(siteId);
  const w = [0, 0, 0, 0];
  for (const f of site?.fauna ?? []) {
    const g = GENERA.get(f.genusId);
    if (!g) continue;
    w[g.rarity] += Math.pow(f.occ, 0.6) * B.rarityWeight[g.rarity] * (g.rarity ? m.rareBoost : 1) * (1 + depth * B.rarityDepthBonus[g.rarity] * m.rarityDepthMult);
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

// ---------------------------------------------------------------- charges (workshop): blast an area of rock

/** cells a charge at idx blasts: 3×3, a radius-2 diamond, or 5×5 */
export function chargeCells(idx: number, size: number): number[] {
  const W = B.gridW, H = B.gridH, x0 = idx % W, y0 = Math.floor(idx / W);
  const out: number[] = [];
  const R = size ? 2 : 1;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (size === 1 && Math.abs(dx) + Math.abs(dy) > 2) continue;
    const x = x0 + dx, y = y0 + dy;
    if (x >= 0 && y >= 0 && x < W && y < H) out.push(y * W + x);
  }
  return out;
}

/** charges recharge over time */
export function chargeTick(s: GameState, dt: number, m: Mods): void {
  if (!m.charge) return;
  const c = (s.charges ??= { n: 1, acc: 0 });
  if (c.n >= m.chargeMax) { c.n = m.chargeMax; c.acc = 0; return; }
  c.acc += dt;
  while (c.acc >= m.chargeCd && c.n < m.chargeMax) { c.acc -= m.chargeCd; c.n++; }
}

export interface BlastResult extends HitResult { blasts: { center: number; cells: number[] }[] }

/**
 * Blow a charge at idx: plain rock is crushed, but tiles hiding a find are only worn down
 * (to one brush stroke) — the find itself is always yours to uncover.
 */
export function blastCharge(s: GameState, siteId: string, idx: number, m: Mods = mods(s)): BlastResult | null {
  const c = (s.charges ??= { n: 1, acc: 0 });
  if (!m.charge || c.n < 1) return null;
  c.n--;
  const st = siteState(s, siteId);
  const res: BlastResult = { collected: [], layerDone: false, damaged: false, crit: false, blasts: [] };
  const blast = (at: number) => {
    const cells = chargeCells(at, m.chargeSize);
    const before = s.shards ?? 0;
    for (const ci of cells) soften(s, siteId, st, ci, Infinity, m, res);
    s.shards = before + ((s.shards ?? 0) - before) * m.chargeShards;
    res.blasts.push({ center: at, cells });
  };
  blast(idx);
  if (m.chargeChain && rand(s) < m.chargeChain) {
    const open = st.tiles.map((t, i) => (t.hp > 0 && t.item < 0 ? i : -1)).filter((i) => i >= 0);
    if (open.length) blast(open[Math.floor(rand(s) * open.length)]);
  }
  if (m.chargeMega) for (let i = 0; i < st.tiles.length; i++) soften(s, siteId, st, i, st.tiles[i].max * 0.25, m, res, false);
  checkLayer(s, siteId, st, m, res);
  return res;
}

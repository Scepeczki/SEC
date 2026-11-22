// Park 2.0 map rules: islands, placing / moving / upgrading objects, paths and their connection to the gate,
// pens inside enclosures, moving animals, happiness, production into per-object storage and click collection,
// clearing wild land, and an automatic layout used for new games and old saves. Pure functions on GameState.

import { SIZE_SLOTS } from '../data/archetypes';
import { GENERA } from '../data/db';
import type { Food, Habitat } from '../data/types';
import { animalIncome } from './balance';
import { BUILDING_BY_ID, buildingCost, foodRate } from './content';
import { chunkOf, inside, isWater, startChunksFor, terrain, Tile, type Terrain } from './islands';
import { addFame, collectionBonus, parkLevel } from './meta';
import { type Mods, mods } from './mods';
import {
  CHUNK, ENC_SIZE, ENCLOSURE_NAMES, INTERIOR_BY_ID, ISLAND_BY_ID, P, PATH_COST, PLACE_BY_ID, STATION_IDS, clearCost, encLevel, enclosureDefId, interiorSlots,
  penCost, placeCost, stationDefId, upgradeCost, type PlaceDef,
} from './parkContent';
import { type Animal, type GameState, type ParkObject, log } from './state';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Check { ok: boolean; why?: string; cost: number }

// ---------------------------------------------------------------- basics

export const defOf = (o: ParkObject): PlaceDef => PLACE_BY_ID.get(o.def)!;

export function sizeAt(def: PlaceDef, level: number, rot: 0 | 1): [number, number] {
  const [w, h] = def.size(level);
  return rot ? [h, w] : [w, h];
}

/** level used for drawing and effects (stations keep it in s.buildings) */
export const levelOf = (s: GameState, o: ParkObject) => (defOf(o).station ? s.buildings[defOf(o).station!] : o.level);

/** footprint of a placed object (an old save may keep its own) */
export const footprint = (o: ParkObject): [number, number] => {
  if (!o.fp) return sizeAt(defOf(o), o.level, o.rot);
  return o.rot ? [o.fp[1], o.fp[0]] : o.fp;
};

export function rectOf(o: ParkObject): Rect {
  const [w, h] = footprint(o);
  return { x: o.x, y: o.y, w, h };
}

export const objById = (s: GameState, id: number) => s.park.objects.find((o) => o.id === id);
export const objectsOn = (s: GameState, island: number) => s.park.objects.filter((o) => o.island === island);
export const countOf = (s: GameState, defId: string) => s.park.objects.reduce((n, o) => n + (o.def === defId ? 1 : 0), 0);
export const isBought = (s: GameState, island: number) => !!s.park.islands[island];
export const boughtIslands = (s: GameState) => Object.keys(s.park.islands).map(Number).sort((a, b) => a - b);

/** call after every change to the map */
export function touch(s: GameState) { s.park.rev = (s.park.rev ?? 0) + 1; }

// ---------------------------------------------------------------- cached grids (rebuilt when park.rev changes)

interface IslandCache { occ: Int32Array; paths: Set<number>; conn: Set<number>; cleared: Set<number> }
const caches = new WeakMap<object, { rev: number; byIsland: Map<number, IslandCache> }>();

export function islandCache(s: GameState, island: number): IslandCache {
  let c = caches.get(s.park);
  if (!c || c.rev !== s.park.rev) { c = { rev: s.park.rev, byIsland: new Map() }; caches.set(s.park, c); }
  let ic = c.byIsland.get(island);
  if (ic) return ic;
  const t = terrain(island);
  const occ = new Int32Array(t.w * t.h);
  for (const o of objectsOn(s, island)) {
    const r = rectOf(o);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inside(t, x, y)) occ[y * t.w + x] = o.id;
  }
  const paths = new Set(s.park.paths[island] ?? []);
  const cleared = new Set([...startChunksFor(t, s.park.islands[island]?.start), ...(s.park.islands[island]?.cleared ?? [])]);
  // paths connected to the gate
  const conn = new Set<number>();
  const gate = objectsOn(s, island).find((o) => o.def === 'gate');
  if (gate) {
    const queue = ring(rectOf(gate)).filter(([x, y]) => inside(t, x, y) && paths.has(y * t.w + x)).map(([x, y]) => y * t.w + x);
    for (const q of queue) conn.add(q);
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % t.w, y = (i - x) / t.w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!inside(t, nx, ny)) continue;
        const j = ny * t.w + nx;
        if (paths.has(j) && !conn.has(j)) { conn.add(j); queue.push(j); }
      }
    }
  }
  ic = { occ, paths, conn, cleared };
  c.byIsland.set(island, ic);
  return ic;
}

/** tiles just outside a rectangle (4-neighbourhood, no corners) */
export function ring(r: Rect): [number, number][] {
  const out: [number, number][] = [];
  for (let x = r.x; x < r.x + r.w; x++) out.push([x, r.y - 1], [x, r.y + r.h]);
  for (let y = r.y; y < r.y + r.h; y++) out.push([r.x - 1, y], [r.x + r.w, y]);
  return out;
}

export function isCleared(s: GameState, island: number, x: number, y: number): boolean {
  const t = terrain(island);
  return islandCache(s, island).cleared.has(chunkOf(t, x, y));
}

/** land or sand, cleared of wild growth */
export function buildable(s: GameState, island: number, x: number, y: number): boolean {
  const t = terrain(island);
  return inside(t, x, y) && t.tiles[y * t.w + x] >= Tile.Sand && isCleared(s, island, x, y);
}

export function connected(s: GameState, o: ParkObject): boolean {
  if (o.def === 'gate') return true;
  const t = terrain(o.island);
  const { conn } = islandCache(s, o.island);
  return ring(rectOf(o)).some(([x, y]) => inside(t, x, y) && conn.has(y * t.w + x));
}

/** needs a path to earn but has none */
export const lacksPath = (s: GameState, o: ParkObject) => !!defOf(o).needsPath && !connected(s, o);

// ---------------------------------------------------------------- placing

export interface PlaceOpts { /** moving an existing object (no price, ignores itself) */ moving?: ParkObject; /** free and without level/coin checks (layout, migration) */ free?: boolean; level?: number }

export function canPlace(s: GameState, defId: string, island: number, x: number, y: number, rot: 0 | 1, opts: PlaceOpts = {}): Check {
  const def = PLACE_BY_ID.get(defId);
  if (!def) return { ok: false, why: 'Nieznany obiekt', cost: 0 };
  const cost = opts.moving || opts.free ? 0 : placeCost(def, countOf(s, defId));
  const no = (why: string): Check => ({ ok: false, why, cost });
  if (!isBought(s, island)) return no('Ta wyspa nie jest kupiona');
  if (!opts.moving && !opts.free) {
    if (parkLevel(s) < def.unlockLevel) return no(`Wymaga poziomu parku ${def.unlockLevel}`);
    if (def.unique && countOf(s, defId) > 0) return no('Ten budynek już stoi w parku');
  }
  const level = opts.level ?? opts.moving?.level ?? 1;
  const [w, h] = opts.moving?.fp && opts.level === undefined ? (rot ? [opts.moving.fp[1], opts.moving.fp[0]] : opts.moving.fp) : sizeAt(def, level, rot);
  const t = terrain(island);
  const { occ, paths } = islandCache(s, island);
  const self = opts.moving && opts.moving.island === island ? opts.moving.id : -1;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!inside(t, xx, yy)) return no('Wystaje poza wyspę');
    const i = yy * t.w + xx;
    if (t.tiles[i] < Tile.Sand) return no('Nie da się budować na wodzie');
    if (!isCleared(s, island, xx, yy)) return no('Teren nie jest oczyszczony');
    if (occ[i] && occ[i] !== self) return no(`Zajęte przez: ${defOf(objById(s, occ[i])!).name}`);
    if (paths.has(i)) return no('Na drodze stoi ścieżka — usuń ją albo przesuń budynek');
  }
  if (def.needsWater && !ring({ x, y, w, h }).some(([xx, yy]) => isWater(t, xx, yy))) return no('Musi stać nad brzegiem wody');
  if (!opts.free && s.coins < cost) return no('Za mało monet');
  return { ok: true, cost };
}

export function place(s: GameState, defId: string, island: number, x: number, y: number, rot: 0 | 1 = 0, opts: PlaceOpts = {}): ParkObject | null {
  const c = canPlace(s, defId, island, x, y, rot, opts);
  if (!c.ok) return null;
  const def = PLACE_BY_ID.get(defId)!;
  s.coins -= c.cost;
  const o: ParkObject = { id: s.park.nextId++, def: defId, island, x, y, rot, level: opts.level ?? 1, store: 0, t: s.now };
  if (def.cat === 'enclosure') { o.pens = encLevel(o.level).pens; o.decor = []; if (o.pens > 2 && !opts.free) o.pens = 2; }
  if (def.station && !s.buildings[def.station]) s.buildings[def.station] = 1;
  s.park.objects.push(o);
  touch(s);
  if (!opts.free && def.cat !== 'decor') {
    addFame(s, def.cat === 'enclosure' ? 10 : def.cat === 'station' ? 15 : 5);
    log(s, `Postawiono: ${def.name}`, 'good');
  }
  return o;
}

export function canMove(s: GameState, id: number, island: number, x: number, y: number, rot: 0 | 1): Check {
  const o = objById(s, id);
  if (!o) return { ok: false, why: 'Nie ma takiego obiektu', cost: 0 };
  return canPlace(s, o.def, island, x, y, rot, { moving: o });
}

export function moveObject(s: GameState, id: number, island: number, x: number, y: number, rot: 0 | 1): boolean {
  if (!canMove(s, id, island, x, y, rot).ok) return false;
  const o = objById(s, id)!;
  Object.assign(o, { island, x, y, rot });
  touch(s);
  return true;
}

export function canRemove(s: GameState, id: number): { ok: boolean; why?: string; refund: number } {
  const o = objById(s, id);
  if (!o) return { ok: false, why: 'Nie ma takiego obiektu', refund: 0 };
  const def = defOf(o);
  if (def.fixed) return { ok: false, why: 'Bramy nie da się rozebrać', refund: 0 };
  if (def.station) return { ok: false, why: 'Stacji nie da się rozebrać — możesz ją przenieść', refund: 0 };
  return { ok: true, refund: Math.round(placeCost(def, Math.max(0, countOf(s, o.def) - 1)) * P.refund) };
}

export function removeObject(s: GameState, id: number): boolean {
  const c = canRemove(s, id);
  if (!c.ok) return false;
  collect(s, id);
  for (const a of s.animals) if (a.enc === id) { a.enc = 0; a.pen = 0; }
  s.park.objects = s.park.objects.filter((o) => o.id !== id);
  s.coins += c.refund;
  touch(s);
  return true;
}

// ---------------------------------------------------------------- upgrading

/** does a rectangle touch a path connected to the gate */
function touchesPath(s: GameState, island: number, r: Rect): boolean {
  const t = terrain(island);
  const { conn } = islandCache(s, island);
  return ring(r).some(([x, y]) => inside(t, x, y) && conn.has(y * t.w + x));
}

/**
 * 0.3.0 → 0.3.1: enclosures no longer grow with their level. Bigger ones shrink to the standard footprint inside
 * their old area (keeping their path), smaller ones grow if there is room, otherwise keep their size until the next upgrade.
 */
export function resizeEnclosures(s: GameState, legacy: [number, number][]): void {
  const encs = s.park.objects.filter((o) => defOf(o).cat === 'enclosure');
  const [nw, nh] = ENC_SIZE;
  const shrink: ParkObject[] = [], grow: ParkObject[] = [];
  for (const o of encs) {
    const l = legacy[Math.max(0, Math.min(legacy.length, o.level) - 1)];
    const [ow, oh] = o.rot ? [l[1], l[0]] : l;
    if (ow === nw && oh === nh) continue;
    if (ow >= nw && oh >= nh) shrink.push(o);
    else { o.fp = l; grow.push(o); }
    (o as ParkObject & { old?: Rect }).old = { x: o.x, y: o.y, w: ow, h: oh };
  }
  for (const o of shrink) {
    const r = (o as ParkObject & { old?: Rect }).old!;
    const cand: [number, number][] = [];
    for (let dy = 0; dy <= r.h - nh; dy++) for (let dx = 0; dx <= r.w - nw; dx++) cand.push([r.x + dx, r.y + dy]);
    const mid = (p: [number, number]) => Math.abs(p[0] - (r.x + (r.w - nw) / 2)) + Math.abs(p[1] - (r.y + (r.h - nh) / 2));
    const linked = (p: [number, number]) => (touchesPath(s, o.island, { x: p[0], y: p[1], w: nw, h: nh }) ? 1 : 0);
    cand.sort((a, b) => linked(b) - linked(a) || mid(a) - mid(b));
    [o.x, o.y] = cand[0];
  }
  touch(s);
  for (const o of grow) {
    const fit = growAnchor(s, o);
    if (fit.at) { [o.x, o.y] = fit.at; delete o.fp; touch(s); }
  }
  for (const o of encs) delete (o as ParkObject & { old?: Rect }).old;
  touch(s);
}

/** where an enclosure with an old footprint can take the standard one, covering its old area */
export function growAnchor(s: GameState, o: ParkObject): { at?: [number, number]; w: number; h: number; why: string } {
  const r = rectOf(o);
  const [nw, nh] = sizeAt(defOf(o), o.level, o.rot);
  let why = '';
  // anchors whose rectangle overlaps the old one as much as possible, nearest first
  const cand: [number, number][] = [];
  for (let dy = -(nh - 1); dy < r.h; dy++) for (let dx = -(nw - 1); dx < r.w; dx++) cand.push([r.x + dx, r.y + dy]);
  const overlap = ([x, y]: [number, number]) => Math.max(0, Math.min(x + nw, r.x + r.w) - Math.max(x, r.x)) * Math.max(0, Math.min(y + nh, r.y + r.h) - Math.max(y, r.y));
  const linked = ([x, y]: [number, number]) => (touchesPath(s, o.island, { x, y, w: nw, h: nh }) ? 1 : 0);
  cand.sort((a, b) => linked(b) - linked(a) || overlap(b) - overlap(a));
  const probe = { ...o, fp: undefined };
  for (const [x, y] of cand) {
    if (overlap([x, y]) <= 0) break;
    const c = canPlace(s, o.def, o.island, x, y, o.rot, { moving: probe, level: o.level });
    if (c.ok) return { at: [x, y], w: nw, h: nh, why };
    why ||= c.why ?? '';
  }
  return { w: nw, h: nh, why };
}

export function canUpgrade(s: GameState, id: number): Check & { at?: [number, number] } {
  const o = objById(s, id);
  if (!o) return { ok: false, why: 'Nie ma takiego obiektu', cost: 0 };
  const def = defOf(o);
  const lvl = levelOf(s, o);
  const cost = upgradeCost(def, lvl);
  if (lvl >= def.maxLevel) return { ok: false, why: 'Maksymalny poziom', cost };
  if (def.cat === 'enclosure' && lvl >= mods(s).encMaxLevel) return { ok: false, why: `Większe wybiegi odblokujesz w Badaniach (${lvl === 5 ? 'Rozległe wybiegi' : 'Rezerwaty'})`, cost };
  if (def.station) {
    const b = BUILDING_BY_ID[def.station];
    if (parkLevel(s) < b.unlockLevel) return { ok: false, why: `Wymaga poziomu parku ${b.unlockLevel}`, cost };
  }
  let at: [number, number] | undefined;
  // an old, smaller enclosure grows to the standard footprint on an upgrade when there is room; otherwise it stays as it is
  if (def.cat === 'enclosure' && o.fp) at = growAnchor(s, o).at;
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', cost, at };
  return { ok: true, cost, at };
}

export function upgradeObject(s: GameState, id: number): boolean {
  const c = canUpgrade(s, id);
  if (!c.ok) return false;
  const o = objById(s, id)!;
  const def = defOf(o);
  s.coins -= c.cost;
  if (def.station) s.buildings[def.station]++;
  else o.level++;
  if (c.at) { o.x = c.at[0]; o.y = c.at[1]; delete o.fp; }
  touch(s);
  addFame(s, def.cat === 'enclosure' ? 15 : 3);
  return true;
}

// ---------------------------------------------------------------- paths

export function canPath(s: GameState, island: number, x: number, y: number): { ok: boolean; why?: string } {
  if (!isBought(s, island)) return { ok: false, why: 'Ta wyspa nie jest kupiona' };
  const t = terrain(island);
  if (!inside(t, x, y) || t.tiles[y * t.w + x] < Tile.Sand) return { ok: false, why: 'Woda' };
  if (!isCleared(s, island, x, y)) return { ok: false, why: 'Teren nie jest oczyszczony' };
  if (islandCache(s, island).occ[y * t.w + x]) return { ok: false, why: 'Zajęte' };
  return { ok: true };
}

/** lay (on) or remove (off) path tiles; returns how many changed */
export function setPaths(s: GameState, island: number, tiles: [number, number][], on: boolean, free = false): number {
  const t = terrain(island);
  const list = (s.park.paths[island] ??= []);
  const set = new Set(list);
  let n = 0;
  for (const [x, y] of tiles) {
    const i = y * t.w + x;
    if (on) {
      if (set.has(i) || !canPath(s, island, x, y).ok) continue;
      if (!free) { if (s.coins < PATH_COST) break; s.coins -= PATH_COST; }
      set.add(i); n++;
    } else if (set.delete(i)) n++;
  }
  if (n) { s.park.paths[island] = [...set]; touch(s); }
  return n;
}

// ---------------------------------------------------------------- islands & clearing

export function canBuyIsland(s: GameState, id: number): Check {
  const d = ISLAND_BY_ID.get(id);
  if (!d) return { ok: false, why: 'Nie ma takiej wyspy', cost: 0 };
  if (isBought(s, id)) return { ok: false, why: 'Już kupiona', cost: d.cost };
  if (parkLevel(s) < d.level) return { ok: false, why: `Wymaga poziomu parku ${d.level}`, cost: d.cost };
  if (s.coins < d.cost) return { ok: false, why: 'Za mało monet', cost: d.cost };
  return { ok: true, cost: d.cost };
}

export function buyIsland(s: GameState, id: number, free = false): boolean {
  if (!free && !canBuyIsland(s, id).ok) return false;
  const d = ISLAND_BY_ID.get(id)!;
  if (!free) s.coins -= d.cost;
  s.park.islands[id] = { bought: s.now, cleared: [] };
  touch(s);
  const [gx, gy] = terrain(id).gate;
  place(s, 'gate', id, gx, gy, 0, { free: true });
  if (!free) { addFame(s, 25); log(s, `Nowa wyspa: ${d.name}!`, 'good'); }
  return true;
}

export const clearedTotal = (s: GameState) => Object.values(s.park.islands).reduce((n, i) => n + i.cleared.length, 0);

export function canClear(s: GameState, island: number, chunk: number): Check {
  const cost = Math.round(clearCost(clearedTotal(s)) * (1 - mods(s).clearDiscount));
  if (!isBought(s, island)) return { ok: false, why: 'Ta wyspa nie jest kupiona', cost };
  const t = terrain(island);
  const ic = islandCache(s, island);
  if (!t.landChunks.has(chunk)) return { ok: false, why: 'Tu jest tylko woda', cost };
  if (ic.cleared.has(chunk)) return { ok: false, why: 'Już oczyszczone', cost };
  const cx = chunk % t.cw, cy = (chunk - cx) / t.cw;
  const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]].some(([x, y]) => x >= 0 && y >= 0 && x < t.cw && y < t.ch && ic.cleared.has(y * t.cw + x));
  if (!nb) return { ok: false, why: 'Oczyszczaj od brzegu wolnego terenu', cost };
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', cost };
  return { ok: true, cost };
}

export function clearChunk(s: GameState, island: number, chunk: number, free = false): boolean {
  if (!free && !canClear(s, island, chunk).ok) return false;
  if (!free) s.coins -= canClear(s, island, chunk).cost;
  s.park.islands[island].cleared.push(chunk);
  touch(s);
  return true;
}

// ---------------------------------------------------------------- pens & animals

export const slotsOf = (genusId: number) => SIZE_SLOTS[GENERA.get(genusId)!.size];
/** places in one pen and pens per enclosure: the level plus park research */
export const penSlots = (s: GameState, o: ParkObject) => encLevel(o.level).penSlots + mods(s).penSlotBonus;
export const maxPens = (s: GameState, o: ParkObject) => encLevel(o.level).pens + mods(s).penCountBonus;
export const animalsIn = (s: GameState, enc: number, pen?: number) => s.animals.filter((a) => a.enc === enc && (pen === undefined || a.pen === pen));
export const transporter = (s: GameState) => s.animals.filter((a) => !a.enc);
export const penUsed = (s: GameState, enc: number, pen: number, except?: number) =>
  animalsIn(s, enc, pen).reduce((n, a) => n + (a.uid === except ? 0 : slotsOf(a.genusId)), 0);
const isCarnivore = (genusId: number) => GENERA.get(genusId)!.food === 'meat';
export const enclosures = (s: GameState) => s.park.objects.filter((o) => defOf(o).cat === 'enclosure');

export function canPut(s: GameState, uid: number, enc: number, pen: number): { ok: boolean; why?: string } {
  const a = s.animals.find((x) => x.uid === uid);
  const o = objById(s, enc);
  if (!a || !o) return { ok: false, why: 'Nie ma takiego miejsca' };
  const def = defOf(o);
  const g = GENERA.get(a.genusId)!;
  if (def.cat !== 'enclosure') return { ok: false, why: 'To nie jest wybieg' };
  if (def.habitat !== g.habitat) return { ok: false, why: `${ENCLOSURE_NAMES[def.habitat!]} nie pasuje — ${g.name} potrzebuje: ${ENCLOSURE_NAMES[g.habitat].toLowerCase()}` };
  if (pen < 0 || pen >= (o.pens ?? 0)) return { ok: false, why: 'Nie ma takiej zagrody' };
  const need = slotsOf(a.genusId), free = penSlots(s, o) - penUsed(s, enc, pen, uid);
  if (need > free) return { ok: false, why: `Brak miejsca: potrzeba ${need}, wolne ${free}` };
  const others = animalsIn(s, enc, pen).filter((x) => x.uid !== uid && x.genusId !== a.genusId);
  if (others.length && isCarnivore(a.genusId)) return { ok: false, why: `${g.name} to mięsożerca — mieszka tylko z własnym rodzajem` };
  const eater = others.find((x) => isCarnivore(x.genusId));
  if (eater) return { ok: false, why: `Tu mieszka mięsożerca (${GENERA.get(eater.genusId)!.name})` };
  return { ok: true };
}

export function putAnimal(s: GameState, uid: number, enc: number, pen: number): boolean {
  if (!canPut(s, uid, enc, pen).ok) return false;
  const a = s.animals.find((x) => x.uid === uid)!;
  a.enc = enc;
  a.pen = pen;
  return true;
}

export function toTransporter(s: GameState, uid: number): boolean {
  const a = s.animals.find((x) => x.uid === uid);
  if (!a || !a.enc) return false;
  a.enc = 0;
  a.pen = 0;
  return true;
}

/** best pen for an animal: a pen with its own genus, then an empty pen, then a mixed pen that accepts it */
export function bestPen(s: GameState, uid: number, onlyEnc?: number): [number, number] | null {
  const a = s.animals.find((x) => x.uid === uid);
  if (!a) return null;
  let best: [number, number] | null = null, bestScore = -Infinity;
  for (const o of enclosures(s)) {
    if (onlyEnc !== undefined && o.id !== onlyEnc) continue;
    if (defOf(o).habitat !== GENERA.get(a.genusId)!.habitat) continue;
    for (let p = 0; p < (o.pens ?? 0); p++) {
      if (o.id === a.enc && p === a.pen) continue;
      if (!canPut(s, uid, o.id, p).ok) continue;
      const here = animalsIn(s, o.id, p);
      const same = here.some((x) => x.genusId === a.genusId);
      const score = (same ? 3000 : here.length === 0 ? 2000 : 1000) + (connected(s, o) ? 500 : 0) - penUsed(s, o.id, p) * (same ? -1 : 1);
      if (score > bestScore) { bestScore = score; best = [o.id, p]; }
    }
  }
  return best;
}

/** put an animal where it fits best; false = it stays in the Transporter */
export function autoPlace(s: GameState, uid: number, onlyEnc?: number): boolean {
  const b = bestPen(s, uid, onlyEnc);
  if (!b) return false;
  return putAnimal(s, uid, b[0], b[1]);
}

export function canAddPen(s: GameState, enc: number): Check {
  const o = objById(s, enc);
  if (!o || defOf(o).cat !== 'enclosure') return { ok: false, why: 'To nie jest wybieg', cost: 0 };
  const cost = penCost(defOf(o), o.pens ?? 0);
  if ((o.pens ?? 0) >= maxPens(s, o)) return { ok: false, why: o.level < mods(s).encMaxLevel ? 'Ulepsz wybieg, by dodać więcej zagród' : 'Maksymalna liczba zagród — więcej dadzą Badania', cost };
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', cost };
  return { ok: true, cost };
}

export function addPen(s: GameState, enc: number): boolean {
  const c = canAddPen(s, enc);
  if (!c.ok) return false;
  s.coins -= c.cost;
  const o = objById(s, enc)!;
  o.pens = (o.pens ?? 0) + 1;
  return true;
}

export function canAddInterior(s: GameState, enc: number, decorId: string): Check {
  const o = objById(s, enc);
  const d = INTERIOR_BY_ID.get(decorId);
  if (!o || !d || defOf(o).cat !== 'enclosure') return { ok: false, why: 'Nie można', cost: 0 };
  if (d.habitat !== 'any' && d.habitat !== defOf(o).habitat) return { ok: false, why: 'Nie pasuje do tego habitatu', cost: d.cost };
  if ((o.decor ?? []).length >= interiorSlots(o.level)) return { ok: false, why: 'Brak miejsca na wystrój — ulepsz wybieg', cost: d.cost };
  if (s.coins < d.cost) return { ok: false, why: 'Za mało monet', cost: d.cost };
  return { ok: true, cost: d.cost };
}

export function addInterior(s: GameState, enc: number, decorId: string): boolean {
  const c = canAddInterior(s, enc, decorId);
  if (!c.ok) return false;
  s.coins -= c.cost;
  (objById(s, enc)!.decor ??= []).push(decorId);
  return true;
}

export function removeInterior(s: GameState, enc: number, index: number): boolean {
  const o = objById(s, enc);
  if (!o?.decor || index < 0 || index >= o.decor.length) return false;
  o.decor.splice(index, 1);
  return true;
}

// ---------------------------------------------------------------- happiness & income

const centre = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2];
/** gap in tiles between two rectangles (0 = touching) */
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** appeal points from decorations and attractions around a rectangle */
export function appealNear(s: GameState, island: number, r: Rect, exceptId = -1): number {
  let n = 0;
  for (const o of objectsOn(s, island)) {
    const ap = defOf(o).appeal;
    if (!ap || o.id === exceptId) continue;
    const range = defOf(o).cat === 'visitor' ? P.appealRadius + 2 : P.appealRadius;
    if (gap(r, rectOf(o)) <= range) n += ap;
  }
  return n;
}

export interface Happiness { base: number; level: number; inside: number; nearby: number; crowd: number; total: number }

export function happiness(s: GameState, o: ParkObject): Happiness {
  const inside = (o.decor ?? []).reduce((n, id) => n + (INTERIOR_BY_ID.get(id)?.comfort ?? 0), 0);
  const nearby = Math.min(P.happyNearbyCap, appealNear(s, o.island, rectOf(o)));
  let full = false;
  for (let p = 0; p < (o.pens ?? 0); p++) if (animalsIn(s, o.id, p).length && penUsed(s, o.id, p) >= penSlots(s, o)) full = true;
  const h: Happiness = { base: P.happyBase, level: P.happyPerLevel * (o.level - 1), inside, nearby, crowd: full ? -P.crowdPenalty : 0, total: 0 };
  h.total = Math.max(0, Math.min(100, h.base + h.level + h.inside + h.nearby + h.crowd));
  return h;
}

export const happyMult = (h: number) => P.happyMin + (P.happyMax - P.happyMin) * (h / 100);

/** stado (one genus) or mixed pen bonus */
export function penBonus(s: GameState, enc: number, pen: number): { kind: 'herd' | 'mixed' | 'single' | 'empty'; mult: number; n: number } {
  const here = animalsIn(s, enc, pen);
  if (!here.length) return { kind: 'empty', mult: 1, n: 0 };
  const genera = new Set(here.map((a) => a.genusId));
  if (genera.size === 1) {
    const extra = Math.min(P.herdMax, here.length - 1);
    return { kind: extra ? 'herd' : 'single', mult: 1 + P.herdPer * extra, n: here.length };
  }
  return { kind: 'mixed', mult: 1 + P.mixPer * genera.size, n: genera.size };
}

export function biomeBonus(o: ParkObject): number {
  const d = ISLAND_BY_ID.get(o.island)!;
  const h = defOf(o).habitat;
  return !d.bonusHabitat ? 1 + d.bonus : d.bonusHabitat === h ? 1 + d.bonus : 1;
}

/** income of one animal where it lives now (0 in the Transporter or without a path) */
export function animalRate(s: GameState, a: Animal, m: Mods = mods(s), coll = collectionBonus(s)): number {
  if (!a.enc) return 0;
  const o = objById(s, a.enc);
  if (!o || lacksPath(s, o)) return 0;
  const g = GENERA.get(a.genusId)!;
  return animalIncome(g.rarity, a.level, a.stage) * (1 + coll) * m.incomeMult * penBonus(s, o.id, a.pen).mult * happyMult(happiness(s, o).total) * biomeBonus(o);
}

export function enclosureRate(s: GameState, o: ParkObject, m: Mods = mods(s), coll = collectionBonus(s)): number {
  if (lacksPath(s, o)) return 0;
  const hm = happyMult(happiness(s, o).total) * biomeBonus(o) * (1 + coll) * m.incomeMult;
  let sum = 0;
  for (let p = 0; p < (o.pens ?? 0); p++) {
    const pb = penBonus(s, o.id, p).mult;
    for (const a of animalsIn(s, o.id, p)) {
      const g = GENERA.get(a.genusId)!;
      sum += animalIncome(g.rarity, a.level, a.stage) * pb;
    }
  }
  return sum * hm;
}

export function islandTickets(s: GameState, island: number, m: Mods = mods(s), coll = collectionBonus(s)): number {
  let n = 0;
  for (const o of objectsOn(s, island)) if (defOf(o).cat === 'enclosure') n += enclosureRate(s, o, m, coll);
  return n;
}

export function shopRate(s: GameState, o: ParkObject, tickets: number): number {
  const def = defOf(o);
  if (!def.shopShare || lacksPath(s, o)) return 0;
  const same = objectsOn(s, o.island).filter((x) => x.def === o.def).sort((a, b) => a.id - b.id);
  const k = same.findIndex((x) => x.id === o.id);
  const r = rectOf(o);
  let comfort = 0;
  for (const x of objectsOn(s, o.island)) {
    const c = defOf(x).comfort;
    if (c && !lacksPath(s, x) && gap(r, rectOf(x)) <= P.comfortRadius) comfort = Math.max(comfort, c * (1 + 0.1 * (x.level - 1)));
  }
  const appeal = Math.min(P.shopAppealCap, appealNear(s, o.island, r, o.id) * P.shopAppealPer);
  return tickets * def.shopShare * (1 + P.shopPerLevel * (o.level - 1)) * Math.pow(P.shopRepeat, Math.max(0, k)) * (1 + comfort) * (1 + appeal);
}

export const discoveredCount = (s: GameState) => Object.keys(s.discovered).length;

/** coins (or food units for farms) an object produces per second */
export function objectRate(s: GameState, o: ParkObject, m: Mods = mods(s), tickets?: number): number {
  const def = defOf(o);
  if (def.cat === 'enclosure') return enclosureRate(s, o, m);
  if (def.cat === 'farm') return foodRate(o.level) * m.farmMult;
  if (def.cat === 'visitor') return shopRate(s, o, tickets ?? islandTickets(s, o.island, m));
  if (def.station === 'museum') return lacksPath(s, o) ? 0 : m.museumRate * discoveredCount(s);
  return 0;
}

/** how much an object's storage holds */
export function storeCap(o: ParkObject, rate: number, m: Mods): number {
  const def = defOf(o);
  const hours = def.cat === 'enclosure' ? m.bankHours : def.cat === 'farm' ? P.farmHours : P.shopHours;
  return Math.max(def.cat === 'farm' ? 20 : P.minStore, rate * 3600 * hours);
}

export const produces = (o: ParkObject) => { const d = defOf(o); return d.cat === 'enclosure' || d.cat === 'farm' || !!d.shopShare || d.station === 'museum'; };

/** fill every storage; with Automatic tills the takings go straight to the wallet */
export function produceTick(s: GameState, dt: number, m: Mods): void {
  const coll = collectionBonus(s);
  const tickets = new Map<number, number>();
  for (const i of boughtIslands(s)) tickets.set(i, islandTickets(s, i, m, coll));
  for (const o of s.park.objects) {
    if (!produces(o)) continue;
    const def = defOf(o);
    const rate = def.cat === 'enclosure' ? enclosureRate(s, o, m, coll) : objectRate(s, o, m, tickets.get(o.island));
    if (rate <= 0) continue;
    o.store = Math.min(storeCap(o, rate, m), o.store + rate * dt);
    if (m.autoCollect) collect(s, o.id);
  }
}

export interface Collected { coins: number; food?: Partial<Record<Food, number>> }

export function collect(s: GameState, id: number): Collected | null {
  const o = objById(s, id);
  if (!o || o.store < 1) return null;
  const def = defOf(o);
  const n = Math.floor(o.store);
  o.store -= n;
  if (def.cat === 'farm') {
    const food: Partial<Record<Food, number>> = {};
    for (const f of def.food!) { s.food[f] += n; food[f] = n; }
    return { coins: 0, food };
  }
  s.coins += n;
  return { coins: n };
}

/** total coins per second of the whole park (enclosures, shops, museum) */
export function parkIncome(s: GameState, m: Mods = mods(s)): number {
  let n = 0;
  const coll = collectionBonus(s);
  for (const i of boughtIslands(s)) {
    const t = islandTickets(s, i, m, coll);
    n += t;
    for (const o of objectsOn(s, i)) {
      const d = defOf(o);
      if (d.shopShare || d.station === 'museum') n += objectRate(s, o, m, t);
    }
  }
  return n;
}

/** fraction of storage filled (for the bubbles) */
export function storeFill(s: GameState, o: ParkObject, m: Mods = mods(s)): number {
  const rate = objectRate(s, o, m);
  return rate > 0 || o.store > 0 ? Math.min(1, o.store / storeCap(o, Math.max(rate, 1e-9), m)) : 0;
}

// ---------------------------------------------------------------- automatic layout (new game, old saves, bot)

/** extend a straight path from (x, y) in a direction while the land allows */
function layLine(s: GameState, island: number, x: number, y: number, dx: number, dy: number): void {
  const t = terrain(island);
  const tiles: [number, number][] = [];
  while (inside(t, x, y) && canPath(s, island, x, y).ok) { tiles.push([x, y]); x += dx; y += dy; }
  setPaths(s, island, tiles, true, true);
}

/** a main avenue north from the gate and a cross street every 11 rows (room for the biggest enclosure between two streets) */
export function layStreets(s: GameState, island: number): void {
  const gate = objectsOn(s, island).find((o) => o.def === 'gate');
  if (!gate) return;
  const ax = gate.x + 1, top = gate.y - 1;
  layLine(s, island, ax, top, 0, -1);
  const t = terrain(island);
  for (let y = top; y > 0; y -= 11) {
    if (!(s.park.paths[island] ?? []).includes(y * t.w + ax)) break;
    layLine(s, island, ax - 1, y, -1, 0);
    layLine(s, island, ax + 1, y, 1, 0);
  }
}

/** a free spot for an object: next to a path connected to the gate, as close to the gate as possible */
export function findSpot(s: GameState, island: number, defId: string, level = 1): { x: number; y: number; rot: 0 | 1 } | null {
  const def = PLACE_BY_ID.get(defId)!;
  const t = terrain(island);
  const gate = objectsOn(s, island).find((o) => o.def === 'gate');
  const [gx, gy] = gate ? centre(rectOf(gate)) : [t.w / 2, t.h / 2];
  const { conn, occ, paths, cleared } = islandCache(s, island);
  // summed-area table of free tiles (buildable, empty, no path): any rectangle is checked in O(1)
  const W1 = t.w + 1;
  const sat = new Int32Array(W1 * (t.h + 1));
  for (let y = 0; y < t.h; y++) {
    let row = 0;
    for (let x = 0; x < t.w; x++) {
      const i = y * t.w + x;
      const free = t.tiles[i] >= Tile.Sand && !occ[i] && !paths.has(i) && cleared.has(chunkOf(t, x, y)) ? 1 : 0;
      row += free;
      sat[(y + 1) * W1 + x + 1] = sat[y * W1 + x + 1] + row;
    }
  }
  const freeRect = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= t.w && y + h <= t.h
    && sat[(y + h) * W1 + x + w] - sat[y * W1 + x + w] - sat[(y + h) * W1 + x] + sat[y * W1 + x] === w * h;
  let best: { x: number; y: number; rot: 0 | 1 } | null = null, bestD = Infinity;
  const tryAt = (x: number, y: number, rot: 0 | 1) => {
    const [w, h] = sizeAt(def, level, rot);
    const d = Math.hypot(x + w / 2 - gx, y + h / 2 - gy) + (rot ? 0.5 : 0);
    if (d >= bestD || !freeRect(x, y, w, h)) return;
    if (def.needsWater && !canPlace(s, defId, island, x, y, rot, { free: true, level }).ok) return;
    best = { x, y, rot }; bestD = d;
  };
  for (const i of conn) {
    const px = i % t.w, py = (i - px) / t.w;
    for (const rot of [0, 1] as const) {
      const [w, h] = sizeAt(def, level, rot);
      for (let x = px - w + 1; x <= px; x++) { tryAt(x, py - h, rot); tryAt(x, py + 1, rot); }
      for (let y = py - h + 1; y <= py; y++) { tryAt(px - w, y, rot); tryAt(px + 1, y, rot); }
    }
  }
  if (best || def.needsPath) return best;
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) tryAt(x, y, 0);
  return best;
}

/** clear (for free) the wild chunk nearest to the island centre that touches cleared land */
function growIsland(s: GameState, island: number): boolean {
  const t = terrain(island);
  const ic = islandCache(s, island);
  let best = -1, bestD = Infinity;
  for (const c of t.landChunks) {
    if (ic.cleared.has(c)) continue;
    const cx = c % t.cw, cy = (c - cx) / t.cw;
    if (![[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]].some(([x, y]) => ic.cleared.has(y * t.cw + x))) continue;
    const d = Math.hypot((cx + 0.5) * CHUNK - t.w / 2, (cy + 0.5) * CHUNK - t.h / 2);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best < 0) return false;
  clearChunk(s, island, best, true);
  return true;
}

/** place an object automatically (free), growing the island and its streets when needed */
export function autoBuild(s: GameState, island: number, defId: string, level = 1, opts: { grow?: boolean } = {}): ParkObject | null {
  for (let tries = 0; tries < 40; tries++) {
    const at = findSpot(s, island, defId, level);
    if (at) return place(s, defId, island, at.x, at.y, at.rot, { free: true, level });
    if (!opts.grow || !growIsland(s, island)) return null;
    layStreets(s, island);
  }
  return null;
}

/** starting park of a new game */
export function initPark(s: GameState): void {
  buyIsland(s, 1, true);
  layStreets(s, 1);
  for (const b of STATION_IDS) if (s.buildings[b] > 0) autoBuild(s, 1, stationDefId(b), 1, { grow: true });
  // the first site is a Cambrian sea: a lagoon, plus meat and plankton for its predators and filter feeders
  autoBuild(s, 1, enclosureDefId('marine'), 1, { grow: true });
  autoBuild(s, 1, 'farm_meat', 1, { grow: true });
  autoBuild(s, 1, 'farm_aqua', 1, { grow: true });
}

/** cost of the station placed for the first time (shown in the build bar) */
export const stationPlaceCost = (b: keyof GameState['buildings']) => buildingCost(BUILDING_BY_ID[b], 1);

/** choose an enclosure level big enough for a set of animals */
export function levelFor(slots: number): number {
  for (let l = 1; l <= 5; l++) { const e = encLevel(l); if (e.pens * e.penSlots >= slots * 1.25 + 2) return l; }
  return 5;
}

export type { Terrain, Habitat };

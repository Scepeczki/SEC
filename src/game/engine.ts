// Main loop: tick, offline progress, game start, save/load.

import { GENERA } from '../data/db';
import { crewTick, siteState, tutorialGenus } from './dig';
import { refundRemovedNodes } from './tools';
import { hatchTick, labTick } from './lab';
import { gateOf, updateContracts } from './meta';
import { mods } from './mods';
import { START_SITE } from './content';
import { parkTick } from './park';
import { type Animal, type GameState, SAVE_VERSION, log, newGame } from './state';
import { B } from './balance';
import { autoBuild, autoPlace, buyIsland, defOf, initPark, layStreets, levelFor, resizeEnclosures, slotsOf, touch } from './parkmap';
import { ISLAND_BY_ID, LEGACY_ENC_SIZE, STATION_IDS, enclosureDefId, stationDefId } from './parkContent';
import type { Habitat } from '../data/types';

export function startGame(now = Date.now(), seed?: number): GameState {
  const s = newGame(now, seed);
  initPark(s);
  const tg = tutorialGenus(START_SITE);
  if (tg !== undefined) s.researchedClades[gateOf(tg)] = now;
  siteState(s, START_SITE);
  updateContracts(s, mods(s));
  log(s, 'Witaj w parku! Na mapie świata kup pozwolenie na pierwsze wykopalisko: kambryjskie morze Chengjiang.', 'info');
  return s;
}

/** advance simulation by dt seconds */
export function tick(s: GameState, dt: number): void {
  if (dt <= 0) return;
  const m = mods(s);
  s.now += dt * 1000;
  s.playSeconds += dt;
  crewTick(s, dt, m);
  labTick(s, dt, m);
  hatchTick(s, dt, m);
  parkTick(s, dt, m);
  updateContracts(s, m);
}

export interface OfflineSummary {
  seconds: number;
  capped: boolean;
  coins: number;
  /** coins waiting in enclosures, shops and the museum to be collected */
  stored: number;
  pb: number;
  fossils: number;
  hatched: number;
  extractions: number;
  mutagen: number;
  discoveries: number;
}

/** catch up after being away (chunked so queues complete in order) */
export function catchUp(s: GameState, nowMs = Date.now()): OfflineSummary | null {
  const elapsed = (nowMs - s.now) / 1000;
  if (elapsed < 5) {
    if (elapsed > 0) tick(s, elapsed);
    return null;
  }
  const capS = mods(s).offlineHours * 3600;
  const sim = Math.min(elapsed, capS);
  const before = { disc: Object.keys(s.discovered).length, coins: s.coins, stored: storedCoins(s), pb: s.pb, fossils: s.stats.fossils, hatched: s.animals.length, ext: s.stats.extractions, mutagen: s.mutagen };
  const step = 20;
  let left = sim;
  while (left > 0) {
    const d = Math.min(step, left);
    tick(s, d);
    left -= d;
  }
  s.now = nowMs;
  return {
    seconds: sim,
    capped: elapsed > capS,
    coins: s.coins - before.coins,
    stored: Math.max(0, storedCoins(s) - before.stored),
    pb: s.pb - before.pb,
    fossils: s.stats.fossils - before.fossils,
    hatched: s.animals.length - before.hatched,
    extractions: s.stats.extractions - before.ext,
    mutagen: s.mutagen - before.mutagen,
    discoveries: Object.keys(s.discovered).length - before.disc,
  };
}

// ---------------------------------------------------------------- save / load

export const SAVE_KEY = 'dinozaury-save-v1';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState | null {
  try {
    const raw = JSON.parse(json) as GameState;
    return migrate(raw);
  } catch {
    return null;
  }
}

const storedCoins = (s: GameState) => s.park.objects.reduce((n, o) => n + (defOf(o).cat === 'farm' ? 0 : o.store), 0);

/** 0.2 → 0.3: habitats, plots and the shared till become enclosures and buildings on Island 1 */
function migratePark(s: GameState): void {
  const old = s as unknown as {
    habitats?: { id: number; type: Habitat; level: number }[]; plots?: number; bank?: number; nextHabitatId?: number;
    buildings: Record<string, number>;
  };
  s.park = { islands: {}, objects: [], nextId: 1, paths: {}, rev: 0 };
  buyIsland(s, 1, true);
  layStreets(s, 1);
  // money spent on plots and the till's takings come back as coins
  let refund = Math.round(old.bank ?? 0);
  for (let p = B.startPlots; p < (old.plots ?? B.startPlots); p++) refund += Math.round(B.plotCost * Math.pow(B.plotCostGrowth, p - B.startPlots));
  s.coins += refund;
  for (const b of STATION_IDS) if ((s.buildings[b] ?? 0) > 0) autoBuild(s, 1, stationDefId(b), 1, { grow: true });
  const farms: [string, string][] = [['ranch', 'farm_meat'], ['greenhouse', 'farm_plants'], ['aquaculture', 'farm_aqua']];
  for (const [oldId, defId] of farms) {
    const lvl = old.buildings[oldId] ?? 0;
    if (lvl > 0) {
      const o = autoBuild(s, 1, defId, 1, { grow: true });
      if (o) o.level = lvl;
    }
    delete old.buildings[oldId];
  }
  // every habitat becomes an enclosure with enough pens for its animals
  const animals = s.animals as unknown as (Animal & { habitatId?: number })[];
  for (const a of animals) { a.enc = 0; a.pen = 0; }
  for (const h of old.habitats ?? []) {
    const inside = animals.filter((a) => a.habitatId === h.id);
    const slots = inside.reduce((n, a) => n + slotsOf(a.genusId), 0);
    const o = autoBuild(s, 1, enclosureDefId(h.type), levelFor(Math.max(slots, 4)), { grow: true });
    if (!o) continue;
    for (const a of inside) autoPlace(s, a.uid, o.id);
  }
  for (const a of animals) { if (!a.enc) autoPlace(s, a.uid); delete a.habitatId; }
  for (const inc of s.incubating as unknown as { habitatId?: number }[]) delete inc.habitatId;
  delete old.habitats; delete old.plots; delete old.bank; delete old.nextHabitatId;
  if (refund > 0) log(s, `Nowy park! Działki i kasa zamieniły się w ${refund} monet. Wszystko stoi na Wyspie Startowej — możesz to dowolnie poprzestawiać.`, 'good');
}

function migrate(s: GameState): GameState | null {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return null;
  // drop references to genera that no longer exist in data
  s.animals = (s.animals ?? []).filter((a) => GENERA.has(a.genusId));
  if (s.v < 2 || !s.park) migratePark(s);
  else if (s.v < 3) {
    // 0.3.0 → 0.3.1: islands keep the larger clear area they were bought with; enclosures get one fixed footprint
    for (const [id, st] of Object.entries(s.park.islands)) st.start ??= ISLAND_BY_ID.get(Number(id))?.legacyClear;
    touch(s);
    resizeEnclosures(s, LEGACY_ENC_SIZE);
  }
  const fresh = newGame(s.now, s.seed);
  // fill any missing fields from a fresh state (forward compatible)
  for (const k of Object.keys(fresh) as (keyof GameState)[]) {
    if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
  }
  for (const b of Object.keys(fresh.buildings) as (keyof GameState['buildings'])[]) if (s.buildings[b] === undefined) s.buildings[b] = fresh.buildings[b];
  // hammer + georadar moved from research into the tool trees (0.2)
  s.tools ??= {};
  const radar = s.tech.dig3d ? 4 : s.tech.dig3c ? 3 : s.tech.dig3b ? 2 : s.tech.dig3 ? 1 : 0;
  if (radar > (s.tools.r_res ?? 0)) s.tools.r_res = radar;
  if (s.settings.sound === undefined) s.settings.sound = 0.6;
  // 0.4: sites open oldest first — older saves get the new first site for free (what they unlocked stays unlocked)
  if (s.v < 5 && !s.unlockedSites[START_SITE]) s.unlockedSites[START_SITE] = s.now;
  // 0.5: story mode (on by default; older saves have already bought their first site)
  if (s.v < 5) s.story = { on: true, seen: { bought_first: s.now } };
  s.shards ??= 0;
  // rock got softer in 0.4: layers dug under the old numbers are scaled down to the new strength
  for (const st of Object.values(s.sites)) {
    const cap = B.tileHp * (1 + st.depth * B.tileHpPerDepth) * Math.pow(B.tileHpExp, st.depth) * 1.25;
    for (const t of st.tiles) {
      const c = cap * (t.flint ? 1.5 : 1); // flint is meant to be 1.5× harder
      if (t.max > c * 1.01) { const k = c / t.max; t.max = c; if (t.hp > 0) t.hp = Math.max(0.01, t.hp * k); }
    }
  }
  if (s.v < 4) {
    // 0.4 (dig 2.0): one brush and chain reactions — everything spent on the old brush / hammer / charge trees comes back
    const back = refundRemovedNodes(s);
    s.settings.tool = 'brush';
    delete (s as unknown as { charges?: unknown }).charges;
    for (const st of Object.values(s.sites)) { delete (st as unknown as { burns?: unknown }).burns; st.uses ??= {}; }
    if (back.shards || back.pb) log(s, `Nowy Warsztat! Zwrot za stare ulepszenia narzędzi: ${Math.round(back.shards)} odłamków i ${Math.round(back.pb)} punktów badań.`, 'good');
  }
  s.chests ??= [];
  // animals whose enclosure is gone wait in the Transporter
  const ids = new Set(s.park.objects.map((o) => o.id));
  for (const a of s.animals) if (a.enc && !ids.has(a.enc)) { a.enc = 0; a.pen = 0; }
  s.v = SAVE_VERSION;
  return s;
}

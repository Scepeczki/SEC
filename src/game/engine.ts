// Main loop: tick, offline progress, game start, save/load.

import { GENERA } from '../data/db';
import { burnTick, chargeTick, crewTick, siteState, tutorialGenus } from './dig';
import { hatchTick, labTick } from './lab';
import { gateOf, updateContracts } from './meta';
import { mods } from './mods';
import { parkTick } from './park';
import { type GameState, SAVE_VERSION, log, newGame } from './state';

export function startGame(now = Date.now(), seed?: number): GameState {
  const s = newGame(now, seed);
  const tg = tutorialGenus('morrison');
  if (tg !== undefined) s.researchedClades[gateOf(tg)] = now;
  siteState(s, 'morrison');
  updateContracts(s, mods(s));
  log(s, 'Witaj w parku! Zacznij od kopania na stanowisku Morrison — klikaj skały.', 'info');
  return s;
}

/** advance simulation by dt seconds */
export function tick(s: GameState, dt: number): void {
  if (dt <= 0) return;
  const m = mods(s);
  s.now += dt * 1000;
  s.playSeconds += dt;
  crewTick(s, dt, m);
  burnTick(s, dt, m);
  chargeTick(s, dt, m);
  labTick(s, dt, m);
  hatchTick(s, dt, m);
  parkTick(s, dt, m);
  updateContracts(s, m);
}

export interface OfflineSummary {
  seconds: number;
  capped: boolean;
  coins: number;
  bank: number;
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
  const before = { disc: Object.keys(s.discovered).length, coins: s.coins, bank: s.bank, pb: s.pb, fossils: s.stats.fossils, hatched: s.animals.length, ext: s.stats.extractions, mutagen: s.mutagen };
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
    bank: s.bank - before.bank,
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

function migrate(s: GameState): GameState | null {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return null;
  // future: if (s.v < 2) { ... s.v = 2 }
  const fresh = newGame(s.now, s.seed);
  // fill any missing fields from a fresh state (forward compatible)
  for (const k of Object.keys(fresh) as (keyof GameState)[]) {
    if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
  }
  for (const b of Object.keys(fresh.buildings) as (keyof GameState['buildings'])[]) if (s.buildings[b] === undefined) s.buildings[b] = fresh.buildings[b];
  // hammer + georadar moved from research into the tool trees
  s.tools ??= {};
  if (s.tech.dig2 && !s.tools.h_unlock) s.tools.h_unlock = 1;
  const radar = s.tech.dig3d ? 4 : s.tech.dig3c ? 3 : s.tech.dig3b ? 2 : s.tech.dig3 ? 1 : 0;
  if (radar > (s.tools.r_res ?? 0)) s.tools.r_res = radar;
  if (s.settings.sound === undefined) s.settings.sound = 0.6;
  s.shards ??= 0;
  s.charges ??= { n: 1, acc: 0 };
  s.chests ??= [];
  // drop references to genera that no longer exist in data
  s.animals = s.animals.filter((a) => GENERA.has(a.genusId));
  s.v = SAVE_VERSION;
  return s;
}

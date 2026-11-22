// Headless balance simulation: a greedy bot plays N days in short sessions.
// Usage: npm run sim -- [days=14] [sessionsPerDay=3] [sessionMinutes=20] [clicksPerSec=2]

import { GENERA, SITES } from '../src/data/db';
import { BUILDINGS, SITE_UNLOCK, TECH } from '../src/game/content';
import { hitTile, openChest, siteState } from '../src/game/dig';
import { catchUp, startGame, tick } from '../src/game/engine';
import { canSynthesize, queueAll, synthesize } from '../src/game/lab';
import { canResearchClade, claimContract, cladeCost, gateOf, parkLevel, researchClade, unlockSite, canUnlockSite, uniqueHatched } from '../src/game/meta';
import { mods } from '../src/game/mods';
import { buyTech, canEvolve, canUpgradeBuilding, evolve, feed, incomePerSec, stationBuilt, upgradeBuilding } from '../src/game/park';
import type { GameState } from '../src/game/state';
import { TOOL_NODES, buyToolNode, canBuyToolNode } from '../src/game/tools';
import type { Habitat } from '../src/data/types';
import { fmt } from '../src/game/balance';
import {
  autoPlace, boughtIslands, buyIsland, canBuyIsland, canClear, canPlace, canUpgrade, clearChunk, collect, countOf, defOf, enclosures, findSpot,
  layStreets, place, transporter, upgradeObject,
} from '../src/game/parkmap';
import { ISLANDS, enclosureDefId, placeCost, PLACE_BY_ID, stationDefId } from '../src/game/parkContent';
import { terrain } from '../src/game/islands';

/** place something wherever it fits (paying for it), clearing land or buying an island when needed */
function buildSomewhere(st: GameState, defId: string): boolean {
  const def = PLACE_BY_ID.get(defId)!;
  if (st.coins < placeCost(def, countOf(st, defId)) * 1.2) return false;
  for (const id of boughtIslands(st)) {
    const at = findSpot(st, id, defId);
    if (at && canPlace(st, defId, id, at.x, at.y, at.rot).ok) return !!place(st, defId, id, at.x, at.y, at.rot);
  }
  // more room: clear a chunk on any island, then lay streets there
  for (const id of boughtIslands(st)) {
    const t = terrain(id);
    for (const c of t.landChunks) if (canClear(st, id, c).ok) { clearChunk(st, id, c); layStreets(st, id); return false; }
  }
  return false;
}

const days = Number(process.argv[2] ?? 14);
const sessions = Number(process.argv[3] ?? 3);
const sessionMin = Number(process.argv[4] ?? 20);
const cps = Number(process.argv[5] ?? 2);

const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
const s = startGame(t0, 12345);
let activeSec = 0;
/** purchases per 5-minute window of active play: [workshop, stations, research] */
const buys: [number, number, number][] = [];
const WINSEC = Number(process.env.WINSEC ?? 300);
const buy = (k: 0 | 1 | 2) => { const w = Math.floor(activeSec / WINSEC); while (buys.length <= w) buys.push([0, 0, 0]); buys[w][k]++; };
const milestones: [string, number, number][] = [];
const seen = new Set<string>();
const mark = (key: string, label = key) => {
  if (seen.has(key)) return;
  seen.add(key);
  milestones.push([label, (s.now - t0) / 1000, activeSec]);
};
const fmtT = (sec: number) => sec < 3600 ? `${(sec / 60).toFixed(1)} min` : sec < 86400 * 2 ? `${(sec / 3600).toFixed(1)} h` : `${(sec / 86400).toFixed(1)} d`;

const sliceSites = Object.keys(SITE_UNLOCK).slice(0, 6);
const sliceGenera = new Set(SITES.filter((x) => sliceSites.includes(x.id)).flatMap((x) => x.fauna.map((f) => f.genusId)));

function click(st: GameState) {
  const site = siteState(st, st.activeSite);
  const m = mods(st);
  const open: number[] = [];
  const pref: number[] = [];
  site.tiles.forEach((t, i) => { if (t.hp > 0) { open.push(i); if (t.item >= 0 && !site.items[t.item].found) pref.push(i); } });
  // a player goes for the modifiers first (they set off chains), then for the finds
  const mods2 = open.filter((i) => site.tiles[i].mod);
  const pool = mods2.length && Math.random() < 0.6 ? mods2 : m.scanner && pref.length ? pref : open;
  if (!pool.length) return;
  hitTile(st, st.activeSite, pool[Math.floor(Math.random() * pool.length)], m);
}

function policy(st: GameState) {
  for (const o of st.park.objects) collect(st, o.id);
  for (const c of [...st.contracts]) claimContract(st, c.id);
  for (const c of [...(st.chests ?? [])]) openChest(st, c.id);
  // research gates of discovered genera, cheapest first
  const gates = [...new Set(Object.keys(st.discovered).map((id) => gateOf(Number(id))))].filter((g) => !st.researchedClades[g]).sort((a, b) => cladeCost(a) - cladeCost(b));
  for (const g of gates) if (canResearchClade(st, g).ok) researchClade(st, g);
  // extraction
  for (const id of Object.keys(st.fossils).map(Number)) queueAll(st, id);
  // synthesis: new genera first
  const m = mods(st);
  const cands = Object.keys(st.genome).map(Number).filter((id) => (st.genome[id] ?? 0) >= 50).sort((a, b) => (st.hatched[a] ? 1 : 0) - (st.hatched[b] ? 1 : 0));
  for (const id of cands) {
    if (st.hatched[id] && st.animals.filter((a) => a.genusId === id).length >= 1) continue;
    const c = canSynthesize(st, id, m);
    if (c.ok) synthesize(st, id, m);
  }
  // animals waiting in the Transporter: make room for them
  for (const a of transporter(st).slice(0, 20)) {
    if (autoPlace(st, a.uid)) continue;
    const hab: Habitat = GENERA.get(a.genusId)!.habitat;
    const own = enclosures(st).filter((o) => defOf(o).habitat === hab).sort((x, y) => x.level - y.level);
    const up = own.find((o) => canUpgrade(st, o.id).ok && st.coins > canUpgrade(st, o.id).cost * 1.5);
    if (up) upgradeObject(st, up.id);
    else buildSomewhere(st, enclosureDefId(hab));
    autoPlace(st, a.uid);
  }
  // stations that are not on the map yet
  for (const b of BUILDINGS) if (!stationBuilt(st, b.id) && parkLevel(st) >= b.unlockLevel) buildSomewhere(st, stationDefId(b.id));
  // a few shops and islands
  if (countOf(st, 'v_kiosk') < boughtIslands(st).length && parkLevel(st) >= 1) buildSomewhere(st, 'v_kiosk');
  if (countOf(st, 'v_bar') < boughtIslands(st).length && parkLevel(st) >= 2) buildSomewhere(st, 'v_bar');
  for (const d of ISLANDS) if (canBuyIsland(st, d.id).ok && st.coins > d.cost * 3) { buyIsland(st, d.id); layStreets(st, d.id); }
  // farms keep up with the food the animals eat
  for (const [f, defId] of [['meat', 'farm_meat'], ['plants', 'farm_plants'], ['fish', 'farm_aqua']] as const) {
    if (st.food[f] > 400) continue;
    const farm = st.park.objects.filter((o) => o.def === defId).sort((x, y) => x.level - y.level)[0];
    if (farm && canUpgrade(st, farm.id).ok && st.coins > canUpgrade(st, farm.id).cost * 2) upgradeObject(st, farm.id);
    else if (!farm) buildSomewhere(st, defId);
  }
  // feed & evolve
  for (const a of [...st.animals].sort((x, y) => x.level - y.level)) {
    feed(st, a.uid, 5, m);
    if (canEvolve(st, a, m).ok) evolve(st, a.uid, m);
  }
  // workshop: chain reactions first, then the cheapest node
  for (let k = 0; k < 4; k++) {
    const opts = TOOL_NODES.map((n) => ({ n, c: canBuyToolNode(st, n.id) })).filter((x) => x.c.ok).sort((a, b) => (a.n.tool === 'rock' || a.n.tool === 'combo' ? 0 : 1) - (b.n.tool === 'rock' || b.n.tool === 'combo' ? 0 : 1) || a.c.shards - b.c.shards);
    if (!opts.length) break;
    if (buyToolNode(st, opts[0].n.id)) buy(0);
  }
  // tech
  for (const t of [...TECH].sort((a, b) => a.cost - b.cost)) if (buyTech(st, t.id)) buy(2);
  // sites
  for (const id of Object.keys(SITE_UNLOCK)) if (canUnlockSite(st, id).ok) unlockSite(st, id);
  let best = st.activeSite, bestN = -1;
  for (const id of Object.keys(st.unlockedSites)) { const site = SITES.find((x) => x.id === id)!; const n = site.fauna.filter((f) => !st.hatched[f.genusId]).length; if (n > bestN) { bestN = n; best = id; } }
  st.activeSite = best;
  // stations: cheapest affordable upgrade with a reserve
  for (let k = 0; k < 5; k++) {
    const opts = BUILDINGS.map((b) => ({ b, c: canUpgradeBuilding(st, b.id) })).filter((x) => x.c.ok && st.coins > x.c.cost * 1.6).sort((a, b) => a.c.cost - b.c.cost);
    if (!opts.length) break;
    if (upgradeBuilding(st, opts[0].b.id)) buy(1);
  }
  // milestones
  if (st.stats.fossils > 0) mark('pierwsza skamieniałość');
  if ((st.tools?.g_arrow ?? 0) > 0) mark('Iskra (reakcje)');
  if ((st.digRecords?.combo ?? 0) >= 10) mark('combo 10+');
  if ((st.digRecords?.combo ?? 0) >= 25) mark('combo 25+');
  if (st.animals.length > 0) mark('pierwsze zwierzę');
  if (st.animals.some((a) => a.stage >= 1)) mark('pierwsze Dorosłe');
  if (st.animals.some((a) => a.stage >= 2)) mark('pierwsze Wzmocnione');
  if (st.animals.some((a) => a.stage >= 3)) mark('pierwsze Elitarne');
  if (st.animals.some((a) => a.stage >= 4)) mark('pierwszy Apeks');
  for (const id of Object.keys(st.unlockedSites)) mark('site:' + id, `stanowisko ${id}`);
  const lvl = parkLevel(st);
  for (const L of [3, 5, 10, 15, 20]) if (lvl >= L) mark('lvl' + L, `poziom parku ${L}`);
  const u = uniqueHatched(st);
  for (const n of [5, 10, 25, 50, 100, 200, 400]) if (u >= n) mark('col' + n, `kolekcja ${n} rodzajów`);
}

const daySec = 86400;
const sessionStarts = Array.from({ length: sessions }, (_, i) => i * Math.floor((14 * 3600) / Math.max(1, sessions - 1 || 1)));
for (let d = 0; d < days; d++) {
  for (const st of sessionStarts) {
    const target = t0 + (d * daySec + st) * 1000;
    const tA = Date.now();
    if (target > s.now) catchUp(s, target);
    if (process.env.SIM_DEBUG) console.log('catchUp ms', Date.now() - tA, 'day', d, 'layers', s.stats.layers);
    for (let sec = 0; sec < sessionMin * 60; sec++) {
      for (let c = 0; c < cps; c++) click(s);
      tick(s, 1);
      activeSec++;
      if (sec % 10 === 0) policy(s);
    }
  }
  const hatchedSlice = [...sliceGenera].filter((id) => s.hatched[id]).length;
  console.log(`dzień ${String(d + 1).padStart(2)}: wyspy ${boughtIslands(s).length}, wybiegi ${enclosures(s).length}, transporter ${transporter(s).length}, poziom ${parkLevel(s)}, kolekcja ${uniqueHatched(s)} (wycinek ${hatchedSlice}/${sliceGenera.size}), odkryte ${Object.keys(s.discovered).length}, skam. ${s.stats.fossils}, zwierząt ${s.animals.length}, monety ${fmt(s.coins)}, dochód ${fmt(incomePerSec(s))}/s, PB ${fmt(s.pb)}, mutagen ${s.mutagen}, stanowiska ${Object.keys(s.unlockedSites).length}, max stadium ${Math.max(0, ...s.animals.map((a) => a.stage))}, rekord combo ${s.digRecords?.combo ?? 0}, odłamki ${fmt(s.shards)}`);
}
console.log('\nKAMIENIE MILOWE (czas rzeczywisty / czas aktywnej gry):');
const bar = (n: number) => '#'.repeat(Math.min(40, n));
console.log('ZAKUPY NA OKNO AKTYWNEJ GRY (W = Warsztat, S = stacje, B = badania):');
buys.slice(0, Number(process.env.WIN ?? 48)).forEach(([w, st2, b], i) => console.log(`${String(Math.round((i * WINSEC) / 60)).padStart(4)} min  W${String(w).padStart(2)} S${String(st2).padStart(2)} B${String(b).padStart(2)}  ${bar(w + st2 + b)}`));
for (const [l, t, a] of milestones) console.log(`  ${l.padEnd(28)} ${fmtT(t).padStart(9)}   aktywnie ${fmtT(a)}`);
console.log('\nbudynki:', JSON.stringify(s.buildings));
console.log('statystyki:', JSON.stringify(s.stats));

if (process.env.SAVE_OUT) {
  const { serialize } = await import('../src/game/engine');
  (await import('node:fs')).writeFileSync(process.env.SAVE_OUT, serialize(s));
  console.log('zapis ->', process.env.SAVE_OUT);
}

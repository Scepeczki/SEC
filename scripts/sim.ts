// Headless balance simulation: a greedy bot plays N days in short sessions.
// Usage: npm run sim -- [days=14] [sessionsPerDay=3] [sessionMinutes=20] [clicksPerSec=2]

import { GENERA, SITES } from '../src/data/db';
import { BUILDINGS, SITE_UNLOCK, TECH } from '../src/game/content';
import { hitTile, siteState } from '../src/game/dig';
import { catchUp, startGame, tick } from '../src/game/engine';
import { canSynthesize, queueAll, synthesize } from '../src/game/lab';
import { canResearchClade, claimContract, cladeCost, gateOf, parkLevel, researchClade, unlockSite, canUnlockSite, uniqueHatched } from '../src/game/meta';
import { mods } from '../src/game/mods';
import { buildHabitat, buyPlot, buyTech, canBuildHabitat, canEvolve, canUpgradeBuilding, collectBank, evolve, feed, incomePerSec, plotCost, upgradeBuilding } from '../src/game/park';
import type { GameState } from '../src/game/state';
import { fmt } from '../src/game/balance';

const days = Number(process.argv[2] ?? 14);
const sessions = Number(process.argv[3] ?? 3);
const sessionMin = Number(process.argv[4] ?? 20);
const cps = Number(process.argv[5] ?? 2);

const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
const s = startGame(t0, 12345);
let activeSec = 0;
const milestones: [string, number, number][] = [];
const seen = new Set<string>();
const mark = (key: string, label = key) => {
  if (seen.has(key)) return;
  seen.add(key);
  milestones.push([label, (s.now - t0) / 1000, activeSec]);
};
const fmtT = (sec: number) => sec < 3600 ? `${(sec / 60).toFixed(1)} min` : sec < 86400 * 2 ? `${(sec / 3600).toFixed(1)} h` : `${(sec / 86400).toFixed(1)} d`;

const sliceSites = ['morrison', 'hell_creek', 'krasiejow', 'solnhofen', 'burgess', 'niobrara'];
const sliceGenera = new Set(SITES.filter((x) => sliceSites.includes(x.id)).flatMap((x) => x.fauna.map((f) => f.genusId)));

function click(st: GameState) {
  const site = siteState(st, st.activeSite);
  const m = mods(st);
  const open: number[] = [];
  const pref: number[] = [];
  site.tiles.forEach((t, i) => { if (t.hp > 0) { open.push(i); if (t.item >= 0 && !site.items[t.item].found) pref.push(i); } });
  const pool = m.scanner && pref.length ? pref : open;
  if (!pool.length) return;
  hitTile(st, st.activeSite, pool[Math.floor(Math.random() * pool.length)], 'brush', m);
}

function policy(st: GameState) {
  collectBank(st);
  for (const c of [...st.contracts]) claimContract(st, c.id);
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
    else if (c.why?.startsWith('Brak miejsca')) {
      const hab = GENERA.get(id)!.habitat;
      if (st.habitats.length >= st.plots && st.coins > plotCost(st) * 2) buyPlot(st);
      if (canBuildHabitat(st, hab).ok) buildHabitat(st, hab);
      else {
        const h = st.habitats.filter((x) => x.type === hab).sort((a, b) => a.level - b.level)[0];
        if (h && st.coins > 400 * Math.pow(1.8, h.level - 1) * 2) { st.coins -= Math.round(400 * Math.pow(1.8, h.level - 1)); h.level++; }
      }
    }
  }
  // feed & evolve
  for (const a of [...st.animals].sort((x, y) => x.level - y.level)) {
    feed(st, a.uid, 5, m);
    if (canEvolve(st, a, m).ok) evolve(st, a.uid, m);
  }
  // tech
  for (const t of [...TECH].sort((a, b) => a.cost - b.cost)) buyTech(st, t.id);
  // sites
  for (const id of Object.keys(SITE_UNLOCK)) if (canUnlockSite(st, id).ok) unlockSite(st, id);
  let best = st.activeSite, bestN = -1;
  for (const id of Object.keys(st.unlockedSites)) { const site = SITES.find((x) => x.id === id)!; const n = site.fauna.filter((f) => !st.hatched[f.genusId]).length; if (n > bestN) { bestN = n; best = id; } }
  st.activeSite = best;
  // buildings: cheapest affordable with reserve
  for (let k = 0; k < 5; k++) {
    const opts = BUILDINGS.map((b) => ({ b, c: canUpgradeBuilding(st, b.id) })).filter((x) => x.c.ok && st.coins > x.c.cost * 1.6).sort((a, b) => a.c.cost - b.c.cost);
    if (!opts.length) break;
    upgradeBuilding(st, opts[0].b.id);
  }
  // milestones
  if (st.stats.fossils > 0) mark('pierwsza skamieniałość');
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
    if (target > s.now) catchUp(s, target);
    for (let sec = 0; sec < sessionMin * 60; sec++) {
      for (let c = 0; c < cps; c++) click(s);
      tick(s, 1);
      activeSec++;
      if (sec % 10 === 0) policy(s);
    }
  }
  const hatchedSlice = [...sliceGenera].filter((id) => s.hatched[id]).length;
  console.log(`dzień ${String(d + 1).padStart(2)}: poziom ${parkLevel(s)}, kolekcja ${uniqueHatched(s)} (wycinek ${hatchedSlice}/${sliceGenera.size}), odkryte ${Object.keys(s.discovered).length}, skam. ${s.stats.fossils}, zwierząt ${s.animals.length}, monety ${fmt(s.coins)}, dochód ${fmt(incomePerSec(s))}/s, PB ${fmt(s.pb)}, mutagen ${s.mutagen}, stanowiska ${Object.keys(s.unlockedSites).length}, max stadium ${Math.max(0, ...s.animals.map((a) => a.stage))}`);
}
console.log('\nKAMIENIE MILOWE (czas rzeczywisty / czas aktywnej gry):');
for (const [l, t, a] of milestones) console.log(`  ${l.padEnd(28)} ${fmtT(t).padStart(9)}   aktywnie ${fmtT(a)}`);
console.log('\nbudynki:', JSON.stringify(s.buildings));
console.log('statystyki:', JSON.stringify(s.stats));

if (process.env.SAVE_OUT) {
  const { serialize } = await import('../src/game/engine');
  (await import('node:fs')).writeFileSync(process.env.SAVE_OUT, serialize(s));
  console.log('zapis ->', process.env.SAVE_OUT);
}

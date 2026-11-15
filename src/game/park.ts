// Park: habitats & plots, income & bank, feeding & evolution, buildings, research tech, food market, museum.

import { GENERA } from '../data/db';
import type { Food, Habitat } from '../data/types';
import { B, animalIncome, evolveCost, foodCost } from './balance';
import { BUILDING_BY_ID, HABITAT_UNLOCK, TECH_BY_ID, buildingCost, type BuildingId } from './content';
import { type Mods, mods } from './mods';
import { type Animal, type GameState, log } from './state';
import { addFame, collectionBonus, parkLevel } from './meta';
import { habitatCapacity, habitatUsed } from './lab';

// ---------------------------------------------------------------- habitats / plots

export function habitatBuildCost(s: GameState, type: Habitat): number {
  const n = s.habitats.filter((h) => h.type === type).length;
  return Math.round(B.habitatCost[type] * Math.pow(B.habitatCostGrowth, n));
}

export function canBuildHabitat(s: GameState, type: Habitat): { ok: boolean; why?: string; cost: number } {
  const cost = habitatBuildCost(s, type);
  if (parkLevel(s) < HABITAT_UNLOCK[type]) return { ok: false, why: `Wymaga poziomu parku ${HABITAT_UNLOCK[type]}`, cost };
  if (s.habitats.length >= s.plots) return { ok: false, why: 'Brak wolnej działki', cost };
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', cost };
  return { ok: true, cost };
}

export function buildHabitat(s: GameState, type: Habitat): boolean {
  const c = canBuildHabitat(s, type);
  if (!c.ok) return false;
  s.coins -= c.cost;
  s.habitats.push({ id: s.nextHabitatId++, type, level: 1 });
  return true;
}

export function habitatUpgradeCost(level: number): number {
  return Math.round(B.habitatUpgradeCost * Math.pow(B.habitatUpgradeGrowth, level - 1));
}

export function upgradeHabitat(s: GameState, id: number): boolean {
  const h = s.habitats.find((x) => x.id === id);
  if (!h) return false;
  const cost = habitatUpgradeCost(h.level);
  if (s.coins < cost) return false;
  s.coins -= cost;
  h.level++;
  return true;
}

export function plotCost(s: GameState): number {
  return Math.round(B.plotCost * Math.pow(B.plotCostGrowth, s.plots - B.startPlots));
}

export function buyPlot(s: GameState): boolean {
  const c = plotCost(s);
  if (s.coins < c) return false;
  s.coins -= c;
  s.plots++;
  return true;
}

export function moveAnimal(s: GameState, uid: number, habitatId: number): boolean {
  const a = s.animals.find((x) => x.uid === uid);
  const h = s.habitats.find((x) => x.id === habitatId);
  if (!a || !h || a.habitatId === habitatId) return false;
  const g = GENERA.get(a.genusId)!;
  if (h.type !== g.habitat) return false;
  const need = { XS: 1, S: 1, M: 2, L: 3, XL: 4 }[g.size];
  if (habitatCapacity(h.level) - habitatUsed(s, h.id) < need) return false;
  a.habitatId = habitatId;
  return true;
}

// ---------------------------------------------------------------- income

export function animalIncomeOf(s: GameState, a: Animal, m: Mods, bonus = collectionBonus(s)): number {
  const g = GENERA.get(a.genusId)!;
  return animalIncome(g.rarity, a.level, a.stage) * (1 + bonus) * m.incomeMult;
}

export function incomePerSec(s: GameState, m: Mods = mods(s)): number {
  const bonus = collectionBonus(s);
  let sum = 0;
  for (const a of s.animals) sum += animalIncomeOf(s, a, m, bonus);
  return sum;
}

export function bankCap(s: GameState, m: Mods = mods(s), inc = incomePerSec(s, m)): number {
  return Math.max(200, inc * 3600 * m.bankHours);
}

export function collectBank(s: GameState): number {
  const n = s.bank;
  s.coins += n;
  s.bank = 0;
  return n;
}

export function discoveredCount(s: GameState): number {
  return Object.keys(s.discovered).length;
}

export function parkTick(s: GameState, dt: number, m: Mods): void {
  const inc = incomePerSec(s, m);
  if (m.autoCollect) s.coins += inc * dt;
  else s.bank = Math.min(bankCap(s, m, inc), s.bank + inc * dt);
  s.coins += m.museumRate * discoveredCount(s) * dt;
  s.food.meat += m.meatRate * dt;
  s.food.plants += m.plantRate * dt;
  s.food.fish += m.fishRate * dt;
  s.food.plankton += m.planktonRate * dt;
  s.pb += m.pbRate * dt;
  s.mutagenAcc += (m.mutagenPerHour / 3600) * dt;
  if (s.mutagenAcc >= 1) {
    const n = Math.floor(s.mutagenAcc);
    s.mutagen += n;
    s.mutagenAcc -= n;
  }
}

// ---------------------------------------------------------------- feeding & evolution

export function feedCost(s: GameState, a: Animal, m: Mods = mods(s)): { food: Food; amount: number } {
  const g = GENERA.get(a.genusId)!;
  return { food: g.food, amount: foodCost(g.rarity, a.level, m.foodDiscount) };
}

export function canFeed(s: GameState, a: Animal, m: Mods = mods(s)): { ok: boolean; why?: string } {
  if (a.level >= B.stageCap[a.stage]) return { ok: false, why: a.stage >= 4 ? 'Maksymalny poziom' : 'Wymaga ewolucji' };
  const c = feedCost(s, a, m);
  if (s.food[c.food] < c.amount) return { ok: false, why: 'Za mało pokarmu' };
  return { ok: true };
}

export function feed(s: GameState, uid: number, times = 1, m: Mods = mods(s)): number {
  const a = s.animals.find((x) => x.uid === uid);
  if (!a) return 0;
  let n = 0;
  while (n < times && canFeed(s, a, m).ok) {
    const c = feedCost(s, a, m);
    s.food[c.food] -= c.amount;
    a.level++;
    n++;
  }
  return n;
}

export function evolveCostFor(s: GameState, a: Animal, m: Mods = mods(s)) {
  const g = GENERA.get(a.genusId)!;
  const c = evolveCost(g.rarity, a.stage);
  return { ...c, mutagen: Math.ceil(c.mutagen * (1 - m.mutagenDiscount)) };
}

export function canEvolve(s: GameState, a: Animal, m: Mods = mods(s)): { ok: boolean; why?: string } {
  if (a.stage >= 4) return { ok: false, why: 'Forma ostateczna' };
  if (a.level < B.stageCap[a.stage]) return { ok: false, why: `Wymaga poziomu ${B.stageCap[a.stage]}` };
  if (a.stage + 1 > m.maxStage) return { ok: false, why: `Wymaga Laboratorium Mutacji poz. ${a.stage}` };
  const c = evolveCostFor(s, a, m);
  if (s.mutagen < c.mutagen) return { ok: false, why: 'Za mało mutagenu' };
  if (s.pb < c.pb) return { ok: false, why: 'Za mało Punktów Badań' };
  if (s.coins < c.coins) return { ok: false, why: 'Za mało monet' };
  return { ok: true };
}

export function evolve(s: GameState, uid: number, m: Mods = mods(s)): boolean {
  const a = s.animals.find((x) => x.uid === uid);
  if (!a || !canEvolve(s, a, m).ok) return false;
  const c = evolveCostFor(s, a, m);
  s.mutagen -= c.mutagen;
  s.pb -= c.pb;
  s.coins -= c.coins;
  a.stage++;
  s.stats.evolutions++;
  const g = GENERA.get(a.genusId)!;
  s.bestStage[a.genusId] = Math.max(s.bestStage[a.genusId] ?? 0, a.stage);
  addFame(s, B.fameEvolve[a.stage - 1] * (1 + g.rarity));
  log(s, `${g.name} ewoluuje!`, 'good');
  return true;
}

export function releaseAnimal(s: GameState, uid: number): boolean {
  const i = s.animals.findIndex((x) => x.uid === uid);
  if (i < 0) return false;
  s.animals.splice(i, 1);
  return true;
}

export function buyFood(s: GameState, food: Food, amount: number): boolean {
  const cost = Math.ceil(amount * B.foodBuyPrice);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.food[food] += amount;
  return true;
}

// ---------------------------------------------------------------- buildings & tech

export function canUpgradeBuilding(s: GameState, id: BuildingId): { ok: boolean; why?: string; cost: number } {
  const def = BUILDING_BY_ID[id];
  const lvl = s.buildings[id];
  const cost = buildingCost(def, lvl + 1);
  if (lvl >= def.maxLevel) return { ok: false, why: 'Maksymalny poziom', cost };
  if (parkLevel(s) < def.unlockLevel) return { ok: false, why: `Wymaga poziomu parku ${def.unlockLevel}`, cost };
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', cost };
  return { ok: true, cost };
}

export function upgradeBuilding(s: GameState, id: BuildingId): boolean {
  const c = canUpgradeBuilding(s, id);
  if (!c.ok) return false;
  s.coins -= c.cost;
  s.buildings[id]++;
  if (s.buildings[id] === 1) log(s, `Zbudowano: ${BUILDING_BY_ID[id].name}`, 'good');
  return true;
}

export function canBuyTech(s: GameState, id: string): { ok: boolean; why?: string } {
  const t = TECH_BY_ID[id];
  if (!t) return { ok: false };
  if (s.tech[id]) return { ok: false, why: 'Zbadane' };
  if (!t.req.every((r) => s.tech[r])) return { ok: false, why: 'Wymaga wcześniejszych badań' };
  if (s.pb < t.cost) return { ok: false, why: 'Za mało Punktów Badań' };
  return { ok: true };
}

export function buyTech(s: GameState, id: string): boolean {
  if (!canBuyTech(s, id).ok) return false;
  s.pb -= TECH_BY_ID[id].cost;
  s.tech[id] = s.now;
  log(s, `Nowe badanie: ${TECH_BY_ID[id].name}`, 'good');
  return true;
}

// ---------------------------------------------------------------- museum donations

export function donateValue(genusId: number, q: number): { coins: number; fame: number } {
  const g = GENERA.get(genusId)!;
  return { coins: Math.round(40 * (q + 1) * (1 + g.rarity * 1.5)), fame: 1 + q };
}

export function donateFossil(s: GameState, genusId: number, q: number): boolean {
  if (s.buildings.museum < 1) return false;
  const f = s.fossils[genusId];
  if (!f || f[q] <= 0) return false;
  f[q]--;
  const v = donateValue(genusId, q);
  s.coins += v.coins;
  addFame(s, v.fame);
  return true;
}

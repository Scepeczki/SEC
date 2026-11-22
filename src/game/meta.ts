// Fame & park level, discovery, clade research, collection milestones, contracts.

import { ancestorIds, CLADES, GATE, GENERA, NAMED_CLADES, SUBTREE_GENERA, SITE_BY_ID } from '../data/db';
import { B, cladeResearchCost, parkLevelFromFame, HABITAT_NAMES } from './balance';
import { INSTITUTIONS, SITE_UNLOCK } from './content';
import type { Mods } from './mods';
import { type Contract, type GameState, type Quality, log, rand } from './state';
import { STAGE_NAMES } from '../sprites/generator';
import type { Habitat } from '../data/types';

export function parkLevel(s: GameState): number {
  return parkLevelFromFame(s.fame).level;
}

export function addFame(s: GameState, n: number): void {
  const before = parkLevel(s);
  s.fame += n;
  const after = parkLevel(s);
  if (after > before) log(s, `Park awansował na poziom ${after}!`, 'good');
}

export function onFossilFound(s: GameState, genusId: number, quality: Quality, siteId: string, m: Mods, byCrew = false): void {
  const g = GENERA.get(genusId)!;
  if (m.geneBank && (s.genome[genusId] ?? 0) >= 100) {
    s.pb += [2, 4, 8][quality];
    return;
  }
  const f = (s.fossils[genusId] ??= [0, 0, 0]);
  f[quality]++;
  if (!s.discovered[genusId]) {
    s.discovered[genusId] = s.now;
    (s.discoveries ??= []).unshift({ genusId, t: s.now, siteId, byCrew, seen: false });
    if (s.discoveries.length > 200) s.discoveries.length = 200;
    addFame(s, B.fameDiscover);
    log(s, `Nowe odkrycie: ${g.name}!`, 'good');
  }
}

// ---------------------------------------------------------------- clade research (tree as tech tree)

export function gateOf(genusId: number): number {
  return GATE.get(genusId)!;
}

export function isGateOpen(s: GameState, genusId: number): boolean {
  return !!s.researchedClades[gateOf(genusId)];
}

export function cladeCost(cladeId: number): number {
  return cladeResearchCost(CLADES.get(cladeId)?.leafCount ?? 1);
}

/** clade can be researched once any genus in its subtree has been discovered */
export function canResearchClade(s: GameState, cladeId: number): { ok: boolean; why?: string } {
  if (s.researchedClades[cladeId]) return { ok: false, why: 'Zbadane' };
  const gs = SUBTREE_GENERA.get(cladeId) ?? [];
  if (!s.settings.revealAll && !gs.some((id) => s.discovered[id])) return { ok: false, why: 'Najpierw znajdź skamieniałość z tej gałęzi' };
  if (s.pb < cladeCost(cladeId)) return { ok: false, why: 'Za mało Punktów Badań' };
  return { ok: true };
}

export function researchClade(s: GameState, cladeId: number): boolean {
  if (!canResearchClade(s, cladeId).ok) return false;
  s.pb -= cladeCost(cladeId);
  s.researchedClades[cladeId] = s.now;
  addFame(s, B.fameClade);
  const c = CLADES.get(cladeId)!;
  log(s, `Zbadano gałąź: ${c.namePl ?? c.name}`, 'good');
  return true;
}

// ---------------------------------------------------------------- collections

export function uniqueHatched(s: GameState): number {
  return Object.keys(s.hatched).length;
}

export function onNewGenusHatched(s: GameState, genusId: number): void {
  const g = GENERA.get(genusId)!;
  addFame(s, B.fameNewGenus[g.rarity]);
  log(s, `${g.name} dołącza do kolekcji!`, 'good');
  for (const cid of ancestorIds(g.parent)) {
    const c = CLADES.get(cid)!;
    if (!c.namePl || c.leafCount < 2 || s.completedClades[cid]) continue;
    const all = SUBTREE_GENERA.get(cid) ?? [];
    if (all.every((id) => s.hatched[id])) {
      s.completedClades[cid] = s.now;
      addFame(s, 50 + c.leafCount * 10);
      log(s, `Ukończono gałąź „${c.namePl}” (${c.leafCount} rodzajów)! Trwały bonus do dochodu.`, 'good');
    }
  }
}

export function collectionBonus(s: GameState): number {
  return uniqueHatched(s) * B.collectionBonusPerGenus + Object.keys(s.completedClades).length * B.cladeCompleteBonus;
}

export function namedCladeProgress(s: GameState) {
  return NAMED_CLADES.map((c) => {
    const all = SUBTREE_GENERA.get(c.id) ?? [];
    return { clade: c, total: all.length, hatched: all.filter((id) => s.hatched[id]).length };
  });
}

// ---------------------------------------------------------------- sites

export function canUnlockSite(s: GameState, siteId: string): { ok: boolean; why?: string; cost: number; level: number } {
  const req = SITE_UNLOCK[siteId] ?? { level: 99, cost: Infinity };
  if (s.unlockedSites[siteId]) return { ok: false, why: 'Odblokowane', ...req };
  if (parkLevel(s) < req.level) return { ok: false, why: `Wymaga poziomu parku ${req.level}`, ...req };
  if (s.coins < req.cost) return { ok: false, why: 'Za mało monet', ...req };
  return { ok: true, ...req };
}

/** shards granted with a newly opened site */
export const siteGrant = (siteId: string) => Math.round(400 * Math.pow(SITE_UNLOCK[siteId]?.level ?? 1, 1.35) / 10) * 10;

export function unlockSite(s: GameState, siteId: string): boolean {
  const c = canUnlockSite(s, siteId);
  if (!c.ok) return false;
  s.coins -= c.cost;
  s.unlockedSites[siteId] = s.now;
  // a new site comes with an expedition grant: a burst of workshop upgrades every few park levels
  const grant = siteGrant(siteId);
  s.shards = (s.shards ?? 0) + grant;
  log(s, `Nowe stanowisko: ${SITE_BY_ID.get(siteId)?.name} · dotacja na wyprawę: ${grant} odłamków`, 'good');
  return true;
}

// ---------------------------------------------------------------- contracts

function contractProgress(s: GameState, c: Contract): number {
  switch (c.kind) {
    case 'fossils': return (s.sites[c.siteId!]?.fossilsFound ?? 0) - c.base;
    case 'genome': return Math.floor(s.genome[c.genusId!] ?? 0);
    case 'animal': return Math.max(0, ...s.animals.filter((a) => GENERA.get(a.genusId)?.habitat === c.habitat).map((a) => a.level));
    case 'hatch': return Object.keys(s.hatched).length - c.base;
    case 'evolve': return s.animals.some((a) => a.stage >= c.stage!) ? 1 : 0;
  }
}

function makeContract(s: GameState, m: Mods): Contract | null {
  const lvl = parkLevel(s);
  const scale = Math.pow(1.35, lvl - 1) * m.contractRewardMult;
  const inst = INSTITUTIONS[Math.floor(rand(s) * INSTITUTIONS.length)];
  const kinds: Contract['kind'][] = ['fossils', 'fossils', 'hatch'];
  const genomeCands = Object.keys(s.discovered).map(Number).filter((id) => (s.genome[id] ?? 0) < 100 && s.researchedClades[gateOf(id)]);
  if (genomeCands.length) kinds.push('genome', 'genome');
  if (s.animals.length) kinds.push('animal', 'evolve');
  const kind = kinds[Math.floor(rand(s) * kinds.length)];
  const id = s.nextContractId++;
  const base = { id, institution: inst, progress: 0, base: 0 };
  switch (kind) {
    case 'fossils': {
      const sites = Object.keys(s.unlockedSites);
      const siteId = sites[Math.floor(rand(s) * sites.length)];
      const need = 3 + Math.floor(rand(s) * 4) + Math.floor(lvl / 3);
      return { ...base, kind, siteId, need, base: s.sites[siteId]?.fossilsFound ?? 0, text: `Dostarcz ${need} skamieniałości ze stanowiska ${SITE_BY_ID.get(siteId)?.name}.`,
        reward: { coins: Math.round(120 * need * scale), pb: Math.round(3 * need * Math.sqrt(scale)), mutagen: 0, fame: 10 } };
    }
    case 'genome': {
      const genusId = genomeCands[Math.floor(rand(s) * genomeCands.length)];
      return { ...base, kind, genusId, need: 100, text: `Zsekwencjonuj pełny genom (100%) rodzaju ${GENERA.get(genusId)?.name}.`,
        reward: { coins: Math.round(300 * scale), pb: Math.round(25 * Math.sqrt(scale)), mutagen: 1, fame: 25 } };
    }
    case 'animal': {
      const habs = [...new Set(s.animals.map((a) => GENERA.get(a.genusId)!.habitat))] as Habitat[];
      const habitat = habs[Math.floor(rand(s) * habs.length)];
      const best = Math.max(...s.animals.filter((a) => GENERA.get(a.genusId)?.habitat === habitat).map((a) => a.level));
      const minLevel = Math.min(40, best + 3 + Math.floor(rand(s) * 4));
      return { ...base, kind, habitat, minLevel, need: minLevel, text: `Pokaż zwierzę z habitatu „${HABITAT_NAMES[habitat]}” na poziomie ${minLevel}.`,
        reward: { coins: Math.round(250 * minLevel * scale / 3), pb: Math.round(10 * Math.sqrt(scale)), mutagen: minLevel >= 15 ? 2 : 1, fame: 20 } };
    }
    case 'hatch': {
      const need = 1 + Math.floor(rand(s) * 2) + Math.floor(lvl / 5);
      return { ...base, kind, need, base: Object.keys(s.hatched).length, text: `Wyhoduj ${need} ${need === 1 ? 'nowy rodzaj' : 'nowe rodzaje'} do kolekcji.`,
        reward: { coins: Math.round(400 * need * scale), pb: Math.round(8 * need * Math.sqrt(scale)), mutagen: 0, fame: 30 * need } };
    }
    case 'evolve': {
      const best = Math.max(...s.animals.map((a) => a.stage));
      const stage = Math.min(4, best + 1);
      return { ...base, kind, stage, need: 1, text: `Doprowadź dowolne zwierzę do stadium „${STAGE_NAMES[stage]}”.`,
        reward: { coins: Math.round(500 * (stage + 1) * scale), pb: Math.round(15 * (stage + 1)), mutagen: stage, fame: 40 } };
    }
  }
  return null;
}

export function updateContracts(s: GameState, m: Mods): void {
  while (s.contracts.length < m.contractSlots) {
    const c = makeContract(s, m);
    if (!c) break;
    s.contracts.push(c);
  }
  for (const c of s.contracts) c.progress = contractProgress(s, c);
}

export function claimContract(s: GameState, id: number): boolean {
  const c = s.contracts.find((x) => x.id === id);
  if (!c || c.progress < c.need) return false;
  s.coins += c.reward.coins;
  s.pb += c.reward.pb;
  s.mutagen += c.reward.mutagen;
  addFame(s, c.reward.fame);
  s.contracts = s.contracts.filter((x) => x.id !== id);
  log(s, `Kontrakt wykonany: ${c.institution}`, 'good');
  return true;
}

export function rerollCost(s: GameState): number {
  return 50 * parkLevel(s);
}

export function rerollContract(s: GameState, id: number): boolean {
  const cost = rerollCost(s);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.contracts = s.contracts.filter((x) => x.id !== id);
  return true;
}

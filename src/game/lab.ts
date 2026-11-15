// Laboratory: fossil -> DNA extraction queue; hatchery: genome -> animal synthesis.

import { GENERA } from '../data/db';
import { SIZE_SLOTS } from '../data/archetypes';
import { B, synthCost, synthTime } from './balance';
import { type Mods, mods } from './mods';
import { type GameState, type Quality, log, rand } from './state';
import { isGateOpen, onNewGenusHatched } from './meta';
import { animalsIn, autoPlace, defOf, enclosures, penSlots, penUsed } from './parkmap';

// ---------------------------------------------------------------- extraction

export function extractDuration(genusId: number, q: Quality, m: Mods): number {
  const g = GENERA.get(genusId)!;
  return (B.extractTime[q] * B.extractRarityMult[g.rarity]) / m.labSpeed;
}

export function canExtract(s: GameState, genusId: number, q: Quality): { ok: boolean; why?: string } {
  if (!(s.fossils[genusId]?.[q] > 0)) return { ok: false, why: 'Brak skamieniałości' };
  if (!isGateOpen(s, genusId)) return { ok: false, why: 'Zbadaj najpierw gałąź w Drzewie życia' };
  if ((s.genome[genusId] ?? 0) >= 100) return { ok: false, why: 'Genom kompletny' };
  return { ok: true };
}

export function queueExtraction(s: GameState, genusId: number, q: Quality, m: Mods = mods(s)): boolean {
  if (!canExtract(s, genusId, q).ok) return false;
  s.fossils[genusId][q]--;
  s.labQueue.push({ genusId, quality: q, t: 0, dur: extractDuration(genusId, q, m) });
  fillLab(s, m);
  return true;
}

/** queue every fossil of a genus (best quality first) */
export function queueAll(s: GameState, genusId: number, m: Mods = mods(s)): number {
  let n = 0;
  for (const q of [2, 1, 0] as Quality[]) while (canExtract(s, genusId, q).ok && n < 50) { queueExtraction(s, genusId, q, m); n++; }
  return n;
}

function fillLab(s: GameState, m: Mods) {
  while (s.labActive.length < m.labSlots && s.labQueue.length) s.labActive.push(s.labQueue.shift()!);
}

function finishExtraction(s: GameState, genusId: number, q: Quality, m: Mods) {
  const g = GENERA.get(genusId)!;
  const [a, b] = B.genomeYield[q];
  const y = ((a + rand(s) * (b - a)) * m.genomeMult) / B.genomeRarityDiv[g.rarity];
  const before = s.genome[genusId] ?? 0;
  const after = Math.min(100, before + y);
  s.genome[genusId] = after;
  s.pb += B.extractPB[q];
  s.stats.extractions++;
  if (before < 50 && after >= 50) log(s, `${g.name}: genom ${Math.floor(after)}% — można rozpocząć syntezę!`, 'good');
  if (before < 100 && after >= 100) {
    log(s, `${g.name}: pełny genom!`, 'good');
  }
}

export function labTick(s: GameState, dt: number, m: Mods): void {
  fillLab(s, m);
  let slot = 0;
  while (slot < s.labActive.length) {
    let rem = dt;
    let removed = false;
    while (rem > 0) {
      const job = s.labActive[slot];
      const need = job.dur - job.t;
      if (rem < need) { job.t += rem; break; }
      rem -= need;
      finishExtraction(s, job.genusId, job.quality, m);
      if (s.labQueue.length) s.labActive[slot] = s.labQueue.shift()!;
      else { s.labActive.splice(slot, 1); removed = true; break; }
    }
    if (!removed) slot++;
  }
}

// ---------------------------------------------------------------- room in the park (information only: synthesis is never blocked)

/** is there a pen ready for this genus right now? (otherwise the newborn waits in the Transporter) */
export function spaceFor(s: GameState, genusId: number): { need: number; ok: boolean; enclosures: number } {
  const g = GENERA.get(genusId)!;
  const need = SIZE_SLOTS[g.size];
  const encs = enclosures(s).filter((o) => defOf(o).habitat === g.habitat);
  const ok = encs.some((o) => Array.from({ length: o.pens ?? 0 }, (_, p) => p).some((p) => {
    const here = animalsIn(s, o.id, p);
    const others = here.filter((a) => a.genusId !== genusId);
    if (others.length && (g.food === 'meat' || others.some((a) => GENERA.get(a.genusId)!.food === 'meat'))) return false;
    return penSlots(s, o) - penUsed(s, o.id, p) >= need;
  }));
  return { need, ok, enclosures: encs.length };
}

// ---------------------------------------------------------------- synthesis

export function synthChance(s: GameState, genusId: number, m: Mods): number {
  if (Object.keys(s.hatched).length === 0) return 1; // first animal always succeeds
  return Math.min(1, (s.genome[genusId] ?? 0) / 100 + m.synthBonus);
}

export function canSynthesize(s: GameState, genusId: number, m: Mods = mods(s)): { ok: boolean; why?: string; cost: number; time: number; chance: number } {
  const g = GENERA.get(genusId)!;
  const cost = synthCost(g.rarity, g.size, m.synthDiscount);
  const time = synthTime(g.rarity, g.size, m.incubSpeed);
  const chance = synthChance(s, genusId, m);
  const r = { cost, time, chance };
  if ((s.genome[genusId] ?? 0) < 50) return { ok: false, why: 'Genom poniżej 50%', ...r };
  if (s.incubating.length >= m.incubSlots) return { ok: false, why: 'Wszystkie inkubatory zajęte', ...r };
  if (s.coins < cost) return { ok: false, why: 'Za mało monet', ...r };
  return { ok: true, ...r };
}

export function synthesize(s: GameState, genusId: number, m: Mods = mods(s)): boolean {
  const c = canSynthesize(s, genusId, m);
  if (!c.ok) return false;
  s.coins -= c.cost;
  s.incubating.push({ genusId, t: 0, dur: c.time, chance: c.chance, cost: c.cost });
  return true;
}

export function hatchTick(s: GameState, dt: number, _m: Mods): void {
  for (let i = 0; i < s.incubating.length; ) {
    const inc = s.incubating[i];
    inc.t += dt;
    if (inc.t >= inc.dur) {
      s.incubating.splice(i, 1);
      const g = GENERA.get(inc.genusId)!;
      if (rand(s) < inc.chance) {
        const uid = s.nextUid++;
        s.animals.push({ uid, genusId: inc.genusId, level: 1, stage: 0, enc: 0, pen: 0, born: s.now });
        const placed = autoPlace(s, uid);
        const first = !s.hatched[inc.genusId];
        s.hatched[inc.genusId] = (s.hatched[inc.genusId] ?? 0) + 1;
        s.bestStage[inc.genusId] = Math.max(s.bestStage[inc.genusId] ?? 0, 0);
        if (first) onNewGenusHatched(s, inc.genusId);
        else log(s, `Wykluł się kolejny ${g.name}.`, 'info');
        if (!placed) log(s, `${g.name} czeka w Transporterze — nie ma dla niego wolnej zagrody.`, 'bad');
      } else {
        s.coins += inc.cost * B.synthFailRefund;
        s.stats.hatchFails++;
        log(s, `Synteza ${g.name} nieudana — odzyskano ${Math.round(B.synthFailRefund * 100)}% kosztów.`, 'bad');
      }
    } else i++;
  }
}

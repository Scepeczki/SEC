// Buildings, research tree and contract institutions.

export type BuildingId =
  | 'expedition' | 'prep' | 'sequencer' | 'hatchery' | 'ranch' | 'greenhouse' | 'aquaculture'
  | 'mutation' | 'museum' | 'visitor' | 'research';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  desc: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
  unlockLevel: number;
  startLevel: number;
  effect: (lvl: number) => string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'expedition', name: 'Centrum Ekspedycji', icon: '⛺', desc: 'Ekipy wykopaliskowe kopią same, także gdy Cię nie ma.', baseCost: 250, growth: 2.15, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `${crewsAt(l)} ${crewsAt(l) === 1 ? 'ekipa' : 'ekipy'}, tempo ×${(1 + 0.04 * (l - 1)).toFixed(2)}` },
  { id: 'prep', name: 'Pracownia Preparacji', icon: '🖌️', desc: 'Lepsze narzędzia: mocniejsze uderzenia i lepiej zachowane skamieniałości.', baseCost: 300, growth: 2.1, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `siła narzędzi ${(1 + 0.25 * (l - 1)).toFixed(2)}, jakość +${l - 1}%` },
  { id: 'sequencer', name: 'Sekwenator DNA', icon: '🧬', desc: 'Ekstrakcja DNA ze skamieniałości: więcej stanowisk, szybciej, wydajniej.', baseCost: 350, growth: 2.15, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `${1 + Math.floor(l / 4)} stanowisk, tempo ×${(1 + 0.1 * (l - 1)).toFixed(2)}, genom +${3 * (l - 1)}%` },
  { id: 'hatchery', name: 'Wylęgarnia', icon: '🥚', desc: 'Synteza zwierząt z genomu: więcej inkubatorów, szybciej, pewniej.', baseCost: 400, growth: 2.15, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `${1 + Math.floor(l / 5)} inkubatorów, tempo ×${(1 + 0.1 * (l - 1)).toFixed(2)}, szansa +${2 * (l - 1)}%` },
  { id: 'ranch', name: 'Hodowla', icon: '🥩', desc: 'Produkuje mięso dla drapieżników.', baseCost: 200, growth: 2.0, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `${(foodRate(l) * 60).toFixed(1)} mięsa / min` },
  { id: 'greenhouse', name: 'Szklarnia paleobotaniczna', icon: '🌿', desc: 'Paprocie, sagowce i skrzypy dla roślinożerców.', baseCost: 200, growth: 2.0, maxLevel: 40, unlockLevel: 1, startLevel: 1,
    effect: (l) => `${(foodRate(l) * 60).toFixed(1)} roślin / min` },
  { id: 'aquaculture', name: 'Akwakultura', icon: '🐟', desc: 'Ryby i plankton dla zwierząt wodnych.', baseCost: 600, growth: 2.05, maxLevel: 40, unlockLevel: 3, startLevel: 0,
    effect: (l) => `${(foodRate(l) * 60).toFixed(1)} ryb i planktonu / min` },
  { id: 'museum', name: 'Muzeum', icon: '🏛️', desc: 'Wystawa skamieniałości: pasywny dochód za każdy odkryty rodzaj. Możesz przekazywać zbędne skamieniałości.', baseCost: 800, growth: 2.1, maxLevel: 40, unlockLevel: 2, startLevel: 0,
    effect: (l) => `${(0.02 * l).toFixed(2)} monet/s za każdy odkryty rodzaj` },
  { id: 'visitor', name: 'Centrum dla Zwiedzających', icon: '🎟️', desc: 'Więcej zwiedzających: wyższy dochód i większa kasa.', baseCost: 1000, growth: 2.2, maxLevel: 40, unlockLevel: 2, startLevel: 0,
    effect: (l) => `dochód +${5 * l}%, kasa +${(0.25 * l).toFixed(2)} h` },
  { id: 'research', name: 'Centrum Badawcze', icon: '🔬', desc: 'Naukowcy generują Punkty Badań.', baseCost: 900, growth: 2.15, maxLevel: 40, unlockLevel: 3, startLevel: 0,
    effect: (l) => `${(pbRate(l) * 60).toFixed(1)} PB / min` },
  { id: 'mutation', name: 'Laboratorium Mutacji', icon: '☣️', desc: 'Potrzebne do wyższych stadiów ewolucji. Powoli wytwarza mutagen.', baseCost: 1500, growth: 2.25, maxLevel: 40, unlockLevel: 4, startLevel: 0,
    effect: (l) => `pozwala na stadium ${Math.min(4, l + 1)}, ${(0.25 * l).toFixed(2)} mutagenu / h` },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;

export function foodRate(l: number): number {
  return l <= 0 ? 0 : 0.15 * l * Math.pow(1.08, l - 1);
}
export function crewsAt(l: number): number {
  return 1 + Math.floor(Math.max(0, l - 1) / 3);
}
export function pbRate(l: number): number {
  return l <= 0 ? 0 : 0.015 * l * Math.pow(1.07, l - 1);
}
export function buildingCost(def: BuildingDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.growth, Math.max(0, level - def.startLevel)));
}

export type TechCat = 'dig' | 'gen' | 'park' | 'log';
export interface TechDef {
  id: string;
  cat: TechCat;
  name: string;
  desc: string;
  cost: number;
  req: string[];
}

export const TECH_CATS: Record<TechCat, string> = { dig: 'Wykopaliska', gen: 'Genetyka', park: 'Park', log: 'Logistyka' };

export const TECH: TechDef[] = [
  { id: 'dig1', cat: 'dig', name: 'Szkoła terenowa', desc: 'Ekipy kopią o 15% szybciej.', cost: 15, req: [] },
  { id: 'dig4', cat: 'dig', name: 'Mapy geologiczne', desc: '+1 skamieniałość w każdej warstwie.', cost: 150, req: ['dig1'] },
  { id: 'dig5', cat: 'dig', name: 'Obozy całoroczne', desc: '+1 ekipa wykopaliskowa.', cost: 300, req: ['dig1'] },
  { id: 'dig6', cat: 'dig', name: 'Stratygrafia', desc: 'Głębokość mocniej zwiększa szansę na rzadkie zwierzęta (×1,5).', cost: 600, req: ['dig4'] },
  { id: 'dig7', cat: 'dig', name: 'Drony zwiadowcze', desc: '+1 skamieniałość w warstwie, więcej bursztynu.', cost: 1500, req: ['dig6', 'dig5'] },
  { id: 'dig8', cat: 'dig', name: 'Dokumentacja 3D', desc: 'Skamieniałości są lepiej zachowane (+5% jakości).', cost: 3000, req: ['dig7'] },
  { id: 'gen1', cat: 'gen', name: 'Czyste laboratorium', desc: '+10% genomu z każdej ekstrakcji.', cost: 20, req: [] },
  { id: 'gen2', cat: 'gen', name: 'Sekwencjonowanie równoległe', desc: '+1 stanowisko ekstrakcji.', cost: 60, req: ['gen1'] },
  { id: 'gen4', cat: 'gen', name: 'Inkubatory termiczne', desc: '+10% szansy udanej syntezy.', cost: 100, req: ['gen1'] },
  { id: 'gen5', cat: 'gen', name: 'Stabilizacja genomu', desc: '+20% genomu z każdej ekstrakcji.', cost: 400, req: ['gen2'] },
  { id: 'gen6', cat: 'gen', name: 'Bank genów', desc: 'Skamieniałości rodzajów z pełnym genomem zamieniają się w Punkty Badań.', cost: 800, req: ['gen2'] },
  { id: 'gen7', cat: 'gen', name: 'Mutageneza kierowana', desc: 'Ewolucja zużywa 25% mniej mutagenu.', cost: 1200, req: ['gen4'] },
  { id: 'gen8', cat: 'gen', name: 'Klonowanie', desc: 'Synteza tańsza o 30%.', cost: 3000, req: ['gen5', 'gen7'] },
  { id: 'park1', cat: 'park', name: 'Ścieżki dla zwiedzających', desc: 'Dochód parku +10%.', cost: 20, req: [] },
  { id: 'park2', cat: 'park', name: 'Automatyczne kasy', desc: 'Kasa parku opróżnia się sama.', cost: 80, req: ['park1'] },
  { id: 'park3', cat: 'park', name: 'Dieta zbilansowana', desc: 'Karmienie tańsze o 10%.', cost: 60, req: [] },
  { id: 'park4', cat: 'park', name: 'Marketing', desc: 'Dochód parku +20%.', cost: 250, req: ['park1'] },
  { id: 'park5', cat: 'park', name: 'Kolejka gondolowa', desc: 'Kasa mieści 2 h dochodu więcej.', cost: 800, req: ['park2'] },
  { id: 'park6', cat: 'park', name: 'Programy hodowlane', desc: 'Karmienie tańsze o kolejne 20%.', cost: 1500, req: ['park3'] },
  { id: 'park7', cat: 'park', name: 'Festiwal paleontologii', desc: 'Dochód parku +40%.', cost: 4000, req: ['park4', 'park5'] },
  { id: 'log1', cat: 'log', name: 'Magazyn chłodniczy', desc: 'Park pracuje offline o 4 h dłużej.', cost: 40, req: [] },
  { id: 'log2', cat: 'log', name: 'Logistyka paszy', desc: 'Farmy produkują o 25% więcej.', cost: 100, req: [] },
  { id: 'log3', cat: 'log', name: 'Kontrakty instytucjonalne', desc: '+1 kontrakt naraz, nagrody +20%.', cost: 150, req: ['log1'] },
  { id: 'log4', cat: 'log', name: 'Sieć muzeów', desc: 'Dochód muzeum ×2.', cost: 600, req: ['log3'] },
  { id: 'log5', cat: 'log', name: 'Kriogenika', desc: 'Park pracuje offline o kolejne 8 h dłużej.', cost: 2000, req: ['log1', 'log2'] },
];

export const TECH_BY_ID = Object.fromEntries(TECH.map((t) => [t.id, t])) as Record<string, TechDef>;

export const INSTITUTIONS = [
  'Muzeum Historii Naturalnej', 'Instytut Paleobiologii', 'Uniwersytet Nauk o Ziemi', 'Ogród Pradziejów',
  'Fundacja Bursztynowa', 'Towarzystwo Paleontologiczne', 'Akademia Ewolucji', 'Oceanarium Głębin',
];

/** Park-level requirements for sites (order = unlock order). */
export const SITE_UNLOCK: Record<string, { level: number; cost: number }> = {
  morrison: { level: 1, cost: 0 },
  hell_creek: { level: 4, cost: 3000 },
  krasiejow: { level: 7, cost: 15000 },
  solnhofen: { level: 10, cost: 60000 },
  burgess: { level: 13, cost: 200000 },
  niobrara: { level: 16, cost: 600000 },
  yixian: { level: 19, cost: 1.8e6 },
  karoo: { level: 22, cost: 5e6 },
  dinosaur_park: { level: 25, cost: 1.4e7 },
  ischigualasto: { level: 28, cost: 4e7 },
  holzmaden: { level: 31, cost: 1.1e8 },
  nemegt: { level: 34, cost: 3e8 },
  kem_kem: { level: 37, cost: 8e8 },
  cleveland: { level: 40, cost: 2e9 },
  santana: { level: 43, cost: 5e9 },
  mazon_creek: { level: 46, cost: 1.3e10 },
  messel: { level: 49, cost: 3.5e10 },
  pampas: { level: 52, cost: 9e10 },
};

/** Habitat type unlocks by park level. */
export const HABITAT_UNLOCK = { land: 1, freshwater: 3, marine: 6, air: 9 } as const;

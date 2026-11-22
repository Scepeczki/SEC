// Buildings, research tree and contract institutions.

export type BuildingId =
  | 'expedition' | 'prep' | 'sequencer' | 'hatchery'
  | 'mutation' | 'museum' | 'visitor' | 'research';
/** farms of version ≤ 0.2 (single global buildings; now farm objects on the map) */
export const OLD_FARM_IDS = ['ranch', 'greenhouse', 'aquaculture'] as const;

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
  { id: 'museum', name: 'Muzeum', icon: '🏛️', desc: 'Wystawa skamieniałości: zarabia za każdy odkryty rodzaj (zbierasz klikiem). Możesz przekazywać zbędne skamieniałości.', baseCost: 800, growth: 2.1, maxLevel: 40, unlockLevel: 2, startLevel: 0,
    effect: (l) => `${(0.02 * l).toFixed(2)} monet/s za każdy odkryty rodzaj` },
  { id: 'visitor', name: 'Centrum dla Zwiedzających', icon: '🎟️', desc: 'Więcej zwiedzających: wyższy dochód i większe kasy wybiegów.', baseCost: 1000, growth: 2.2, maxLevel: 40, unlockLevel: 2, startLevel: 0,
    effect: (l) => `dochód +${5 * l}%, kasy wybiegów +${(0.25 * l).toFixed(2)} h` },
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
  { id: 'park2', cat: 'park', name: 'Automatyczne kasy', desc: 'Wybiegi, sklepy, farmy i muzeum oddają zarobek same, bez klikania.', cost: 80, req: ['park1'] },
  { id: 'park3', cat: 'park', name: 'Dieta zbilansowana', desc: 'Karmienie tańsze o 10%.', cost: 60, req: [] },
  { id: 'park4', cat: 'park', name: 'Marketing', desc: 'Dochód parku +20%.', cost: 250, req: ['park1'] },
  { id: 'park5', cat: 'park', name: 'Pancerne sejfy', desc: 'Kasy wybiegów mieszczą 2 h dochodu więcej.', cost: 800, req: ['park2'] },
  { id: 'park6', cat: 'park', name: 'Programy hodowlane', desc: 'Karmienie tańsze o kolejne 20%.', cost: 1500, req: ['park3'] },
  { id: 'park7', cat: 'park', name: 'Festiwal paleontologii', desc: 'Dochód parku +40%.', cost: 4000, req: ['park4', 'park5'] },
  { id: 'park8', cat: 'park', name: 'Szersze zagrody', desc: '+2 miejsca w każdej zagrodzie każdego wybiegu.', cost: 400, req: ['park1'] },
  { id: 'park9', cat: 'park', name: 'Dodatkowe przegrody', desc: 'Każdy wybieg może mieć o 2 zagrody więcej.', cost: 1200, req: ['park8'] },
  { id: 'park10', cat: 'park', name: 'Rozległe wybiegi', desc: 'Wybiegi można ulepszyć do poziomu 6: 14×12 pól, do 10 zagród po 12 miejsc.', cost: 3500, req: ['park9'] },
  { id: 'park11', cat: 'park', name: 'Rezerwaty', desc: 'Wybiegi można ulepszyć do poziomu 7: 16×14 pól, do 12 zagród po 14 miejsc.', cost: 12000, req: ['park10'] },
  { id: 'park12', cat: 'park', name: 'Ciężki sprzęt', desc: 'Oczyszczanie dzikiego terenu o 40% tańsze.', cost: 300, req: [] },
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

/**
 * Park-level requirements for sites (order = unlock order). Sites open in geological order, oldest first,
 * so the collection grows the way life itself did: Cambrian seas → first fish → onto land → dinosaurs → mammals.
 */
export const SITE_UNLOCK: Record<string, { level: number; cost: number }> = {
  chengjiang: { level: 1, cost: 100 },
  burgess: { level: 3, cost: 3000 },
  fezouata: { level: 5, cost: 5900 },
  cincinnati: { level: 6, cost: 6900 },
  bertie: { level: 6, cost: 8100 },
  rhynie: { level: 6, cost: 9400 },
  gogo: { level: 7, cost: 11000 },
  cleveland: { level: 9, cost: 22000 },
  east_kirkton: { level: 10, cost: 28000 },
  joggins: { level: 10, cost: 34000 },
  mazon_creek: { level: 11, cost: 43000 },
  red_beds: { level: 12, cost: 60000 },
  karoo: { level: 13, cost: 85000 },
  ischigualasto: { level: 15, cost: 160000 },
  krasiejow: { level: 17, cost: 320000 },
  chinle: { level: 19, cost: 630000 },
  elliot: { level: 20, cost: 870000 },
  holzmaden: { level: 21, cost: 1200000 },
  oxford_clay: { level: 23, cost: 2400000 },
  morrison: { level: 25, cost: 4700000 },
  tendaguru: { level: 27, cost: 9100000 },
  solnhofen: { level: 29, cost: 18000000 },
  yixian: { level: 31, cost: 34000000 },
  santana: { level: 33, cost: 67000000 },
  cedar_mountain: { level: 34, cost: 93000000 },
  kem_kem: { level: 35, cost: 130000000 },
  niobrara: { level: 37, cost: 260000000 },
  dinosaur_park: { level: 39, cost: 500000000 },
  djadokhta: { level: 41, cost: 970000000 },
  hell_creek: { level: 43, cost: 1900000000 },
  nemegt: { level: 45, cost: 3700000000 },
  green_river: { level: 47, cost: 7200000000 },
  messel: { level: 49, cost: 14000000000 },
  white_river: { level: 51, cost: 27000000000 },
  santa_cruz: { level: 52, cost: 34000000000 },
  siwaliki: { level: 52, cost: 42000000000 },
  pampas: { level: 53, cost: 53000000000 },
};
/** where a new game starts digging: the oldest site */
export const START_SITE = 'chengjiang';

/** Habitat type unlocks by park level, in the order life conquered them: sea, fresh water, land, air. */
// Water and land open together at level 6, with the Rhynie chert: the first site with animals living on land.
export const HABITAT_UNLOCK = { marine: 1, freshwater: 6, land: 6, air: 12 } as const;

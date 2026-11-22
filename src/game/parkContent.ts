// Park 2.0: everything that can be placed on an island (enclosures, stations, farms, visitor buildings, decorations),
// the islands themselves and all park-map numbers. See docs/park-2.0-projekt.md.

import type { Food, Habitat } from '../data/types';
import { BUILDING_BY_ID, HABITAT_UNLOCK, buildingCost, type BuildingId } from './content';

// ---------------------------------------------------------------- islands

export type Biome = 'meadow' | 'marsh' | 'reef' | 'cliffs' | 'volcanic' | 'mainland';

export interface IslandDef {
  id: number;
  name: string;
  biome: Biome;
  /** size in tiles */
  w: number;
  h: number;
  /** top-left corner in world tiles */
  wx: number;
  wy: number;
  level: number;
  cost: number;
  /** habitat with an income bonus here */
  bonusHabitat?: Habitat;
  bonus: number;
  /** radius (0–1 of the island ellipse) that is clear when bought — the same land as on the smaller 0.2 islands */
  startClear: number;
  /** the radius 0.3.0 used (saves from that version keep it) */
  legacyClear: number;
}

export const ISLANDS: IslandDef[] = [
  { id: 1, name: 'Wyspa Startowa', biome: 'meadow', w: 56, h: 42, wx: 0, wy: 0, level: 1, cost: 0, bonusHabitat: 'land', bonus: 0.1, startClear: 0.44, legacyClear: 0.6 },
  { id: 2, name: 'Mokradła', biome: 'marsh', w: 64, h: 46, wx: 84, wy: -24, level: 5, cost: 8000, bonusHabitat: 'freshwater', bonus: 0.2, startClear: 0.36, legacyClear: 0.5 },
  { id: 3, name: 'Laguna Rafowa', biome: 'reef', w: 68, h: 50, wx: -100, wy: 10, level: 9, cost: 40000, bonusHabitat: 'marine', bonus: 0.2, startClear: 0.36, legacyClear: 0.5 },
  { id: 4, name: 'Klify', biome: 'cliffs', w: 72, h: 52, wx: -8, wy: 74, level: 14, cost: 250000, bonusHabitat: 'air', bonus: 0.2, startClear: 0.34, legacyClear: 0.48 },
  { id: 5, name: 'Wyspa Wulkaniczna', biome: 'volcanic', w: 84, h: 60, wx: 96, wy: 58, level: 20, cost: 2000000, bonus: 0.1, startClear: 0.32, legacyClear: 0.45 },
  { id: 6, name: 'Wielki Ląd', biome: 'mainland', w: 104, h: 72, wx: -150, wy: -110, level: 28, cost: 20000000, bonus: 0, startClear: 0.32, legacyClear: 0.45 },
];
export const ISLAND_BY_ID = new Map(ISLANDS.map((i) => [i.id, i]));

export const BIOME_NAMES: Record<Biome, string> = { meadow: 'łąka', marsh: 'bagna', reef: 'rafa', cliffs: 'klify', volcanic: 'wulkan', mainland: 'ląd stały' };

/** clearing one 4×4 chunk of wild land */
export const CHUNK = 4;
export const clearCost = (clearedSoFar: number) => Math.round(400 * Math.pow(1.22, clearedSoFar) / 10) * 10;
export const PATH_COST = 5;

// ---------------------------------------------------------------- placeables

export type PlaceCat = 'gate' | 'enclosure' | 'station' | 'farm' | 'visitor' | 'decor';

export const CAT_NAMES: Record<Exclude<PlaceCat, 'gate'>, string> = {
  enclosure: 'Wybiegi', station: 'Stacje', farm: 'Farmy', visitor: 'Dla zwiedzających', decor: 'Dekoracje',
};

export interface PlaceDef {
  id: string;
  cat: PlaceCat;
  name: string;
  desc: string;
  /** footprint at a level (before rotation) */
  size: (level: number) => [number, number];
  unlockLevel: number;
  maxLevel: number;
  /** one per park (stations) */
  unique?: boolean;
  /** station: its level lives in s.buildings */
  station?: BuildingId;
  habitat?: Habitat;
  /** farm output */
  food?: Food[];
  /** must touch a path connected to the island gate to earn */
  needsPath?: boolean;
  /** must touch water (aquaculture) */
  needsWater?: boolean;
  /** shops: share of the island's ticket income per second at level 1 */
  shopShare?: number;
  /** decorations / attractions: appeal points spread around */
  appeal?: number;
  /** toilets: shops in range earn more */
  comfort?: number;
  /** cannot be demolished */
  fixed?: boolean;
}

const fixed = (w: number, h: number) => () => [w, h] as [number, number];

// ---- enclosures: one fixed footprint; a level adds pens and room inside, never land
export const ENC_SIZE: [number, number] = [8, 8];
export interface EnclosureLevel { pens: number; penSlots: number }
export const ENCLOSURE_LEVELS: EnclosureLevel[] = [
  { pens: 2, penSlots: 4 },
  { pens: 3, penSlots: 5 },
  { pens: 4, penSlots: 6 },
  { pens: 6, penSlots: 8 },
  { pens: 8, penSlots: 10 },
  // research: Rozległe wybiegi, Rezerwaty
  { pens: 10, penSlots: 12 },
  { pens: 12, penSlots: 14 },
];
/** footprints of 0.3.0, when the level was the physical size (save migration) */
export const LEGACY_ENC_SIZE: [number, number][] = [[6, 6], [8, 6], [8, 8], [10, 8], [12, 10], [14, 12], [16, 14]];
/** enclosure levels open without research */
export const ENC_BASE_MAX = 5;
export const encLevel = (level: number) => ENCLOSURE_LEVELS[Math.max(0, Math.min(ENCLOSURE_LEVELS.length, level) - 1)];

/** sea first, then fresh water, land and air — the order life conquered them (and the order the sites open) */
export const HABITAT_BASE_COST: Record<Habitat, number> = { marine: 300, freshwater: 900, land: 1500, air: 2500 };
export const HABITAT_UNLOCK_LEVEL: Record<Habitat, number> = { ...HABITAT_UNLOCK };
export const ENCLOSURE_NAMES: Record<Habitat, string> = { land: 'Wybieg', freshwater: 'Bagno', marine: 'Laguna', air: 'Woliera' };
const ENCLOSURE_DESC: Record<Habitat, string> = {
  land: 'Dla zwierząt lądowych. Trawa, drzewa i solidny płot.',
  freshwater: 'Dla zwierząt słodkowodnych i ziemno-wodnych: staw, trzciny, błoto.',
  marine: 'Morski basen dla ryb, gadów morskich i bezkręgowców.',
  air: 'Wysoka siatka dla latających: pterozaurów, ptaków i owadów.',
};

const enclosures: PlaceDef[] = (['land', 'freshwater', 'marine', 'air'] as Habitat[]).map((h) => ({
  id: `enc_${h}`,
  cat: 'enclosure',
  name: ENCLOSURE_NAMES[h],
  desc: ENCLOSURE_DESC[h],
  size: () => ENC_SIZE,
  unlockLevel: HABITAT_UNLOCK_LEVEL[h],
  maxLevel: ENCLOSURE_LEVELS.length,
  habitat: h,
  needsPath: true,
}));

// ---- stations: the existing buildings, now physical
const STATION_SIZE: Partial<Record<BuildingId, [number, number]>> = {
  expedition: [4, 3], prep: [3, 3], sequencer: [3, 3], hatchery: [4, 3], research: [4, 4], mutation: [3, 3], museum: [5, 4], visitor: [4, 3],
};
export const STATION_IDS = Object.keys(STATION_SIZE) as BuildingId[];
const stations: PlaceDef[] = STATION_IDS.map((b) => {
  const d = BUILDING_BY_ID[b];
  const [w, h] = STATION_SIZE[b]!;
  return {
    id: `st_${b}`, cat: 'station', name: d.name, desc: d.desc, size: fixed(w, h), unlockLevel: d.unlockLevel, maxLevel: d.maxLevel,
    unique: true, station: b, needsPath: b === 'museum' || b === 'visitor',
  } satisfies PlaceDef;
});

// ---- farms: several allowed, each with its own level and storage
const farms: PlaceDef[] = [
  { id: 'farm_meat', cat: 'farm', name: 'Hodowla', desc: 'Produkuje mięso dla drapieżników.', size: fixed(4, 3), unlockLevel: 1, maxLevel: 40, food: ['meat'] },
  { id: 'farm_plants', cat: 'farm', name: 'Szklarnia paleobotaniczna', desc: 'Paprocie, sagowce i skrzypy dla roślinożerców.', size: fixed(3, 3), unlockLevel: 1, maxLevel: 40, food: ['plants'] },
  { id: 'farm_aqua', cat: 'farm', name: 'Akwakultura', desc: 'Ryby i plankton dla zwierząt wodnych. Musi stać nad wodą.', size: fixed(4, 4), unlockLevel: 1, maxLevel: 40, food: ['fish', 'plankton'], needsWater: true },
];
export const FARM_BASE_COST: Record<string, number> = { farm_meat: 200, farm_plants: 200, farm_aqua: 600 };

// ---- visitor buildings
const visitor: PlaceDef[] = [
  { id: 'v_kiosk', cat: 'visitor', name: 'Kiosk z pamiątkami', desc: 'Pluszowe trylobity i koszulki z amonitem.', size: fixed(2, 2), unlockLevel: 1, maxLevel: 20, needsPath: true, shopShare: 0.05 },
  { id: 'v_bar', cat: 'visitor', name: 'Bar z przekąskami', desc: 'Lody „Lodowiec plejstoceński” i frytki.', size: fixed(2, 2), unlockLevel: 2, maxLevel: 20, needsPath: true, shopShare: 0.07 },
  { id: 'v_toilet', cat: 'visitor', name: 'Toalety', desc: 'Zadowoleni zwiedzający wydają więcej w sklepach w okolicy.', size: fixed(2, 2), unlockLevel: 3, maxLevel: 5, needsPath: true, comfort: 0.15 },
  { id: 'v_restaurant', cat: 'visitor', name: 'Restauracja', desc: 'Obiad z widokiem na wybiegi.', size: fixed(4, 3), unlockLevel: 6, maxLevel: 20, needsPath: true, shopShare: 0.15 },
  { id: 'v_view', cat: 'visitor', name: 'Punkt widokowy', desc: 'Wieża z lunetami: podnosi urok całej okolicy.', size: fixed(3, 3), unlockLevel: 8, maxLevel: 10, needsPath: true, appeal: 10 },
  { id: 'v_balloon', cat: 'visitor', name: 'Balon widokowy', desc: 'Wielka atrakcja: lot nad wybiegami.', size: fixed(4, 4), unlockLevel: 12, maxLevel: 20, needsPath: true, shopShare: 0.12, appeal: 8 },
  { id: 'v_hotel', cat: 'visitor', name: 'Hotel', desc: 'Goście zostają na noc i wydają dużo.', size: fixed(5, 4), unlockLevel: 18, maxLevel: 20, needsPath: true, shopShare: 0.2 },
];
export const VISITOR_BASE_COST: Record<string, number> = { v_kiosk: 250, v_bar: 600, v_toilet: 400, v_restaurant: 4000, v_view: 9000, v_balloon: 60000, v_hotel: 400000 };

// ---- decorations (map)
interface DecorSpec { id: string; name: string; size: number; appeal: number; cost: number; level: number }
const DECOR: DecorSpec[] = [
  { id: 'd_fern', name: 'Paproć drzewiasta', size: 1, appeal: 1, cost: 40, level: 1 },
  { id: 'd_cycad', name: 'Sagowiec', size: 1, appeal: 1, cost: 50, level: 1 },
  { id: 'd_bush', name: 'Krzewy', size: 1, appeal: 1, cost: 30, level: 1 },
  { id: 'd_flowers', name: 'Kwietnik', size: 1, appeal: 2, cost: 80, level: 1 },
  { id: 'd_bench', name: 'Ławka', size: 1, appeal: 1, cost: 60, level: 1 },
  { id: 'd_lamp', name: 'Latarnia', size: 1, appeal: 1, cost: 70, level: 2 },
  { id: 'd_rock', name: 'Głaz', size: 1, appeal: 1, cost: 40, level: 1 },
  { id: 'd_araucaria', name: 'Araukaria', size: 2, appeal: 3, cost: 250, level: 2 },
  { id: 'd_ginkgo', name: 'Miłorząb', size: 2, appeal: 3, cost: 300, level: 3 },
  { id: 'd_sign', name: 'Tablica informacyjna', size: 1, appeal: 2, cost: 150, level: 3 },
  { id: 'd_pond', name: 'Staw', size: 2, appeal: 4, cost: 600, level: 4 },
  { id: 'd_fountain', name: 'Fontanna', size: 2, appeal: 5, cost: 1200, level: 5 },
  { id: 'd_statue', name: 'Rzeźba dinozaura', size: 2, appeal: 6, cost: 3000, level: 7 },
  { id: 'd_waterfall', name: 'Wodospad', size: 2, appeal: 8, cost: 12000, level: 10 },
  { id: 'd_amber', name: 'Bursztynowy obelisk', size: 2, appeal: 10, cost: 50000, level: 15 },
];
const decor: PlaceDef[] = DECOR.map((d) => ({
  id: d.id, cat: 'decor', name: d.name, desc: `Urok +${d.appeal} w okolicy.`, size: fixed(d.size, d.size), unlockLevel: d.level, maxLevel: 1, appeal: d.appeal,
}));
export const DECOR_COST: Record<string, number> = Object.fromEntries(DECOR.map((d) => [d.id, d.cost]));

const gate: PlaceDef = { id: 'gate', cat: 'gate', name: 'Przystań z bramą', desc: 'Tędy wchodzą zwiedzający. Ścieżki zaczynają się tutaj.', size: fixed(4, 2), unlockLevel: 1, maxLevel: 1, fixed: true };

export const PLACE_DEFS: PlaceDef[] = [gate, ...enclosures, ...stations, ...farms, ...visitor, ...decor];
export const PLACE_BY_ID = new Map(PLACE_DEFS.map((d) => [d.id, d]));
export const enclosureDefId = (h: Habitat) => `enc_${h}`;
export const stationDefId = (b: BuildingId) => `st_${b}`;

// ---------------------------------------------------------------- interior decorations of an enclosure

export interface InteriorDecor { id: string; name: string; habitat: Habitat | 'any'; comfort: number; cost: number }
export const INTERIOR_DECOR: InteriorDecor[] = [
  { id: 'i_log', name: 'Kłoda', habitat: 'any', comfort: 3, cost: 120 },
  { id: 'i_boulder', name: 'Głazy', habitat: 'any', comfort: 3, cost: 150 },
  { id: 'i_trough', name: 'Wodopój', habitat: 'land', comfort: 6, cost: 500 },
  { id: 'i_ferns', name: 'Gąszcz paproci', habitat: 'land', comfort: 4, cost: 250 },
  { id: 'i_nest', name: 'Gniazdo', habitat: 'land', comfort: 5, cost: 400 },
  { id: 'i_reeds', name: 'Trzcinowisko', habitat: 'freshwater', comfort: 5, cost: 600 },
  { id: 'i_mud', name: 'Błotna kąpiel', habitat: 'freshwater', comfort: 6, cost: 900 },
  { id: 'i_reef', name: 'Rafa', habitat: 'marine', comfort: 7, cost: 1500 },
  { id: 'i_kelp', name: 'Las wodorostów', habitat: 'marine', comfort: 5, cost: 1000 },
  { id: 'i_ledge', name: 'Skalna półka', habitat: 'air', comfort: 6, cost: 1800 },
  { id: 'i_perch', name: 'Grzędy', habitat: 'air', comfort: 5, cost: 1200 },
];
export const INTERIOR_BY_ID = new Map(INTERIOR_DECOR.map((d) => [d.id, d]));
export const interiorSlots = (level: number) => 2 + level;

// ---------------------------------------------------------------- numbers

export const P = {
  /** enclosure happiness */
  happyBase: 50,
  happyPerLevel: 6,
  happyNearbyCap: 20,
  appealRadius: 4,
  comfortRadius: 6,
  crowdPenalty: 5,
  /** income multiplier at happiness 0 and 100 */
  happyMin: 0.75,
  happyMax: 1.25,
  /** pen bonuses */
  herdPer: 0.1,
  herdMax: 3,
  mixPer: 0.05,
  /** same shop type on one island: each next one earns this much of the previous */
  shopRepeat: 0.6,
  shopPerLevel: 0.25,
  /** shops: appeal nearby boosts income (per point, capped) */
  shopAppealPer: 0.01,
  shopAppealCap: 0.25,
  /** storage: hours of production (enclosures use m.bankHours) */
  farmHours: 2,
  shopHours: 1,
  minStore: 50,
  /** demolishing refunds this share */
  refund: 0.5,
  enclosureCostGrowth: 1.6,
  farmCostGrowth: 1.8,
  farmUpgradeGrowth: 2.0,
  shopCostGrowth: 1.6,
  shopUpgradeGrowth: 1.9,
  encUpgradeMult: 1.5,
  encUpgradeGrowth: 2.2,
  penCostShare: 0.3,
};

/** cost to place a new object of this definition, given how many of it exist already */
export function placeCost(def: PlaceDef, count: number): number {
  switch (def.cat) {
    case 'enclosure': return Math.round(HABITAT_BASE_COST[def.habitat!] * Math.pow(P.enclosureCostGrowth, count));
    case 'station': return buildingCost(BUILDING_BY_ID[def.station!], 1);
    case 'farm': return Math.round(FARM_BASE_COST[def.id] * Math.pow(P.farmCostGrowth, count));
    case 'visitor': return Math.round(VISITOR_BASE_COST[def.id] * Math.pow(P.shopCostGrowth, count));
    case 'decor': return DECOR_COST[def.id];
    default: return 0;
  }
}

/** cost of going from `level` to `level + 1` */
export function upgradeCost(def: PlaceDef, level: number): number {
  switch (def.cat) {
    case 'enclosure': return Math.round(HABITAT_BASE_COST[def.habitat!] * P.encUpgradeMult * Math.pow(P.encUpgradeGrowth, level - 1));
    case 'station': return buildingCost(BUILDING_BY_ID[def.station!], level + 1);
    case 'farm': return Math.round(FARM_BASE_COST[def.id] * Math.pow(P.farmUpgradeGrowth, level));
    case 'visitor': return Math.round(VISITOR_BASE_COST[def.id] * Math.pow(P.shopUpgradeGrowth, level));
    default: return Infinity;
  }
}

export const penCost = (def: PlaceDef, pens: number) => Math.round(HABITAT_BASE_COST[def.habitat!] * P.penCostShare * pens);

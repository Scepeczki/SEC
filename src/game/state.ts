// Game state model + new game factory + seeded RNG stored in state.

import type { Food, Habitat } from '../data/types';
import { B } from './balance';
import { BUILDINGS, START_SITE, type BuildingId } from './content';

/** 2 = park 2.0 (islands, map objects, pens) · 3 = fixed enclosure size · 4 = dig 2.0 (chain reactions, new workshop) */
export const SAVE_VERSION = 5;

/** the only digging tool; the player's own modifiers are chosen in the UI (see PlayerTool) */
export type Tool = 'brush';
export type Quality = 0 | 1 | 2;

/**
 * Rock modifiers (dig 2.0): when a tile with a modifier breaks, it sets off more tiles — a chain reaction.
 * arrow — breaks the next tiles in the direction of the arrow; bomb — a 3×3 blast;
 * vein — every rock touching the empty space this tile opens onto; key — when it is the last rock in its row: the whole column;
 * echo — sets off other modifier tiles; gem — doubles the reward multiplier of the chain it is part of.
 */
export type ModKind = 'arrow' | 'bomb' | 'vein' | 'key' | 'echo' | 'gem';
/** 0 → right, 1 → down, 2 → left, 3 → up */
export type Dir = 0 | 1 | 2 | 3;
/** the player's own modifiers, placed by hand a few times per layer */
export type PlayerTool = 'bomb' | 'link' | 'rotate' | 'move' | 'copy';
export interface Tile {
  hp: number;
  max: number;
  item: number;
  mod?: ModKind;
  dir?: Dir;
  /** linked tile (player's „Połączenie”): when one breaks, so does the other */
  link?: number;
  /** flint: a chain cannot break it (only a blast can) — your brush and the crews can */
  flint?: boolean;
}
export type ItemKind = 'fossil' | 'minor' | 'amber' | 'mineral';
export interface LayerItem {
  kind: ItemKind;
  genusId?: number;
  minorName?: string;
  mineralId?: string;
  quality: Quality;
  cells: number[];
  found: boolean;
}
export interface LayerOutcome {
  /** layersDone value after this layer was finished */
  n: number;
  /** 1–3 stars: how few manual breaks the layer took */
  stars?: number;
  manual?: number;
  best?: number;
  /** every find in the layer was dug out (not just the fossils) */
  full: boolean;
  bonus?: { coins: number; pb: number };
  /** epoch-boundary chest (every 5 layers), waiting to be opened */
  chest?: PendingChest;
}
/** 0 brązowa, 1 srebrna, 2 złota */
export type ChestTier = 0 | 1 | 2;
export interface PendingChest { id: number; siteId: string; depth: number; tier: ChestTier; t: number }
export type LootKind = 'coins' | 'shards' | 'pb' | 'mutagen' | 'food' | 'fossil' | 'mineral';
export interface Loot { kind: LootKind; amount: number; food?: Food; genusId?: number; quality?: Quality; mineralId?: string; /** 0–3: how exciting (drives the reveal effect) */ rare: number; isNew?: boolean }
/** a combo that is still open: it can go on with the next manual break (upgrade „Dwutakt”) */
export interface OpenCombo { n: number; left: number; gems: number }
export interface SiteState {
  depth: number;
  tiles: Tile[];
  items: LayerItem[];
  layersDone: number;
  fossilsFound: number;
  lastDone?: LayerOutcome;
  /** layer size in tiles (older saves: 10 × 7) */
  w?: number;
  h?: number;
  /** manual breaks in this layer (the fewer, the better the layer's rating) */
  manual?: number;
  /** biggest chain in this layer */
  best?: number;
  combo?: OpenCombo;
  /** uses of the player's own modifiers left in this layer */
  uses?: Partial<Record<PlayerTool, number>>;
}
/** digging records over the whole game */
export interface DigRecords { combo: number; fewest: number; oneHit: number; stars3: number }

export interface Job { genusId: number; quality: Quality; t: number; dur: number }
export interface Incubation { genusId: number; t: number; dur: number; chance: number; cost: number }
/** enc = enclosure object id (0 = waiting in the Transporter), pen = pen index inside it */
export interface Animal { uid: number; genusId: number; level: number; stage: number; enc: number; pen: number; born: number }

/** something placed on an island (enclosure, station, farm, visitor building, decoration, gate) */
export interface ParkObject {
  id: number;
  def: string;
  island: number;
  /** top-left tile */
  x: number;
  y: number;
  /** 1 = rotated by 90° (width and height swapped) */
  rot: 0 | 1;
  /** enclosures, farms, shops; stations keep their level in s.buildings */
  level: number;
  /** uncollected coins (enclosures, shops, museum) or food units (farms) */
  store: number;
  /** placed at */
  t: number;
  /** enclosures: number of pens */
  pens?: number;
  /** enclosures: interior decorations */
  decor?: string[];
  /** footprint kept from an older save when the standard one does not fit there */
  fp?: [number, number];
}
export interface IslandState {
  bought: number;
  cleared: number[];
  /** start radius bought with (islands bought in 0.3.0 keep their larger clear area) */
  start?: number;
}
export interface ParkState {
  islands: Record<number, IslandState>;
  objects: ParkObject[];
  nextId: number;
  /** path tiles per island (tile index y·w + x) */
  paths: Record<number, number[]>;
  /** bumped on every map change (cache key) */
  rev: number;
}

export type ContractKind = 'fossils' | 'genome' | 'animal' | 'hatch' | 'evolve';
export interface Contract {
  id: number;
  kind: ContractKind;
  institution: string;
  text: string;
  siteId?: string;
  genusId?: number;
  habitat?: Habitat;
  minLevel?: number;
  stage?: number;
  need: number;
  progress: number;
  base: number; // progress baseline when accepted (for counters)
  reward: { coins: number; pb: number; mutagen: number; fame: number };
}

export type CrewMode = 'off' | 'helpers' | 'full';
export interface Discovery { genusId: number; t: number; siteId: string; byCrew: boolean; seen: boolean }

/** every item dug up (recent history shown on the dig screen) */
export interface FindEntry {
  kind: ItemKind;
  /** mineral id */
  mineral?: string;
  genusId?: number;
  name?: string;
  quality: Quality;
  siteId: string;
  byCrew: boolean;
  t: number;
  /** first fossil of this genus ever */
  isNew?: boolean;
  /** what it turned into */
  pb?: number;
  coins?: number;
  mutagen?: number;
}

export interface LogEntry { t: number; text: string; kind?: 'good' | 'info' | 'bad' }

export interface GameState {
  v: number;
  seed: number;
  created: number;
  now: number;
  playSeconds: number;
  coins: number;
  pb: number;
  mutagen: number;
  fame: number;
  food: Record<Food, number>;
  fossils: Record<number, [number, number, number]>;
  genome: Record<number, number>;
  discovered: Record<number, number>;
  hatched: Record<number, number>;
  bestStage: Record<number, number>;
  researchedClades: Record<number, number>;
  completedClades: Record<number, number>;
  tech: Record<string, number>;
  buildings: Record<BuildingId, number>;
  park: ParkState;
  animals: Animal[];
  nextUid: number;
  unlockedSites: Record<string, number>;
  activeSite: string;
  sites: Record<string, SiteState>;
  crewAcc: number;
  labQueue: Job[];
  labActive: Job[];
  incubating: Incubation[];
  contracts: Contract[];
  nextContractId: number;
  stats: { clicks: number; fossils: number; layers: number; minor: number; amber: number; hatchFails: number; extractions: number; evolutions: number };
  log: LogEntry[];
  settings: { revealAll: boolean; tool: Tool; crewMode?: CrewMode; /** 0–1 */ sound?: number; /** automatic digging under the cursor (when unlocked) */ autoDig?: boolean };
  /** tool upgrade levels (see tools.ts) */
  tools: Record<string, number>;
  mutagenAcc: number;
  /** first discoveries of new genera (inbox) */
  discoveries: Discovery[];
  /** recent finds of any kind (newest first) */
  finds: FindEntry[];
  /** mineral collection: id → how many found */
  minerals: Record<string, number>;
  /** rock shards: earned by digging, spent in the workshop */
  shards: number;
  /** digging records (dig 2.0) */
  digRecords: DigRecords;
  /** epoch chests waiting to be opened */
  chests: PendingChest[];
  nextChestId: number;
  /** story mode: narration on/off and which story beats / scenes were already shown */
  story: { on: boolean; seen: Record<string, number> };
}

export function newGame(now = Date.now(), seed = (now ^ 0x5bd1e995) >>> 0): GameState {
  const buildings = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.startLevel])) as Record<BuildingId, number>;
  return {
    v: SAVE_VERSION,
    seed,
    created: now,
    now,
    playSeconds: 0,
    coins: B.startCoins,
    pb: 0,
    mutagen: 0,
    fame: 0,
    food: { meat: B.startFood, plants: B.startFood, fish: B.startFood, plankton: B.startFood },
    fossils: {},
    genome: {},
    discovered: {},
    hatched: {},
    bestStage: {},
    researchedClades: {},
    completedClades: {},
    tech: {},
    buildings,
    park: { islands: {}, objects: [], nextId: 1, paths: {}, rev: 0 },
    animals: [],
    nextUid: 1,
    unlockedSites: {}, // the first site is bought on the map
    activeSite: START_SITE,
    sites: {},
    crewAcc: 0,
    labQueue: [],
    labActive: [],
    incubating: [],
    contracts: [],
    nextContractId: 1,
    stats: { clicks: 0, fossils: 0, layers: 0, minor: 0, amber: 0, hatchFails: 0, extractions: 0, evolutions: 0 },
    log: [],
    settings: { revealAll: false, tool: 'brush', crewMode: 'helpers', sound: 0.6 },
    tools: {},
    mutagenAcc: 0,
    discoveries: [],
    finds: [],
    minerals: {},
    shards: 0,
    digRecords: { combo: 0, fewest: 0, oneHit: 0, stars3: 0 },
    chests: [],
    nextChestId: 1,
    story: { on: true, seen: {} },
  };
}

/** seeded RNG step (mulberry32) stored in state for reproducible simulation */
export function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function log(s: GameState, text: string, kind: LogEntry['kind'] = 'info') {
  s.log.unshift({ t: s.now, text, kind });
  if (s.log.length > 60) s.log.length = 60;
}

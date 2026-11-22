// Shared data types for the generated taxonomy (src/data/taxa.json) and sites (src/data/sites.json).

export type Habitat = 'land' | 'freshwater' | 'marine' | 'air';
export type Food = 'meat' | 'plants' | 'fish' | 'plankton';
export type SizeClass = 'XS' | 'S' | 'M' | 'L' | 'XL';
/** 0 Pospolity, 1 Rzadki, 2 Bardzo rzadki, 3 Legendarny */
export type Rarity = 0 | 1 | 2 | 3;

export type BranchId =
  | 'paleo_seas'
  | 'early_tetrapods'
  | 'synapsids'
  | 'reptiles'
  | 'marine_reptiles'
  | 'pterosaurs'
  | 'dinosaurs'
  | 'mammals';

/** Internal node of the tree of life (a clade). */
export interface CladeNode {
  id: number;
  name: string;
  namePl?: string;
  rank: string;
  parent: number | null;
  children: number[];
  /** number of collectible genera in this subtree */
  leafCount: number;
}

/** A collectible genus (leaf). */
export interface Genus {
  id: number;
  name: string;
  parent: number;
  branch: BranchId;
  archetype: string;
  habitat: Habitat;
  food: Food;
  size: SizeClass;
  rarity: Rarity;
  /** first appearance (max, Ma) and last appearance (min, Ma) */
  fromMa: number;
  toMa: number;
  earlyInterval?: string;
  lateInterval?: string;
  occurrences: number;
  family?: string;
  order?: string;
  commonEn?: string;
  dietRaw?: string;
  envRaw?: string;
  icon?: boolean;
  /** ids of sites where it can be dug up */
  sites: string[];
}

export interface TaxaFile {
  generatedAt: string;
  rootId: number;
  clades: CladeNode[];
  genera: Genus[];
}

export interface SiteFauna {
  genusId: number;
  /** number of PBDB occurrences in this formation (drop weight basis) */
  occ: number;
  /** "gość epoki": the genus lived at this time and in this environment, but its fossils come from elsewhere */
  guest?: boolean;
}

export interface Site {
  id: string;
  name: string;
  formations: string[];
  country: string;
  lat: number;
  lng: number;
  period: string;
  fromMa: number;
  toMa: number;
  description: string;
  fauna: SiteFauna[];
  /** genera found there that are not collectible -> small fossils */
  minorFossils: { name: string; group: string; occ: number }[];
}

export interface SitesFile {
  generatedAt: string;
  sites: Site[];
}

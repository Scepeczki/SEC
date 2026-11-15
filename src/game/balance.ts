// ALL tunable numbers live here.

import type { Food, Habitat, Rarity, SizeClass } from '../data/types';

export const RARITY_NAMES = ['Pospolity', 'Rzadki', 'Bardzo rzadki', 'Legendarny'] as const;
export const RARITY_COLORS = ['#9aa39a', '#4f9be0', '#b065e0', '#e8a92a'] as const;
export const QUALITY_NAMES = ['Fragment', 'Częściowa', 'Kompletna'] as const;
export const FOOD_NAMES: Record<Food, string> = { meat: 'Mięso', plants: 'Rośliny', fish: 'Ryby', plankton: 'Plankton' };
export const FOOD_ICONS: Record<Food, string> = { meat: '🥩', plants: '🌿', fish: '🐟', plankton: '🦐' };
export const HABITAT_NAMES: Record<Habitat, string> = { land: 'Wybieg', freshwater: 'Bagno', marine: 'Laguna', air: 'Woliera' };
export const HABITAT_ICONS: Record<Habitat, string> = { land: '🌳', freshwater: '🐸', marine: '🌊', air: '🦅' };
export const SIZE_NAMES: Record<SizeClass, string> = { XS: 'malutki', S: 'mały', M: 'średni', L: 'duży', XL: 'olbrzymi' };

export const B = {
  // ---------------- start
  startCoins: 600,
  startFood: 60,
  startPlots: 6,
  // ---------------- dig sites
  gridW: 10,
  gridH: 7,
  tileHp: 3,
  tileHpPerDepth: 0.15,
  tileHpExp: 1.02,
  fossilsPerLayer: 3,
  minorPerLayer: 4,
  amberChance: 0.35,
  /** drop weight multipliers by rarity, and how much depth helps */
  rarityWeight: [1, 0.45, 0.16, 0.05],
  rarityDepthBonus: [0, 0.05, 0.1, 0.16],
  qualityOdds: [0.62, 0.3, 0.08],
  qualityDepthShift: 0.006,
  crewInterval: 6, // seconds per hit per crew
  hammerDamageChance: 0.25,
  minorPB: 1,
  minorCoins: 5,
  metersPerLayer: 3,
  /** chance of a mineral in a layer (grows with depth) */
  mineralChance: 0.3,
  mineralChancePerDepth: 0.006,
  mineralChanceMax: 0.6,
  /** bonus for digging out everything in a layer (not just the fossils) */
  fullLayerCoins: 30,
  fullLayerPB: 2,
  /** epoch-boundary chest every N layers */
  chestEvery: 5,
  chestCoins: 100, // × depth
  chestPB: 5,
  chestMutagenChance: 0.3,
  /** player hits only: crit = tile broken outright */
  critChance: 0.1,
  hammerCenterMult: 1,
  hammerArmMult: 0.6,
  /** golden flash rewards */
  goldenCoins: 50, // × (depth + 1)
  goldenPB: 6,
  // ---------------- lab
  extractTime: [15, 30, 60], // by quality, seconds
  extractRarityMult: [1, 1.6, 2.5, 4],
  genomeYield: [[2.5, 4], [6, 9], [14, 20]] as [number, number][], // by quality
  genomeRarityDiv: [1, 1.3, 1.7, 2.2],
  extractPB: [1, 2, 4],
  // ---------------- hatchery
  synthCost: [150, 450, 1400, 4500],
  synthTime: [30, 60, 120, 240],
  sizeMult: { XS: 0.6, S: 0.8, M: 1, L: 1.4, XL: 2 } as Record<SizeClass, number>,
  synthFailRefund: 0.5,
  // ---------------- park
  incomeBase: [0.6, 1.5, 4, 10], // coins / s at level 1, stage 0
  incomePerLevel: 0.08,
  stageIncomeMult: [1, 1.4, 2, 2.8, 4],
  collectionBonusPerGenus: 0.005,
  cladeCompleteBonus: 0.02,
  bankHours: 1,
  habitatBaseSlots: 4,
  habitatSlotsPerLevel: 2,
  habitatCost: { land: 300, freshwater: 900, marine: 1500, air: 2500 } as Record<Habitat, number>,
  habitatCostGrowth: 1.6,
  habitatUpgradeCost: 400,
  habitatUpgradeGrowth: 1.6,
  plotCost: 1000,
  plotCostGrowth: 1.45,
  // ---------------- feeding / evolution
  foodBase: [10, 25, 60, 150],
  foodGrowth: 1.2,
  stageCap: [10, 20, 30, 40, 40],
  evolveMutagen: [0, 2, 5, 12],
  evolvePB: [20, 100, 400, 1500],
  evolveCoins: [200, 2000, 15000, 120000],
  evolveRarityMult: [1, 1.5, 2.5, 4],
  foodBuyPrice: 2, // coins per unit
  // ---------------- clade research
  cladeResearchBase: 5,
  cladeResearchExp: 0.6,
  // ---------------- fame / park level
  fameNewGenus: [60, 120, 250, 600],
  fameEvolve: [10, 25, 60, 150],
  fameDiscover: 5,
  fameClade: 15,
  levelFame: (lvl: number) => Math.round(100 * Math.pow(lvl, 1.85)),
  // ---------------- offline
  offlineCapHours: 8,
};

export function synthCost(rarity: Rarity, size: SizeClass, discount = 0): number {
  return Math.round(B.synthCost[rarity] * B.sizeMult[size] * (1 - discount));
}
export function synthTime(rarity: Rarity, size: SizeClass, speed = 1): number {
  return (B.synthTime[rarity] * B.sizeMult[size]) / speed;
}
export function foodCost(rarity: Rarity, level: number, discount = 0): number {
  return Math.ceil(B.foodBase[rarity] * Math.pow(B.foodGrowth, level - 1) * (1 - discount));
}
export function animalIncome(rarity: Rarity, level: number, stage: number): number {
  return B.incomeBase[rarity] * (1 + B.incomePerLevel * (level - 1)) * B.stageIncomeMult[stage];
}
export function evolveCost(rarity: Rarity, stage: number) {
  const m = B.evolveRarityMult[rarity];
  return { mutagen: Math.ceil(B.evolveMutagen[stage] * m), pb: Math.round(B.evolvePB[stage] * m), coins: Math.round(B.evolveCoins[stage] * m) };
}
export function cladeResearchCost(leafCount: number): number {
  return Math.round(B.cladeResearchBase * Math.pow(leafCount, B.cladeResearchExp));
}
export function parkLevelFromFame(fame: number): { level: number; cur: number; next: number } {
  let lvl = 1;
  while (fame >= B.levelFame(lvl)) lvl++;
  return { level: lvl, cur: lvl > 1 ? B.levelFame(lvl - 1) : 0, next: B.levelFame(lvl) };
}

export function fmt(n: number): string {
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const units = ['', 'k', 'M', 'G', 'T', 'P'];
  let u = 0;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n).toString()) + units[u];
}

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

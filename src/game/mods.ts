// Derived modifiers from buildings + research. Recomputed on demand (cheap).

import { B } from './balance';
import { crewsAt, foodRate, pbRate } from './content';
import type { GameState } from './state';
import { toolLevel } from './tools';

export interface Mods {
  crews: number;
  crewSpeed: number;
  toolPower: number;
  qualityShift: number;
  fossilsPerLayer: number;
  amberChance: number;
  rarityDepthMult: number;
  /** georadar level 0–4: 0 none, 1 rough zones … 4 exact outlines */
  scanner: number;
  hammer: boolean;
  // ---- tool trees (tools.ts)
  /** damage of a brush hit */
  brushPower: number;
  /** damage of the hammer's centre tile */
  hammerPower: number;
  hammerSquare: boolean;
  hammerRisk: number;
  critBrush: number;
  critHammer: number;
  /** streak upgrade level (0 = no streak bonus) */
  combo: number;
  /** fever length in seconds (0 = locked) */
  feverSec: number;
  /** share of a brush hit dealt to the 4 neighbours */
  splash: number;
  /** smoulder damage per second (0 = locked) */
  emberDps: number;
  /** share of strength every tile loses on a hammer blow */
  quake: number;
  radarGlint: boolean;
  sonar: boolean;
  crewAim: number;
  /** strength of one crew hit */
  crewPower: number;
  /** chance a crew hit breaks the tile outright */
  crewCrit: number;
  /** shards per broken tile multiplier (player); crews get crewShardMult on top */
  shardMult: number;
  crewShardMult: number;
  /** brush: chance a stroke also hits a neighbouring tile */
  sweep: number;
  /** brush: chance a dying ember jumps to a neighbour */
  wildfire: number;
  /** hammer: only the centre tile can hurt a bone */
  hammerCenterRisk: boolean;
  hammerAfter: number;
  /** hits per second while the cursor rests on the field (workshop: Pędzel mechaniczny / Młot udarowy) */
  autoBrush: number;
  autoHammer: number;
  // ---- charges
  charge: boolean;
  chargeCd: number;
  chargeMax: number;
  /** 0 = 3×3, 1 = diamond radius 2, 2 = 5×5 */
  chargeSize: number;
  chargeShards: number;
  chargeChain: number;
  chargeMega: boolean;
  /** extra weight of rare fossils (multiplier on rarity ≥ 1) */
  rareBoost: number;
  mineralMult: number;
  /** golden flashes: interval multiplier (< 1 = more often) */
  goldenEvery: number;
  labSlots: number;
  labSpeed: number;
  genomeMult: number;
  geneBank: boolean;
  incubSlots: number;
  incubSpeed: number;
  synthBonus: number;
  synthDiscount: number;
  incomeMult: number;
  bankHours: number;
  autoCollect: boolean;
  foodDiscount: number;
  farmMult: number;
  meatRate: number;
  plantRate: number;
  fishRate: number;
  planktonRate: number;
  museumRate: number;
  pbRate: number;
  mutagenPerHour: number;
  maxStage: number;
  mutagenDiscount: number;
  offlineHours: number;
  contractSlots: number;
  contractRewardMult: number;
}

export function mods(s: GameState): Mods {
  const b = s.buildings;
  const t = (id: string) => !!s.tech[id];
  const farmMult = t('log2') ? 1.25 : 1;
  const L = (id: string) => toolLevel(s, id);
  const toolPower = 1 + 0.25 * (b.prep - 1);
  const scanner = L('r_res');
  const master = L('b_master') > 0, titan = L('h_titan') > 0, tomo = L('r_tomo') > 0, expo = L('k_expo') > 0;
  return {
    crews: crewsAt(b.expedition) + (t('dig5') ? 1 : 0) + L('k_hire'),
    crewSpeed: (1 + 0.04 * (b.expedition - 1)) * (t('dig1') ? 1.15 : 1) * (1 + 0.1 * L('k_speed')) * (expo ? 2 : 1),
    toolPower,
    qualityShift: 0.01 * (b.prep - 1) + (t('dig8') ? 0.05 : 0) + 0.03 * L('b_care') + (tomo ? 0.05 : 0),
    fossilsPerLayer: B.fossilsPerLayer + (t('dig4') ? 1 : 0) + (t('dig7') ? 1 : 0),
    amberChance: B.amberChance + (t('dig7') ? 0.15 : 0),
    rarityDepthMult: t('dig6') ? 1.5 : 1,
    scanner,
    hammer: L('h_unlock') > 0,
    brushPower: toolPower * (1 + 0.1 * L('b_power')) * (master ? 2 : 1),
    hammerPower: toolPower * (1 + 0.1 * L('h_power')) * (titan ? 2 : 1),
    hammerSquare: L('h_area') > 0,
    hammerRisk: Math.max(0.05, B.hammerDamageChance - 0.04 * L('h_safe')),
    critBrush: 0.02 * L('b_crit') * (master ? 1.5 : 1),
    critHammer: 0.02 * L('h_crit') * (titan ? 1.5 : 1),
    combo: L('b_combo'),
    feverSec: L('b_fever') ? 2 + L('b_fever') : 0,
    splash: 0.08 * L('b_splash'),
    emberDps: 0.12 * L('b_ember') * toolPower,
    quake: 0.015 * L('h_quake'),
    radarGlint: L('r_glint') > 0,
    sonar: L('r_sonar') > 0,
    crewAim: scanner ? 0.08 * scanner + 0.08 * L('r_crew') : 0,
    crewPower: toolPower * (1 + 0.25 * L('k_power')),
    crewCrit: 0.05 * L('k_boss'),
    shardMult: 1 + 0.2 * L('k_sift'),
    crewShardMult: 0.5 * (expo ? 2 : 1),
    sweep: 0.15 * L('b_sweep'),
    wildfire: 0.25 * L('b_wild'),
    hammerCenterRisk: L('h_feather') > 0,
    hammerAfter: 0.25 * L('h_after'),
    autoBrush: [0, 2, 3, 4][L('b_auto')] ?? 4,
    autoHammer: [0, 1, 1.5, 2][L('h_auto')] ?? 2,
    charge: L('x_unlock') > 0,
    chargeCd: 90 * (1 - 0.12 * L('x_fuse')) * (L('x_mega') ? 0.5 : 1),
    chargeMax: 1 + L('x_bag'),
    chargeSize: L('x_power'),
    chargeShards: 1 + 0.5 * L('x_crush'),
    chargeChain: 0.2 * L('x_chain'),
    chargeMega: L('x_mega') > 0,
    rareBoost: (1 + 0.1 * L('r_rare')) * (tomo ? 1.5 : 1),
    mineralMult: tomo ? 1.5 : 1,
    goldenEvery: 1 - 0.2 * L('r_lucky'),
    labSlots: 1 + Math.floor(b.sequencer / 4) + (t('gen2') ? 1 : 0),
    labSpeed: 1 + 0.1 * (b.sequencer - 1),
    genomeMult: (1 + 0.03 * (b.sequencer - 1)) * (1 + (t('gen1') ? 0.1 : 0) + (t('gen5') ? 0.2 : 0)),
    geneBank: t('gen6'),
    incubSlots: 1 + Math.floor(b.hatchery / 5),
    incubSpeed: 1 + 0.1 * (b.hatchery - 1),
    synthBonus: 0.02 * (b.hatchery - 1) + (t('gen4') ? 0.1 : 0),
    synthDiscount: t('gen8') ? 0.3 : 0,
    incomeMult: 1 + 0.05 * b.visitor + (t('park1') ? 0.1 : 0) + (t('park4') ? 0.2 : 0) + (t('park7') ? 0.4 : 0),
    bankHours: B.bankHours + 0.25 * b.visitor + (t('park5') ? 2 : 0),
    autoCollect: t('park2'),
    foodDiscount: (t('park3') ? 0.1 : 0) + (t('park6') ? 0.2 : 0),
    farmMult,
    meatRate: foodRate(b.ranch) * farmMult,
    plantRate: foodRate(b.greenhouse) * farmMult,
    fishRate: foodRate(b.aquaculture) * farmMult,
    planktonRate: foodRate(b.aquaculture) * farmMult,
    museumRate: 0.02 * b.museum * (t('log4') ? 2 : 1),
    pbRate: pbRate(b.research),
    mutagenPerHour: 0.25 * b.mutation,
    maxStage: Math.min(4, 1 + b.mutation),
    mutagenDiscount: t('gen7') ? 0.25 : 0,
    offlineHours: B.offlineCapHours + (t('log1') ? 4 : 0) + (t('log5') ? 8 : 0),
    contractSlots: 3 + (t('log3') ? 1 : 0),
    contractRewardMult: t('log3') ? 1.2 : 1,
  };
}

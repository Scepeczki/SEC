// Derived modifiers from buildings + research. Recomputed on demand (cheap).

import { B } from './balance';
import { crewsAt, pbRate } from './content';
import type { GameState, ModKind, PlayerTool } from './state';
import { MOD_RATE, USES, toolLevel } from './tools';

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
  // ---- workshop (tools.ts)
  /** damage of a brush hit */
  brushPower: number;
  critBrush: number;
  /** 0 = one tile, 1 = two tiles (target + right), 2 = 2×2 */
  brushArea: number;
  /** layer size in tiles */
  gridW: number;
  gridH: number;
  /** modifier share of plain tiles in a new layer */
  modRate: Record<ModKind, number>;
  /** tiles an arrow reaches */
  arrowReach: number;
  /** blast radius of a bomb (1 = 3×3, 2 = 5×5) */
  bombRadius: number;
  /** modifiers an echo tile sets off */
  echoCount: number;
  /** uses per layer of the player's own modifiers */
  uses: Record<PlayerTool, number>;
  /** big combos give back tool uses at this size (0 = never) */
  thriftAt: number;
  /** combo: smallest chain that counts, multiplier step per tile above it, manual breaks it lasts */
  comboMin: number;
  comboStep: number;
  comboCarry: number;
  comboLoot: number;
  /** combos of 20+ get ×2 (capstone) */
  comboCap: boolean;
  /** layer rating: 3 stars at ≤ this many manual breaks; reward bonus per star */
  starsAt: number;
  starBonus: number;
  /** after a combo of 12+, every other tile loses this share of its strength */
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
  /** hits per second while the cursor rests on the field (Pędzel mechaniczny) */
  autoBrush: number;
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
  /** farm output multiplier (each farm makes foodRate(level) × farmMult) */
  farmMult: number;
  /** museum: coins per second per discovered genus */
  museumRate: number;
  pbRate: number;
  mutagenPerHour: number;
  maxStage: number;
  mutagenDiscount: number;
  offlineHours: number;
  contractSlots: number;
  contractRewardMult: number;
  /** park research: extra slots per pen, extra pens per enclosure, highest enclosure level, cheaper clearing */
  penSlotBonus: number;
  penCountBonus: number;
  encMaxLevel: number;
  clearDiscount: number;
}

export function mods(s: GameState): Mods {
  const b = s.buildings;
  const t = (id: string) => !!s.tech[id];
  const farmMult = t('log2') ? 1.25 : 1;
  const L = (id: string) => toolLevel(s, id);
  const toolPower = 1 + 0.25 * (b.prep - 1);
  const scanner = L('r_res');
  const master = L('m_master') > 0, tomo = L('r_tomo') > 0, expo = L('k_expo') > 0;
  const rockCap = L('g_cap') ? 1.5 : 1;
  /** capstone „Architekt warstwy”: +1 use of every unlocked tool */
  const arch = (lvl: number) => (lvl && L('p_cap') ? 1 : 0);
  return {
    crews: crewsAt(b.expedition) + (t('dig5') ? 1 : 0) + L('k_hire'),
    crewSpeed: (1 + 0.04 * (b.expedition - 1)) * (t('dig1') ? 1.15 : 1) * (1 + 0.1 * L('k_speed')) * (expo ? 2 : 1),
    toolPower,
    qualityShift: 0.01 * (b.prep - 1) + (t('dig8') ? 0.05 : 0) + 0.03 * L('m_care') + (tomo ? 0.05 : 0),
    fossilsPerLayer: B.fossilsPerLayer + (t('dig4') ? 1 : 0) + (t('dig7') ? 1 : 0),
    amberChance: B.amberChance + (t('dig7') ? 0.15 : 0),
    rarityDepthMult: t('dig6') ? 1.5 : 1,
    scanner,
    brushPower: toolPower * (1 + 0.15 * L('m_power')) * (master ? 2 : 1),
    critBrush: 0.03 * L('m_crit') * (master ? 1.5 : 1),
    brushArea: L('m_area'),
    gridW: [B.gridW, 12, 14][L('m_size')] ?? 14,
    gridH: [B.gridH, 8, 9][L('m_size')] ?? 9,
    modRate: {
      arrow: MOD_RATE.arrow * L('g_arrow') * rockCap, bomb: MOD_RATE.bomb * L('g_bomb') * rockCap, vein: MOD_RATE.vein * L('g_vein') * rockCap,
      key: MOD_RATE.key * L('g_key') * rockCap, echo: MOD_RATE.echo * L('g_echo') * rockCap, gem: MOD_RATE.gem * L('g_gem') * rockCap,
    },
    arrowReach: 2 + L('g_reach'),
    bombRadius: L('g_cap') ? 2 : 1,
    echoCount: L('g_echo') >= 3 ? 2 : 1,
    uses: {
      bomb: USES.bomb[L('p_bomb')] + arch(L('p_bomb')), link: USES.link[L('p_link')] + arch(L('p_link')), rotate: USES.rotate[L('p_rotate')] + arch(L('p_rotate')),
      move: USES.move[L('p_move')] + arch(L('p_move')), copy: USES.copy[L('p_copy')] + arch(L('p_copy')),
    },
    thriftAt: [0, 15, 10][L('p_thrift')] ?? 10,
    comboMin: 4 - L('c_min'),
    comboStep: 0.1 + 0.05 * L('c_mult'),
    comboCarry: L('c_carry'),
    comboLoot: L('c_loot'),
    comboCap: L('c_cap') > 0,
    starsAt: 4 + L('c_stars'),
    starBonus: 0.25 + (L('c_stars') ? 0.15 * L('c_stars') : 0),
    quake: 0.15 * L('c_quake'),
    radarGlint: L('r_glint') > 0,
    sonar: L('r_sonar') > 0,
    crewAim: scanner ? 0.08 * scanner + 0.08 * L('r_crew') : 0,
    crewPower: toolPower * (1 + 0.25 * L('k_power')),
    crewCrit: 0.05 * L('k_boss'),
    shardMult: 1 + 0.2 * L('k_sift'),
    crewShardMult: 0.5 * (expo ? 2 : 1),
    autoBrush: [0, 2, 3, 4][L('m_auto')] ?? 4,
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
    museumRate: 0.02 * b.museum * (t('log4') ? 2 : 1),
    pbRate: pbRate(b.research),
    mutagenPerHour: 0.25 * b.mutation,
    maxStage: Math.min(4, 1 + b.mutation),
    mutagenDiscount: t('gen7') ? 0.25 : 0,
    offlineHours: B.offlineCapHours + (t('log1') ? 4 : 0) + (t('log5') ? 8 : 0),
    contractSlots: 3 + (t('log3') ? 1 : 0),
    contractRewardMult: t('log3') ? 1.2 : 1,
    penSlotBonus: t('park8') ? 2 : 0,
    penCountBonus: t('park9') ? 2 : 0,
    encMaxLevel: 5 + (t('park10') ? 1 : 0) + (t('park11') ? 1 : 0),
    clearDiscount: t('park12') ? 0.4 : 0,
  };
}

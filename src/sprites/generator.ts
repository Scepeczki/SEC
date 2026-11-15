// Sprite generator: archetype preset + clade traits + per-genus variation + evolution stage -> pixels.

import type { Habitat, SizeClass } from '../data/types';
import { presetFor } from './presets';
import { CLADE_TRAITS, GENUS_TRAITS, VARIETY, jitter } from './traits';
import { Rng, hashString } from './rng';
import { Draw, rasterize, shapeBBox, type SpriteImage } from './raster';
import { makePalette } from './palette';
import { buildTetra } from './buildTetra';
import { buildArthro, buildFlipper, buildFly, buildShell, buildSnake, buildSwim } from './buildOthers';
import type { Feat, Look } from './look';

export interface SpriteSpec {
  /** unique key for caching + seed (genus name, or hybrid name) */
  name: string;
  archetype: string;
  size: SizeClass;
  habitat: Habitat;
  /** ancestor clade names, root first */
  chain: string[];
  /** optional explicit look (hybrids) */
  look?: Look;
}

export const STAGE_NAMES = ['Młode', 'Dorosłe', 'Wzmocnione', 'Elitarne', 'Apeks'] as const;
const TARGET: Record<SizeClass, number> = { XS: 22, S: 30, M: 40, L: 52, XL: 66 };
const STAGE_SCALE = [0.72, 1, 1.04, 1.08, 1.13];
const FEAT_SCALE = [0.45, 1, 1.08, 1.2, 1.32];

const FURRY = new Set(['proboscidean', 'rhino', 'horse', 'brontothere', 'chalicothere', 'entelodont', 'deer', 'ungulate', 'sabertooth', 'carnivoran', 'bear', 'ground_sloth', 'diprotodont', 'ape', 'rodent', 'small_mammal', 'mesonychid', 'cynodont', 'early_whale']);

export function baseLook(spec: SpriteSpec): Look {
  if (spec.look) return structuredClone(spec.look);
  const r = new Rng(spec.name + ':look');
  const L = presetFor(spec.archetype);
  for (const n of spec.chain) CLADE_TRAITS[n]?.(L, r);
  VARIETY[spec.archetype]?.(L, r);
  jitter(L, r, 0.1);
  GENUS_TRAITS[spec.name]?.(L, r);
  return L;
}

function scaleFeat(F: Feat, k: number) {
  const f = F as Record<string, unknown>;
  for (const key of Object.keys(f)) {
    const v = f[key];
    if (typeof v === 'number') f[key] = v * k;
    else if (v && typeof v === 'object' && 's' in (v as object)) (v as { s: number }).s *= k;
  }
}

export function stageLook(base: Look, stage: number): Look {
  const L = structuredClone(base);
  scaleFeat(L.F, FEAT_SCALE[stage]);
  if (stage === 0) {
    if (L.rig === 'tetra') {
      const p = L.P;
      p.headL *= 1.2; p.headH *= 1.3; p.neckL *= 0.85; p.tailL *= 0.85; p.legH *= 0.9; p.foreL *= 0.9; p.bodyL *= 0.9;
    } else if (L.rig === 'swim') L.P.h *= 1.1;
    else if (L.rig === 'fly') L.P.headH *= 1.2;
    L.F.bigEye = 1;
  }
  if (stage >= 3) {
    if (L.rig === 'swim') L.P.dorsal = Math.max(L.P.dorsal, 0.5) * 1.15;
    if (L.rig === 'arthro') L.P.spines += 0.5;
    if (L.rig === 'shell') L.P.keel = Math.max(L.P.keel, 0.8);
  }
  if (stage === 4) {
    if (L.rig === 'tetra') {
      const f = L.F;
      if (!f.browHorns && !f.noseHorn && !f.rhinoHorn && !f.antlers && !f.frill) f.browHorns = 0.55;
      if (!f.crest && !f.dome && !f.frill) f.crest = { type: 'comb', s: 0.8 };
      f.teeth = Math.max(f.teeth ?? 0, 0.8);
    } else if (L.rig === 'swim') {
      L.P.jawBlade = Math.max(L.P.jawBlade, 0.4);
    } else if (L.rig === 'fly') {
      if (!L.F.crest) L.F.crest = { type: 'back', s: 0.8 };
    } else if (L.rig === 'flipper') {
      L.F.teeth = Math.max(L.F.teeth ?? 0, 1);
    }
  }
  return L;
}

export function buildShapes(L: Look, frame: number): Draw {
  const d = new Draw();
  switch (L.rig) {
    case 'tetra': buildTetra(d, L.P, L.F, frame); break;
    case 'swim': buildSwim(d, L.P, L.F, frame); break;
    case 'flipper': buildFlipper(d, L.P, L.F, frame); break;
    case 'fly': buildFly(d, L.P, L.F, frame); break;
    case 'arthro': buildArthro(d, L.P, frame); break;
    case 'shell': buildShell(d, L.P, frame); break;
    case 'snake': buildSnake(d, L.P, frame); break;
  }
  return d;
}

const lookCache = new Map<string, Look>();
const unitCache = new Map<string, number>();

function getBase(spec: SpriteSpec): Look {
  let L = lookCache.get(spec.name);
  if (!L) { L = baseLook(spec); lookCache.set(spec.name, L); }
  return L;
}

function unitFor(spec: SpriteSpec): number {
  let u = unitCache.get(spec.name);
  if (u === undefined) {
    const adult = buildShapes(stageLook(getBase(spec), 1), 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of adult.shapes) {
      const b = shapeBBox(s);
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    u = TARGET[spec.size] / Math.max(x1 - x0, (y1 - y0) * 1.25, 1);
    unitCache.set(spec.name, u);
  }
  return u;
}

export function renderSprite(spec: SpriteSpec, stage: number, frame = 0): SpriteImage {
  const base = getBase(spec);
  const L = stageLook(base, stage);
  const d = buildShapes(L, frame);
  const pal = makePalette(spec.name, {
    habitat: spec.habitat,
    rig: L.rig === 'arthro' ? 'arthropod' : L.rig,
    stage,
    furry: FURRY.has(spec.archetype) || !!L.F.fur,
    feathered: !!L.F.feathers || (L.rig === 'fly' && L.P.kind === 'bird'),
  });
  if (L.F.fur && pal.pattern === 'none') pal.pattern = 'speckle';
  const topView = (L.rig === 'arthro' && L.P.kind !== 'lobopod') || L.rig === 'shell' || (L.rig === 'swim' && L.P.disc);
  return rasterize(d.shapes, pal, {
    scale: unitFor(spec) * STAGE_SCALE[stage],
    pad: 5,
    stage,
    seed: hashString(spec.name),
    spikeEvery: stage >= 3 && !topView ? (stage === 4 ? 3 : 4) : 0,
    spikeHeight: stage === 4 ? 3 : 2,
    glow: stage === 4,
    aura: stage === 4,
    noBelly: topView,
  });
}

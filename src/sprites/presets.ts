// Archetype -> base look. Units ≈ pixels for a medium animal; generator normalizes by size class.

import type { ArthroP, Feat, FlipP, FlyP, Look, SessileKind, ShellP, SnakeP, SwimP, TetraP } from './look';

const TD: TetraP = {
  stance: 'biped', bodyL: 16, bodyH: 10, tilt: 10, legH: 13, legT: 2.6, foreL: 0, foreT: 1.2, armL: 6,
  neckL: 6, neckT: 3, neckA: 40, neckCurve: -8, headL: 9, headH: 5, headA: 5, snout: 0.5,
  tailL: 20, tailT: 3.4, tailA: 5, tailCurve: 5, hump: 0, foot: 'claw',
};
const SD: SwimP = {
  len: 30, h: 9, snout: 0.6, headFrac: 0.25, tail: 'fork', dorsal: 0.7, dorsalPos: 0.45, pectoral: 0.6, pelvic: 0.4,
  flippers: 0, eel: 0, headArmor: 0, jawBlade: 0, whorl: 0, brush: 0, mouth: true, disc: false, tentacles: 0, neck: 0,
};
const FD: FlipP = { bodyL: 18, bodyH: 10, neckL: 10, neckT: 3, neckA: 15, headL: 7, headH: 4, snout: 0.6, tailL: 8, flipL: 12, shell: 0, toes: false };
const YD: FlyP = { kind: 'pterosaur', bodyL: 8, bodyH: 5, wing: 22, neckL: 5, neckA: 30, headL: 10, headH: 3, snout: 0.3, tailL: 1, legL: 4, vane: false, teeth: false };
const AD: ArthroP = { kind: 'trilobite', len: 20, wid: 14, segs: 10, legs: 0, spines: 0.6, claws: 0, telson: 0, antennae: 0, eyes: 1, paddle: 0.5 };

const tetra = (o: Partial<TetraP>, F: Feat = {}): Look => ({ rig: 'tetra', P: { ...TD, ...o }, F });
const quad = (o: Partial<TetraP>, F: Feat = {}): Look => tetra({ stance: 'quad', armL: 0, tilt: 0, foot: 'pad', ...o }, F);
const sprawl = (o: Partial<TetraP>, F: Feat = {}): Look => tetra({ stance: 'sprawl', armL: 0, tilt: 0, neckA: 5, neckCurve: 0, tailA: 0, tailCurve: 2, ...o }, F);
const swim = (o: Partial<SwimP>, F: Feat = {}): Look => ({ rig: 'swim', P: { ...SD, ...o }, F });
const flip = (o: Partial<FlipP>, F: Feat = {}): Look => ({ rig: 'flipper', P: { ...FD, ...o }, F });
const fly = (o: Partial<FlyP>, F: Feat = {}): Look => ({ rig: 'fly', P: { ...YD, ...o }, F });
const arthro = (o: Partial<ArthroP>, F: Feat = {}): Look => ({ rig: 'arthro', P: { ...AD, ...o }, F });
const shell = (o: Partial<ShellP>): Look => ({ rig: 'shell', P: { kind: 'coil', size: 20, ribs: 18, tentacles: 1, keel: 0, len: 30, ...o }, F: {} });
const snake = (o: Partial<SnakeP>): Look => ({ rig: 'snake', P: { len: 40, thick: 3, waves: 1.5, headL: 4, ...o }, F: {} });
const sess = (kind: SessileKind, h: number, w: number, n: number): Look => ({ rig: 'sessile', P: { kind, h, w, n }, F: {} });

export const PRESETS: Record<string, () => Look> = {
  // ---------------- theropods & birds
  theropod_small: () => tetra({ bodyL: 12, bodyH: 8, legH: 11, legT: 2, armL: 5, foreT: 0.9, neckL: 6, neckT: 2.2, neckA: 50, headL: 7, headH: 4, tailL: 18, tailT: 2.5, tilt: 15 }, { teeth: 1 }),
  theropod_large: () => tetra({ bodyL: 20, bodyH: 13, legH: 15, legT: 3.5, armL: 5, foreT: 1.3, neckL: 6, neckT: 4, neckA: 35, headL: 12, headH: 7, snout: 0.6, tailL: 24, tailT: 4.5, tilt: 8 }, { teeth: 1 }),
  spinosaur: () => tetra({ bodyL: 20, bodyH: 12, legH: 12, legT: 3.2, armL: 8, foreT: 1.5, neckL: 7, neckT: 3.4, neckA: 35, headL: 14, headH: 5, snout: 0.35, tailL: 26, tailT: 4 }, { teeth: 1, crest: { type: 'knob', s: 0.6 } }),
  raptor: () => tetra({ bodyL: 11, bodyH: 7, legH: 10, legT: 2, armL: 6.5, foreT: 0.9, neckL: 5, neckT: 2, neckA: 55, headL: 7, headH: 3.6, snout: 0.45, tailL: 18, tailT: 2, tailA: 8, tailCurve: 0 }, { feathers: 1, sickle: 1, teeth: 1 }),
  ornithomimid: () => tetra({ bodyL: 12, bodyH: 9, legH: 15, legT: 2.2, armL: 7, foreT: 0.9, neckL: 10, neckT: 2, neckA: 60, headL: 5, headH: 3, snout: 0.4, tailL: 16, tailT: 2.4 }, { beak: 1, feathers: 0.7 }),
  therizinosaur: () => tetra({ bodyL: 18, bodyH: 14, legH: 13, legT: 3.2, armL: 10, foreT: 1.6, neckL: 9, neckT: 3, neckA: 65, headL: 5, headH: 3.5, snout: 0.5, tailL: 12, tailT: 4, tilt: 30, hump: 0.3 }, { beak: 1, feathers: 1, claws: 1.6 }),
  oviraptor: () => tetra({ bodyL: 10, bodyH: 8, legH: 11, legT: 2, armL: 6, foreT: 0.9, neckL: 7, neckT: 2, neckA: 60, headL: 5, headH: 5, snout: 0.7, tailL: 13, tailT: 2.2 }, { beak: 1.2, crest: { type: 'helmet', s: 0.9 }, feathers: 1 }),
  early_bird: () => fly({ kind: 'bird', bodyL: 7, bodyH: 5, wing: 16, neckL: 3, neckA: 40, headL: 5, headH: 3.2, snout: 0.5, tailL: 9, legL: 4, teeth: true }, { claws: 1 }),
  bird: () => fly({ kind: 'bird', bodyL: 9, bodyH: 6.5, wing: 20, neckL: 4, neckA: 45, headL: 6, headH: 3.8, snout: 0.6, tailL: 5, legL: 5 }),
  terror_bird: () => tetra({ bodyL: 11, bodyH: 9, legH: 14, legT: 2.2, armL: 2, foreT: 1, neckL: 9, neckT: 2.8, neckA: 65, headL: 8, headH: 6, snout: 0.6, tailL: 5, tailT: 2.5, tailA: 15 }, { beak: 1.4, feathers: 0.8 }),
  giant_bird: () => tetra({ bodyL: 14, bodyH: 12, legH: 17, legT: 3, armL: 1, foreT: 0.8, neckL: 13, neckT: 2.5, neckA: 75, headL: 4, headH: 3, snout: 0.6, tailL: 4, tailT: 3, tailA: 10 }, { beak: 1, feathers: 0.6 }),
  diving_bird: () => tetra({ bodyL: 14, bodyH: 7, legH: 6, legT: 1.8, armL: 1, neckL: 9, neckT: 2, neckA: 25, headL: 6, headH: 2.6, snout: 0.4, tailL: 3, tailT: 2, tilt: -5 }, { beak: 1, teeth: 0.6 }),
  // ---------------- sauropodomorphs
  sauropod: () => quad({ bodyL: 22, bodyH: 13, legH: 14, foreL: 14, legT: 3.6, foreT: 3.2, neckL: 26, neckT: 4.2, neckA: 35, neckCurve: -6, headL: 5, headH: 3.2, snout: 0.7, headA: 0, tailL: 30, tailT: 5, tailA: 0, tailCurve: 4, hump: 0.2 }),
  prosauropod: () => tetra({ bodyL: 14, bodyH: 9, legH: 12, legT: 2.6, armL: 6, foreT: 1.3, neckL: 11, neckT: 2.5, neckA: 30, headL: 5, headH: 3.2, snout: 0.6, tailL: 20, tailT: 3, tilt: 12 }),
  // ---------------- ornithischians
  ceratopsid: () => quad({ bodyL: 20, bodyH: 13, legH: 9, foreL: 8, legT: 3.4, foreT: 3, neckL: 3, neckT: 5, neckA: 10, neckCurve: 0, headL: 11, headH: 7, snout: 0.45, headA: -15, tailL: 12, tailT: 4, tailCurve: 8, hump: 0.15 }, { beak: 1, frill: { s: 1, spikes: 0, long: false }, browHorns: 1, noseHorn: 0.5 }),
  small_ceratopsian: () => quad({ bodyL: 11, bodyH: 8, legH: 6, foreL: 5, legT: 2, foreT: 1.6, neckL: 2.5, neckT: 3, neckA: 10, neckCurve: 0, headL: 7, headH: 5, snout: 0.5, headA: -10, tailL: 10, tailT: 2.5, foot: 'claw' }, { beak: 1, frill: { s: 0.6, spikes: 0, long: false } }),
  hadrosaur: () => quad({ bodyL: 20, bodyH: 12, legH: 13, foreL: 9, legT: 3.5, foreT: 2, neckL: 8, neckT: 3.5, neckA: 45, neckCurve: 10, headL: 10, headH: 5, snout: 0.7, headA: -15, tailL: 22, tailT: 4.5, tailCurve: 2 }, { duckbill: 1 }),
  ornithopod: () => tetra({ bodyL: 10, bodyH: 7, legH: 10, legT: 1.8, armL: 4, foreT: 0.9, neckL: 5, neckT: 2, neckA: 45, headL: 5, headH: 3.4, snout: 0.5, tailL: 15, tailT: 2.2 }, { beak: 0.8 }),
  pachycephalosaur: () => tetra({ bodyL: 13, bodyH: 9, legH: 11, legT: 2.4, armL: 4, foreT: 1, neckL: 5, neckT: 2.8, neckA: 40, headL: 6, headH: 5, snout: 0.6, tailL: 16, tailT: 3 }, { dome: 1, beak: 0.6 }),
  ankylosaur: () => quad({ bodyL: 22, bodyH: 11, legH: 6, foreL: 6, legT: 3, foreT: 2.8, neckL: 3, neckT: 4, neckA: 5, neckCurve: 0, headL: 7, headH: 5, snout: 0.7, headA: -5, tailL: 16, tailT: 3.5, tailCurve: 0 }, { armor: 1, club: 1 }),
  stegosaur: () => quad({ bodyL: 20, bodyH: 12, legH: 12, foreL: 8, legT: 3.4, foreT: 2.4, neckL: 6, neckT: 3, neckA: 0, neckCurve: 15, headL: 6, headH: 3.5, snout: 0.6, headA: -20, tailL: 20, tailT: 3.5, tailA: 10, tailCurve: 6 }, { plates: 1, thagomizer: 1 }),
  // ---------------- pterosaurs
  rhamphorhynchoid: () => fly({ bodyL: 7, bodyH: 4.5, wing: 18, neckL: 3, neckA: 30, headL: 7, headH: 2.6, snout: 0.3, tailL: 12, legL: 3, vane: true, teeth: true }),
  pterodactyloid: () => fly({ bodyL: 8, bodyH: 5, wing: 24, neckL: 6, neckA: 35, headL: 12, headH: 3, snout: 0.2, tailL: 1, legL: 4 }, { crest: { type: 'fan', s: 0.8 } }),
  azhdarchid: () => fly({ bodyL: 9, bodyH: 6, wing: 26, neckL: 14, neckA: 50, headL: 14, headH: 4, snout: 0.25, tailL: 1, legL: 7 }, { crest: { type: 'back', s: 0.5 } }),
  // ---------------- marine reptiles
  ichthyosaur: () => swim({ len: 40, h: 13, snout: 0.9, headFrac: 0.25, tail: 'lunate', dorsal: 0.9, dorsalPos: 0.42, pectoral: 0, pelvic: 0, flippers: 0.9 }, { bigEye: 1, teeth: 0.5 }),
  plesiosaur: () => flip({ bodyL: 18, bodyH: 10, neckL: 24, neckT: 2.6, neckA: 25, headL: 6, headH: 3.4, snout: 0.6, tailL: 8, flipL: 14 }, { teeth: 1 }),
  pliosaur: () => flip({ bodyL: 22, bodyH: 12, neckL: 4, neckT: 6, neckA: 5, headL: 14, headH: 7, snout: 0.55, tailL: 8, flipL: 15 }, { teeth: 1.2 }),
  nothosaur: () => flip({ bodyL: 14, bodyH: 7, neckL: 12, neckT: 2.5, neckA: 10, headL: 8, headH: 3.2, snout: 0.4, tailL: 16, flipL: 8 }, { teeth: 1 }),
  placodont: () => flip({ bodyL: 14, bodyH: 10, neckL: 3, neckT: 4, neckA: 5, headL: 6, headH: 4.5, snout: 0.7, tailL: 10, flipL: 7, shell: 0.8 }),
  mosasaur: () => swim({ len: 48, h: 10, snout: 0.75, headFrac: 0.22, tail: 'paddle', dorsal: 0, pectoral: 0, pelvic: 0, flippers: 0.8, eel: 0.4 }, { teeth: 1 }),
  thalattosaur: () => swim({ len: 36, h: 7, snout: 0.8, headFrac: 0.18, tail: 'eel', dorsal: 0, pectoral: 0, pelvic: 0, flippers: 0.6, eel: 0.8 }),
  // ---------------- other reptiles
  crocodile: () => sprawl({ bodyL: 16, bodyH: 7, legH: 3, legT: 1.8, foreT: 1.6, neckL: 2, neckT: 3.5, headL: 12, headH: 4, snout: 0.45, headA: 0, tailL: 22, tailT: 3.5, tailA: -3 }, { armor: 0.6, teeth: 1 }),
  marine_croc: () => swim({ len: 42, h: 8, snout: 0.9, headFrac: 0.22, tail: 'lunate', dorsal: 0, pectoral: 0, pelvic: 0, flippers: 0.5, eel: 0.3 }, { teeth: 1 }),
  land_croc: () => quad({ bodyL: 12, bodyH: 7, legH: 7, foreL: 6, legT: 1.8, foreT: 1.5, neckL: 2, neckT: 2.5, neckA: 5, neckCurve: 0, headL: 8, headH: 4, snout: 0.5, tailL: 14, tailT: 2.5, foot: 'claw' }, { armor: 0.5, teeth: 1 }),
  phytosaur: () => sprawl({ bodyL: 18, bodyH: 7, legH: 3.4, legT: 2, foreT: 1.8, neckL: 2, neckT: 3.5, headL: 15, headH: 4, snout: 0.25, tailL: 22, tailT: 3.5 }, { armor: 0.7, teeth: 1, crest: { type: 'knob', s: 0.6 } }),
  aetosaur: () => sprawl({ bodyL: 16, bodyH: 8, legH: 4, legT: 2, foreT: 1.8, neckL: 2, neckT: 3, headL: 6, headH: 3.5, snout: 0.6, tailL: 18, tailT: 3 }, { armor: 1, shoulderSpikes: 0.6 }),
  rauisuchian: () => quad({ bodyL: 18, bodyH: 11, legH: 11, foreL: 9, legT: 3, foreT: 2.4, neckL: 5, neckT: 4, neckA: 25, neckCurve: 0, headL: 11, headH: 7, snout: 0.6, headA: -5, tailL: 20, tailT: 4, foot: 'claw' }, { teeth: 1, armor: 0.4 }),
  poposaur: () => tetra({ bodyL: 14, bodyH: 9, legH: 13, legT: 2.6, armL: 4, neckL: 6, neckT: 2.8, neckA: 40, headL: 8, headH: 5, tailL: 20, tailT: 3 }, { teeth: 1 }),
  rhynchosaur: () => sprawl({ bodyL: 14, bodyH: 9, legH: 4, legT: 2.2, foreT: 2, neckL: 1.5, neckT: 3.5, headL: 6, headH: 6, snout: 0.7, tailL: 10, tailT: 2.6, hump: 0.2 }, { beak: 1.2 }),
  tanystropheus: () => sprawl({ bodyL: 12, bodyH: 6, legH: 3, legT: 1.5, foreT: 1.3, neckL: 20, neckT: 1.8, neckA: 5, headL: 5, headH: 2.5, snout: 0.5, tailL: 16, tailT: 2.2 }, { teeth: 0.8 }),
  lizard: () => sprawl({ bodyL: 10, bodyH: 5, legH: 2.5, legT: 1.3, foreT: 1.2, neckL: 2, neckT: 2, headL: 5, headH: 3, snout: 0.6, tailL: 14, tailT: 2 }),
  snake: () => snake({}),
  turtle: () => sprawl({ bodyL: 14, bodyH: 8, legH: 3, legT: 2, foreT: 2, neckL: 3, neckT: 2, neckA: 10, headL: 4, headH: 3, snout: 0.7, tailL: 3, tailT: 1.5, foot: 'pad' }, { shellBack: 1.1 }),
  sea_turtle: () => flip({ bodyL: 16, bodyH: 8, neckL: 3, neckT: 2.5, neckA: 5, headL: 4, headH: 3, snout: 0.8, tailL: 2, flipL: 12, shell: 1 }),
  pareiasaur: () => quad({ bodyL: 16, bodyH: 11, legH: 6, foreL: 6, legT: 3, foreT: 3, neckL: 2, neckT: 4, neckA: 5, neckCurve: 0, headL: 6, headH: 5, snout: 0.8, tailL: 6, tailT: 2.5, hump: 0.3 }, { armor: 0.5, cheekHorns: 0.6 }),
  early_reptile: () => sprawl({ bodyL: 9, bodyH: 4.5, legH: 2.5, legT: 1.2, foreT: 1.1, neckL: 2, neckT: 1.8, headL: 4.5, headH: 2.8, snout: 0.6, tailL: 12, tailT: 1.8 }),
  // ---------------- synapsids
  sail_back: () => sprawl({ bodyL: 16, bodyH: 8, legH: 4, legT: 2.2, foreT: 2, neckL: 2.5, neckT: 3, headL: 8, headH: 5, snout: 0.6, tailL: 18, tailT: 2.8 }, { sail: { s: 1.1, type: 'spined' }, teeth: 1 }),
  pelycosaur: () => sprawl({ bodyL: 14, bodyH: 7, legH: 3.5, legT: 2, foreT: 1.8, neckL: 2.5, neckT: 2.6, headL: 8, headH: 4.5, snout: 0.55, tailL: 16, tailT: 2.4 }, { teeth: 1 }),
  caseid: () => sprawl({ bodyL: 18, bodyH: 13, legH: 4, legT: 2.8, foreT: 2.6, neckL: 1.5, neckT: 3, headL: 4, headH: 3.5, snout: 0.9, tailL: 12, tailT: 3, hump: 0.2 }),
  dinocephalian: () => quad({ bodyL: 18, bodyH: 13, legH: 9, foreL: 11, legT: 3.2, foreT: 3.2, neckL: 3, neckT: 5, neckA: 10, neckCurve: 0, headL: 8, headH: 7, snout: 0.7, headA: -5, tailL: 6, tailT: 2.5, hump: 0.4 }, { dome: 0.6 }),
  gorgonopsid: () => quad({ bodyL: 15, bodyH: 9, legH: 9, foreL: 9, legT: 2.4, foreT: 2.2, neckL: 3, neckT: 3.5, neckA: 15, neckCurve: 0, headL: 9, headH: 6, snout: 0.6, tailL: 10, tailT: 2.2, foot: 'claw' }, { sabre: 1 }),
  dicynodont: () => quad({ bodyL: 14, bodyH: 10, legH: 6, foreL: 6, legT: 2.4, foreT: 2.2, neckL: 2, neckT: 4, neckA: 5, neckCurve: 0, headL: 6, headH: 5, snout: 0.8, headA: -10, tailL: 5, tailT: 2, hump: 0.2 }, { beak: 1, tusks: { s: 0.8, mode: 'small' } }),
  cynodont: () => quad({ bodyL: 11, bodyH: 6, legH: 6, foreL: 5.5, legT: 1.6, foreT: 1.4, neckL: 2, neckT: 2.5, neckA: 10, neckCurve: 0, headL: 6, headH: 4, snout: 0.6, tailL: 8, tailT: 1.6, foot: 'claw' }, { ears: 0.3, teeth: 0.8 }),
  // ---------------- mammals
  proboscidean: () => quad({ bodyL: 22, bodyH: 16, legH: 16, foreL: 17, legT: 4, foreT: 4, neckL: 2, neckT: 7, neckA: 0, neckCurve: 0, headL: 9, headH: 9, snout: 0.85, headA: -20, tailL: 6, tailT: 1.2, tailCurve: 30, hump: 0.4 }, { trunk: 1, tusks: { s: 1, mode: 'up' }, ears: 0.8 }),
  rhino: () => quad({ bodyL: 20, bodyH: 13, legH: 10, foreL: 10, legT: 3.2, foreT: 3, neckL: 3, neckT: 5, neckA: 5, neckCurve: 0, headL: 10, headH: 6, snout: 0.75, headA: -15, tailL: 5, tailT: 1.2, tailCurve: 30, hump: 0.3, foot: 'hoof' }, { rhinoHorn: 1, ears: 0.5 }),
  horse: () => quad({ bodyL: 16, bodyH: 9, legH: 13, foreL: 13, legT: 2.2, foreT: 2, neckL: 8, neckT: 3.2, neckA: 50, neckCurve: 5, headL: 8, headH: 4, snout: 0.8, headA: -30, tailL: 10, tailT: 1.8, tailA: -10, tailCurve: 40, foot: 'hoof' }, { ears: 0.6 }),
  brontothere: () => quad({ bodyL: 20, bodyH: 14, legH: 11, foreL: 12, legT: 3.4, foreT: 3.2, neckL: 3, neckT: 5, neckA: 5, neckCurve: 0, headL: 10, headH: 6, snout: 0.75, headA: -15, tailL: 5, tailT: 1.2, tailCurve: 30, hump: 0.6, foot: 'hoof' }, { yHorn: 1, ears: 0.4 }),
  chalicothere: () => quad({ bodyL: 18, bodyH: 12, legH: 10, foreL: 14, legT: 2.8, foreT: 2.6, neckL: 6, neckT: 4, neckA: 40, neckCurve: 5, headL: 8, headH: 5, snout: 0.8, headA: -25, tailL: 4, tailT: 1.2, tailCurve: 30, foot: 'claw' }, { claws: 1.2, ears: 0.5 }),
  entelodont: () => quad({ bodyL: 16, bodyH: 11, legH: 11, foreL: 11, legT: 2.6, foreT: 2.4, neckL: 3, neckT: 4.5, neckA: 5, neckCurve: 0, headL: 11, headH: 6, snout: 0.7, headA: -15, tailL: 6, tailT: 1.2, tailCurve: 30, hump: 0.6, foot: 'hoof' }, { cheekHorns: 0.8, ears: 0.5, teeth: 1 }),
  deer: () => quad({ bodyL: 15, bodyH: 9, legH: 13, foreL: 13, legT: 2, foreT: 1.8, neckL: 7, neckT: 3, neckA: 55, neckCurve: 5, headL: 7, headH: 4, snout: 0.7, headA: -30, tailL: 3, tailT: 1.2, tailA: 20, foot: 'hoof' }, { antlers: 1, ears: 0.6 }),
  ungulate: () => quad({ bodyL: 16, bodyH: 10, legH: 11, foreL: 11, legT: 2.4, foreT: 2.2, neckL: 5, neckT: 3.5, neckA: 40, neckCurve: 5, headL: 8, headH: 4.5, snout: 0.75, headA: -25, tailL: 6, tailT: 1.4, tailCurve: 30, foot: 'hoof' }, { ears: 0.6 }),
  whale: () => swim({ len: 50, h: 13, snout: 0.55, headFrac: 0.25, tail: 'fluke', dorsal: 0.3, dorsalPos: 0.6, pectoral: 0, pelvic: 0, flippers: 0.6 }),
  early_whale: () => quad({ bodyL: 16, bodyH: 8, legH: 6, foreL: 5, legT: 2, foreT: 1.8, neckL: 2, neckT: 3, neckA: 5, neckCurve: 0, headL: 10, headH: 5, snout: 0.45, tailL: 16, tailT: 3 }, { ears: 0.3, teeth: 1 }),
  sirenian: () => swim({ len: 36, h: 13, snout: 0.3, headFrac: 0.2, tail: 'fluke', dorsal: 0, pectoral: 0, pelvic: 0, flippers: 0.6 }),
  sabertooth: () => quad({ bodyL: 15, bodyH: 9, legH: 10, foreL: 10, legT: 2.4, foreT: 2.4, neckL: 3, neckT: 4, neckA: 25, neckCurve: 0, headL: 7, headH: 5, snout: 0.8, headA: 0, tailL: 6, tailT: 1.6, tailCurve: 20 }, { ears: 0.5, sabre: 1 }),
  carnivoran: () => quad({ bodyL: 15, bodyH: 8, legH: 10, foreL: 10, legT: 2.1, foreT: 2, neckL: 4, neckT: 3.5, neckA: 30, neckCurve: 0, headL: 8, headH: 5, snout: 0.6, headA: -5, tailL: 12, tailT: 2, tailA: -5, tailCurve: 20 }, { ears: 0.7, teeth: 1 }),
  bear: () => quad({ bodyL: 18, bodyH: 12, legH: 10, foreL: 11, legT: 3.2, foreT: 3.2, neckL: 3, neckT: 5, neckA: 5, neckCurve: 0, headL: 8, headH: 6, snout: 0.65, headA: -5, tailL: 2, tailT: 1.5, hump: 0.5 }, { ears: 0.5, fur: 0.4 }),
  ground_sloth: () => quad({ bodyL: 20, bodyH: 15, legH: 11, foreL: 10, legT: 4, foreT: 3.6, neckL: 4, neckT: 5, neckA: 30, neckCurve: 0, headL: 7, headH: 5, snout: 0.8, headA: -10, tailL: 12, tailT: 4, tailCurve: 10, hump: 0.3, foot: 'claw' }, { claws: 1.3, fur: 0.6 }),
  glyptodont: () => quad({ bodyL: 20, bodyH: 13, legH: 6, foreL: 6, legT: 3, foreT: 3, neckL: 1.5, neckT: 3.5, neckA: 5, neckCurve: 0, headL: 5, headH: 4, snout: 0.8, headA: -10, tailL: 10, tailT: 3, tailCurve: 4 }, { shellBack: 1.2 }),
  diprotodont: () => quad({ bodyL: 20, bodyH: 13, legH: 9, foreL: 9, legT: 3.4, foreT: 3.2, neckL: 2, neckT: 5, neckA: 5, neckCurve: 0, headL: 9, headH: 6, snout: 0.8, headA: -10, tailL: 3, tailT: 1.5, hump: 0.2 }, { ears: 0.5 }),
  ape: () => quad({ bodyL: 14, bodyH: 13, legH: 9, foreL: 13, legT: 3, foreT: 3, neckL: 2, neckT: 4, neckA: 0, neckCurve: 0, headL: 6, headH: 6, snout: 0.85, headA: 0, tailL: 0.5, tailT: 1, hump: 0.4 }, { ears: 0.3, fur: 0.4 }),
  rodent: () => quad({ bodyL: 10, bodyH: 7, legH: 4, foreL: 4, legT: 1.6, foreT: 1.4, neckL: 1.5, neckT: 3, neckA: 5, neckCurve: 0, headL: 5, headH: 4, snout: 0.7, tailL: 6, tailT: 0.8, tailCurve: 10 }, { ears: 0.6 }),
  small_mammal: () => quad({ bodyL: 9, bodyH: 5, legH: 4, foreL: 4, legT: 1.3, foreT: 1.2, neckL: 1.5, neckT: 2.4, neckA: 5, neckCurve: 0, headL: 5, headH: 3.2, snout: 0.5, tailL: 9, tailT: 0.9, tailCurve: 10 }, { ears: 0.6 }),
  mesonychid: () => quad({ bodyL: 18, bodyH: 10, legH: 11, foreL: 11, legT: 2.6, foreT: 2.4, neckL: 4, neckT: 4, neckA: 25, neckCurve: 0, headL: 13, headH: 6, snout: 0.65, headA: -5, tailL: 14, tailT: 2.4, tailCurve: 15, foot: 'hoof' }, { ears: 0.5, teeth: 1 }),
  // ---------------- early tetrapods
  temnospondyl: () => sprawl({ bodyL: 16, bodyH: 6, legH: 3, legT: 1.8, foreT: 1.6, neckL: 1, neckT: 4, headL: 10, headH: 4, snout: 0.8, tailL: 16, tailT: 3 }, { teeth: 0.8 }),
  diplocaulus: () => sprawl({ bodyL: 12, bodyH: 5, legH: 2.5, legT: 1.3, foreT: 1.2, neckL: 1, neckT: 3, headL: 4, headH: 3, snout: 0.9, tailL: 10, tailT: 2 }, { cheekHorns: 2.4 }),
  early_tetrapod: () => sprawl({ bodyL: 14, bodyH: 6, legH: 3, legT: 1.6, foreT: 1.4, neckL: 1, neckT: 3.5, headL: 8, headH: 4, snout: 0.6, tailL: 16, tailT: 3 }, { teeth: 0.6 }),
  reptiliomorph: () => sprawl({ bodyL: 14, bodyH: 8, legH: 4.5, legT: 2.4, foreT: 2.2, neckL: 1.5, neckT: 3.5, headL: 7, headH: 5, snout: 0.7, tailL: 12, tailT: 2.6 }),
  fishapod: () => swim({ len: 30, h: 7, snout: 0.6, headFrac: 0.25, tail: 'round', dorsal: 0, pectoral: 0, pelvic: 0, flippers: 0.7 }),
  // ---------------- fish
  placoderm: () => swim({ len: 34, h: 12, snout: 0.4, headFrac: 0.3, tail: 'shark', dorsal: 0.6, dorsalPos: 0.5, pectoral: 0.6, pelvic: 0.3, headArmor: 1, jawBlade: 0.7 }),
  shark: () => swim({ len: 40, h: 11, snout: 0.85, headFrac: 0.25, tail: 'shark', dorsal: 1, dorsalPos: 0.42, pectoral: 1, pelvic: 0.5 }, { teeth: 1 }),
  bony_fish: () => swim({ len: 22, h: 9, snout: 0.6, headFrac: 0.25, tail: 'fork', dorsal: 0.7, dorsalPos: 0.45, pectoral: 0.6, pelvic: 0.4 }),
  lobefin: () => swim({ len: 28, h: 9, snout: 0.5, headFrac: 0.25, tail: 'round', dorsal: 0.6, dorsalPos: 0.55, pectoral: 0.8, pelvic: 0.6 }),
  jawless_fish: () => swim({ len: 18, h: 6, snout: 0.3, headFrac: 0.35, tail: 'shark', dorsal: 0.3, dorsalPos: 0.6, pectoral: 0, pelvic: 0, headArmor: 1, mouth: false }),
  // ---------------- invertebrates
  trilobite: () => arthro({ kind: 'trilobite', len: 20, wid: 14, segs: 10, spines: 0.6, paddle: 0.5 }),
  eurypterid: () => arthro({ kind: 'eurypterid', len: 30, wid: 14, segs: 10, telson: 1, claws: 0, paddle: 1 }),
  radiodont: () => arthro({ kind: 'radiodont', len: 34, wid: 18, segs: 9, claws: 1 }),
  cambrian_arthropod: () => arthro({ kind: 'shrimp', len: 16, wid: 9, segs: 7, antennae: 0.8, eyes: 1, telson: 1 }),
  lobopod: () => arthro({ kind: 'lobopod', len: 18, wid: 3, spines: 1 }),
  giant_insect: () => fly({ kind: 'insect', bodyL: 5, bodyH: 3, wing: 22, tailL: 18, headL: 2, headH: 2 }),
  myriapod: () => arthro({ kind: 'myriapod', len: 40, wid: 8, segs: 14 }),
  ammonite: () => shell({ kind: 'coil', size: 20, ribs: 18, tentacles: 1 }),
  orthocone: () => shell({ kind: 'straight', size: 8, len: 34, ribs: 9, tentacles: 1 }),
  belemnite: () => swim({ len: 22, h: 6, snout: 0.2, headFrac: 0.2, tail: 'squid', dorsal: 0, pectoral: 0, pelvic: 0, tentacles: 1, mouth: false }),
  sponge: () => sess('sponge', 22, 14, 7),
  bryozoan: () => sess('branching', 18, 14, 4),
  bivalve: () => sess('bivalve', 14, 20, 12),
  sea_urchin: () => sess('urchin', 16, 18, 11),
  starfish: () => sess('star', 16, 22, 0),
  brittle_star: () => sess('star', 16, 24, 1),
  archaeocyath: () => sess('cup', 20, 14, 0),
  brachiopod: () => sess('brachiopod', 16, 18, 9),
  polyp: () => sess('polyp', 22, 14, 9),
  comb_jelly: () => sess('jelly', 18, 14, 4),
  disc_animal: () => sess('disc', 14, 22, 0),
  crinoid: () => sess('crinoid', 30, 16, 6),
  cystoid: () => sess('globe', 20, 16, 0),
  graptolite: () => sess('graptolite', 22, 14, 2),
  snail: () => sess('snail', 18, 22, 10),
  tube_worm: () => sess('tube', 22, 10, 0),
  worm: () => sess('worm', 8, 26, 0),
  soft_bodied: () => swim({ len: 18, h: 4, snout: 0.5, headFrac: 0.15, tail: 'eel', dorsal: 0, pectoral: 0, pelvic: 0, eel: 1, mouth: false }),
};

export function presetFor(archetype: string): Look {
  return (PRESETS[archetype] ?? PRESETS.soft_bodied)();
}

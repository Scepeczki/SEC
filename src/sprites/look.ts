// Visual parameter model ("look") shared by builders, presets and traits.

export type Stance = 'biped' | 'quad' | 'sprawl';

export interface TetraP {
  stance: Stance;
  bodyL: number; bodyH: number; tilt: number;
  legH: number; legT: number; foreL: number; foreT: number;
  armL: number;
  neckL: number; neckT: number; neckA: number; neckCurve: number;
  headL: number; headH: number; headA: number; snout: number;
  tailL: number; tailT: number; tailA: number; tailCurve: number;
  hump: number; // shoulder hump (0..1)
  foot: 'claw' | 'hoof' | 'pad';
}

export type TailFin = 'fork' | 'shark' | 'lunate' | 'fluke' | 'paddle' | 'round' | 'eel' | 'squid' | 'none';

export interface SwimP {
  len: number; h: number; snout: number; headFrac: number;
  tail: TailFin; dorsal: number; dorsalPos: number; pectoral: number; pelvic: number;
  flippers: number; // limb flippers (ichthyosaur, mosasaur, whale)
  eel: number; // 0..1 elongation of mid body
  headArmor: number; jawBlade: number; whorl: number; brush: number;
  mouth: boolean; disc: boolean; tentacles: number; neck: number;
}

export interface FlipP {
  bodyL: number; bodyH: number; neckL: number; neckT: number; neckA: number;
  headL: number; headH: number; snout: number; tailL: number;
  flipL: number; shell: number; toes: boolean;
}

export type FlyKind = 'pterosaur' | 'bird' | 'insect';
export interface FlyP {
  kind: FlyKind;
  bodyL: number; bodyH: number; wing: number;
  neckL: number; neckA: number; headL: number; headH: number; snout: number;
  tailL: number; legL: number; vane: boolean; teeth: boolean;
}

export type ArthroKind = 'trilobite' | 'eurypterid' | 'radiodont' | 'shrimp' | 'myriapod' | 'lobopod' | 'opabinia' | 'wiwaxia' | 'marrella';
export interface ArthroP {
  kind: ArthroKind;
  len: number; wid: number; segs: number; legs: number;
  spines: number; claws: number; telson: number; antennae: number; eyes: number; paddle: number;
}

export interface ShellP {
  kind: 'coil' | 'straight';
  size: number; ribs: number; tentacles: number; keel: number; len: number;
}

export interface SnakeP { len: number; thick: number; waves: number; headL: number }

export interface Feat {
  crest?: { type: 'double' | 'tube' | 'helmet' | 'fan' | 'back' | 'tall' | 'knob' | 'comb'; s: number };
  browHorns?: number;
  noseHorn?: number;
  cheekHorns?: number;
  frill?: { s: number; spikes: number; long: boolean };
  sail?: { s: number; type: 'spined' | 'hump' | 'tall' | 'crossbar' };
  plates?: number;
  thagomizer?: number;
  armor?: number;
  shoulderSpikes?: number;
  club?: number;
  dome?: number;
  duckbill?: number;
  beak?: number;
  tusks?: { s: number; mode: 'up' | 'down' | 'shovel' | 'small' };
  trunk?: number;
  antlers?: number;
  rhinoHorn?: number;
  yHorn?: number;
  fur?: number;
  feathers?: number;
  claws?: number;
  sabre?: number;
  sickle?: number;
  shellBack?: number;
  tailSpikes?: number;
  neckSpines?: number;
  bigEye?: number;
  ears?: number;
  teeth?: number;
  quills?: number;
  wattle?: number;
}

export type Look =
  | { rig: 'tetra'; P: TetraP; F: Feat }
  | { rig: 'swim'; P: SwimP; F: Feat }
  | { rig: 'flipper'; P: FlipP; F: Feat }
  | { rig: 'fly'; P: FlyP; F: Feat }
  | { rig: 'arthro'; P: ArthroP; F: Feat }
  | { rig: 'shell'; P: ShellP; F: Feat }
  | { rig: 'snake'; P: SnakeP; F: Feat };

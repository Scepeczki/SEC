// Color utilities and per-genus palette generation.

import type { Habitat } from '../data/types';
import { Rng } from './rng';

export type RGBA = [number, number, number, number];

export function hsl(h: number, s: number, l: number, a = 255): RGBA {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), a];
}

export function shade(c: RGBA, f: number): RGBA {
  // f > 0 lighten towards white, f < 0 darken towards black
  if (f >= 0) return [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f, c[3]].map(Math.round) as RGBA;
  const k = 1 + f;
  return [c[0] * k, c[1] * k, c[2] * k, c[3]].map(Math.round) as RGBA;
}

export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [0, 1, 2, 3].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGBA;
}

export type PatternKind = 'none' | 'stripes' | 'spots' | 'saddle' | 'bands' | 'speckle';

export interface Palette {
  body: RGBA;
  belly: RGBA;
  accent: RGBA;
  accent2: RGBA;
  bone: RGBA;
  eye: RGBA;
  outline: RGBA;
  mark: RGBA;
  armor: RGBA;
  shell: RGBA;
  membrane: RGBA;
  glow: RGBA;
  pattern: PatternKind;
  patternScale: number;
}

export interface PaletteOpts {
  habitat: Habitat;
  rig: string;
  stage: number;
  /** mammals with fur get earthier tones */
  furry?: boolean;
  feathered?: boolean;
}

export function makePalette(seed: string, o: PaletteOpts): Palette {
  const r = new Rng(seed + ':pal');
  let h: number, s: number, l: number;
  const marine = o.habitat === 'marine' || o.habitat === 'freshwater';
  if (o.rig === 'arthropod_top' || o.rig === 'arthropod') {
    h = r.pick([20, 28, 35, 12, 200, 40]) + r.r(-8, 8); s = r.r(0.25, 0.5); l = r.r(0.36, 0.5);
  } else if (o.rig === 'shell') {
    h = r.r(25, 45); s = r.r(0.3, 0.5); l = r.r(0.55, 0.68);
  } else if (o.furry) {
    h = r.r(18, 42); s = r.r(0.25, 0.5); l = r.r(0.3, 0.52);
  } else if (marine) {
    h = r.pick([195, 205, 215, 185, 170, 225, 30]) + r.r(-10, 10); s = r.r(0.2, 0.45); l = r.r(0.36, 0.5);
  } else if (o.habitat === 'air') {
    h = r.pick([10, 30, 200, 340, 45, 120, 260]) + r.r(-12, 12); s = r.r(0.3, 0.6); l = r.r(0.42, 0.56);
  } else if (o.feathered) {
    h = r.pick([15, 30, 45, 200, 350, 100, 270]) + r.r(-12, 12); s = r.r(0.35, 0.65); l = r.r(0.38, 0.52);
  } else {
    h = r.pick([30, 45, 60, 80, 100, 120, 20, 10, 150]) + r.r(-12, 12); s = r.r(0.22, 0.5); l = r.r(0.34, 0.5);
  }
  // stage tuning: juveniles paler, enhanced+ more saturated
  if (o.stage === 0) { l += 0.06; s -= 0.05; }
  if (o.stage >= 2) s += 0.12;
  if (o.stage >= 3) l -= 0.03;

  const body = hsl(h, s, l);
  const belly = hsl(h + r.r(-10, 15), s * 0.6, Math.min(0.85, l + r.r(0.18, 0.28)));
  const ah = h + r.pick([150, 180, 200, 30, -40]) + r.r(-15, 15);
  const accent = hsl(ah, r.r(0.45, 0.7), r.r(0.42, 0.55));
  const accent2 = hsl(ah + 40, 0.6, 0.6);
  const glowH = r.pick([180, 160, 50, 300, 90, 20]);
  const patterns: PatternKind[] = ['none', 'stripes', 'spots', 'saddle', 'bands', 'speckle'];
  let pattern = r.pick(patterns);
  if (o.stage === 0 && pattern === 'none') pattern = 'spots';
  return {
    body,
    belly,
    accent,
    accent2,
    bone: hsl(42, 0.35, 0.82),
    eye: [24, 18, 14, 255],
    outline: hsl(h, 0.35, 0.1),
    mark: o.stage >= 2 ? shade(hsl(ah, 0.5, 0.35), -0.1) : shade(body, -0.32),
    armor: shade(hsl(h + 15, s * 0.8, l), -0.22),
    shell: hsl(h + r.r(-20, 20), s * 0.9, Math.min(0.7, l + 0.12)),
    membrane: hsl(ah, 0.3, 0.5),
    glow: hsl(glowH, 0.95, 0.6),
    pattern,
    patternScale: r.r(0.8, 1.4),
  };
}

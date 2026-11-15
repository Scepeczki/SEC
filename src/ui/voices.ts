// Animal voices, synthesised with Web Audio — no recordings. Every genus gets its own voice:
//   1. a voice FAMILY from its body plan (archetype): roar, honk, bellow, trumpet, screech, chirp, croak, bubbles…
//   2. scaled by body SIZE (big animals are lower and slower),
//   3. and a fixed per-genus FINGERPRINT from its id: pitch, timbre (formants), length, number of syllables,
//      roughness and call variant. So two raptors sound related but never the same, and a genus always sounds like itself.
// For extinct animals nobody knows the real sounds; the families follow what their living relatives
// (crocodiles, birds, elephants, whales, frogs…) and their anatomy (crests, size, water) suggest.

import { GENERA } from '../data/db';
import type { Genus, SizeClass } from '../data/types';

export interface VoiceOut { c: BaseAudioContext; out: AudioNode; nb: AudioBuffer }

// ---------------------------------------------------------------- per-genus fingerprint

function hash(n: number, k: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const SIZE_P: Record<SizeClass, number> = { XS: 2.1, S: 1.5, M: 1, L: 0.7, XL: 0.5 };
const SIZE_D: Record<SizeClass, number> = { XS: 0.6, S: 0.8, M: 1, L: 1.25, XL: 1.55 };

interface V {
  o: VoiceOut;
  /** pitch, duration and formant multipliers */
  P: number; D: number; F: number;
  /** 0–1 fixed per genus */
  h: (k: number) => number;
  /** variant pick, 0..n-1, fixed per genus */
  pick: (n: number, k?: number) => number;
  /** small random variation for this one call */
  r: (a: number, b: number) => number;
  /** 0–1 roughness */
  rough: number;
  /** 0 baby … 4 final form: babies are higher */
  stage: number;
  water: boolean;
  g: Genus;
}

// ---------------------------------------------------------------- building blocks

interface ToneOpts {
  t: number; dur: number;
  wave?: OscillatorType;
  /** pitch contour, evenly spread over the duration */
  f: number[];
  gain: number;
  /** [freq, Q, gain] band-pass formants; none = straight through */
  formants?: [number, number, number][];
  /** vibrato [rate Hz, depth as a share of the pitch] */
  vib?: [number, number];
  /** growl: amplitude modulation [rate Hz, depth 0–1] */
  am?: [number, number];
  /** breath/rasp: filtered noise mixed in [gain, centre Hz, Q] */
  noise?: [number, number, number];
  attack?: number;
  release?: number;
  /** low-pass on the result (water, closed mouth) */
  lp?: number;
  /** a sub-octave sine for weight */
  sub?: number;
}

function env(c: BaseAudioContext, t: number, dur: number, peak: number, attack: number, release: number): GainNode {
  const g = c.createGain();
  const a = Math.min(attack, dur * 0.5), rel = Math.min(release, dur - a);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, dur - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tone(v: V, x: ToneOpts): void {
  const { c, out, nb } = v.o;
  const end = x.t + x.dur;
  const stop: AudioScheduledSourceNode[] = [];
  const src = c.createOscillator();
  src.type = x.wave ?? 'sawtooth';
  const fs = x.f.map((f) => Math.max(18, Math.min(16000, f)));
  src.frequency.setValueAtTime(fs[0], x.t);
  fs.forEach((f, i) => { if (i) src.frequency.linearRampToValueAtTime(f, x.t + (x.dur * i) / (fs.length - 1)); });
  stop.push(src);
  if (x.vib) {
    const l = c.createOscillator(); l.frequency.value = x.vib[0];
    const lg = c.createGain(); lg.gain.value = fs[0] * x.vib[1];
    l.connect(lg); lg.connect(src.frequency); stop.push(l);
  }
  const pre = c.createGain();
  src.connect(pre);
  if (x.sub) {
    const s2 = c.createOscillator(); s2.type = 'sine';
    s2.frequency.setValueAtTime(fs[0] / 2, x.t);
    fs.forEach((f, i) => { if (i) s2.frequency.linearRampToValueAtTime(f / 2, x.t + (x.dur * i) / (fs.length - 1)); });
    const sg = c.createGain(); sg.gain.value = x.sub;
    s2.connect(sg); sg.connect(pre); stop.push(s2);
  }
  if (x.noise) {
    const n = c.createBufferSource(); n.buffer = nb; n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = x.noise[1]; bp.Q.value = x.noise[2];
    const ng = c.createGain(); ng.gain.value = x.noise[0] * 2.5;
    n.connect(bp); bp.connect(ng); ng.connect(pre); stop.push(n);
  }
  let shaped: AudioNode = pre;
  if (x.formants?.length) {
    const mix = c.createGain();
    for (const [f, q, g] of x.formants) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(15000, f); bp.Q.value = q;
      const gg = c.createGain(); gg.gain.value = g * Math.sqrt(q) * 1.3;
      pre.connect(bp); bp.connect(gg); gg.connect(mix);
    }
    shaped = mix;
  }
  if (x.lp) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = x.lp; lp.Q.value = 0.7;
    shaped.connect(lp); shaped = lp;
  }
  if (x.am) {
    const am = c.createGain(); am.gain.value = 1 - x.am[1] / 2;
    const l = c.createOscillator(); l.type = 'sine'; l.frequency.value = x.am[0];
    const lg = c.createGain(); lg.gain.value = x.am[1] / 2;
    l.connect(lg); lg.connect(am.gain); stop.push(l);
    shaped.connect(am); shaped = am;
  }
  const e = env(c, x.t, x.dur, x.gain, x.attack ?? 0.03, x.release ?? x.dur * 0.4);
  shaped.connect(e); e.connect(out);
  for (const n of stop) { n.start(x.t); n.stop(end + 0.05); }
}

/** a burst of filtered noise (breath, hiss, splash, click) */
function hiss(v: V, t: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', attack = 0.01, sweepTo?: number): void {
  const { c, out, nb } = v.o;
  const n = c.createBufferSource(); n.buffer = nb; n.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(Math.min(15000, freq), t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.min(15000, sweepTo), t + dur);
  const e = env(c, t, dur, gain * 2.2, attack, dur * 0.6);
  n.connect(f); f.connect(e); e.connect(out);
  n.start(t, Math.random() * 1.2); n.stop(t + dur + 0.05);
}

/** a water bubble: a sine that sweeps up fast */
function bubble(v: V, t: number, f: number, gain: number): void {
  const { c, out } = v.o;
  const o = c.createOscillator(); o.type = 'sine';
  const d = 0.03 + 120 / f / 40;
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + d);
  const e = env(c, t, d, gain, 0.004, d * 0.7);
  o.connect(e); e.connect(out);
  o.start(t); o.stop(t + d + 0.03);
}

/** a short knock / thump (feet, jaws, head-butts) */
function knock(v: V, t: number, f: number, gain: number): void {
  tone(v, { t, dur: 0.12, wave: 'sine', f: [f * 1.6, f], gain, attack: 0.003, release: 0.1 });
  hiss(v, t, 0.04, f * 8, 1.2, gain * 0.25, 'bandpass', 0.002);
}

// ---------------------------------------------------------------- voice families

type Family = (v: V, t: number) => number;

/** large theropods: a growling open-mouth roar, or a closed-mouth boom like a crocodile or an ostrich */
const roar: Family = (v, t) => {
  const { P, D, F } = v;
  if (v.pick(3) === 0) {
    // closed-mouth booming: deep pulses with the mouth shut
    const n = 2 + v.pick(2, 7);
    for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.55 * D, dur: 0.5 * D, wave: 'sawtooth', f: [70 * P, 62 * P], gain: 0.5, lp: 260 * F, sub: 0.8, attack: 0.08, release: 0.3 });
    return n * 0.55 * D + 0.2;
  }
  const dur = v.r(1.1, 1.4) * D;
  const base = 120 * P;
  if (v.h(9) > 0.6) hiss(v, t, 0.3 * D, 500 * F, 0.8, 0.25, 'bandpass', 0.05); // a huff before
  const t2 = t + (v.h(9) > 0.6 ? 0.3 * D : 0);
  tone(v, {
    t: t2, dur, wave: 'sawtooth', f: [base * 0.8, base * 1.1, base, base * 0.75, base * 0.55], gain: 0.55,
    formants: [[380 * F, 2.5, 1], [950 * F, 3.5, 0.6], [2300 * F, 5, 0.22]],
    am: [26 + v.h(10) * 18, 0.45 + v.rough * 0.35], noise: [0.35 + v.rough * 0.3, 800 * F, 0.7], sub: 0.5, attack: 0.12, release: dur * 0.5,
  });
  return t2 - t + dur;
};

/** raptors and small theropods: raspy shrieks and chatter */
const shriek: Family = (v, t) => {
  const { P, D, F } = v;
  const n = 1 + v.pick(3, 3);
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = v.r(0.18, 0.28) * D;
    const f0 = 700 * P * v.r(0.95, 1.05);
    tone(v, { t: at, dur: d, wave: 'sawtooth', f: [f0 * 0.8, f0 * 1.25, f0 * 0.7], gain: 0.4, formants: [[1300 * F, 3, 1], [2700 * F, 4, 0.5]], am: [55, 0.3 + v.rough * 0.3], noise: [0.3, 2000 * F, 1], attack: 0.01, release: d * 0.5 });
    at += d + v.r(0.05, 0.12);
  }
  if (v.pick(2, 4)) for (let i = 0; i < 7; i++) tone(v, { t: at + i * 0.045, dur: 0.03, wave: 'square', f: [1800 * P, 1500 * P], gain: 0.12, lp: 4000, attack: 0.002, release: 0.02 });
  return at - t + 0.35;
};

/** birds and early birds: chirps, trills and whistles */
const chirp: Family = (v, t) => {
  const { P, D } = v;
  const kind = v.pick(3);
  const base = 2600 * Math.min(1.4, P);
  let at = t;
  if (kind === 2) {
    // a trill
    const d = 0.6 * D;
    tone(v, { t, dur: d, wave: 'sine', f: [base, base * 1.1, base * 0.95], gain: 0.3, vib: [22 + v.h(11) * 12, 0.08], attack: 0.02, release: 0.1 });
    return d + 0.1;
  }
  const n = 2 + v.pick(4, 5);
  for (let i = 0; i < n; i++) {
    const d = v.r(0.06, 0.12) * D;
    const up = kind === 0;
    tone(v, { t: at, dur: d, wave: 'sine', f: up ? [base * 0.8, base * 1.3, base] : [base * 1.3, base * 0.85], gain: 0.28, attack: 0.005, release: d * 0.5 });
    at += d + v.r(0.04, 0.09);
  }
  return at - t + 0.05;
};

/** sea birds: honky, nasal calls */
const seabird: Family = (v, t) => {
  const { P, D, F } = v;
  const n = 2 + v.pick(2);
  for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.3 * D, dur: 0.22 * D, wave: 'sawtooth', f: [620 * P, 720 * P, 520 * P], gain: 0.35, formants: [[900 * F, 4, 1], [2200 * F, 6, 0.5]], attack: 0.02, release: 0.1 });
  return n * 0.3 * D + 0.1;
};

/** big flightless birds: a deep boom (cassowary-like) — terror birds add a harsh scream */
const boom: Family = (v, t) => {
  const { P, D, F } = v;
  const n = 2 + v.pick(2);
  for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.42 * D, dur: 0.36 * D, wave: 'triangle', f: [95 * P, 80 * P], gain: 0.55, lp: 400 * F, sub: 0.6, attack: 0.05, release: 0.2 });
  let end = n * 0.42 * D;
  if (v.g.archetype === 'terror_bird') {
    tone(v, { t: t + end, dur: 0.4 * D, wave: 'sawtooth', f: [1100 * P, 1300 * P, 800 * P], gain: 0.35, formants: [[1500 * F, 3, 1], [3000 * F, 4, 0.4]], noise: [0.4, 2500, 1], am: [50, 0.4], attack: 0.01 });
    end += 0.4 * D;
  }
  return end + 0.15;
};

/** hadrosaurs and other ornithopods: a resonant horn through the nasal passages (crests make it deeper and longer) */
const honk: Family = (v, t) => {
  const { P, D, F } = v;
  const crested = /lambeosaur/i.test(v.g.family ?? '') || /^(Parasaurolophus|Corythosaurus|Lambeosaurus|Hypacrosaurus|Olorotitan|Charonosaurus|Tsintaosaurus|Velafrons|Magnapaulia)$/.test(v.g.name);
  const n = crested ? 1 : 1 + v.pick(3, 3);
  const d = (crested ? 1.7 : v.r(0.45, 0.75)) * D;
  const f0 = (crested ? 85 : 140) * P;
  const res = crested ? 230 * F : 420 * F;
  for (let i = 0; i < n; i++) {
    tone(v, {
      t: t + i * (d + 0.12), dur: d, wave: 'sawtooth', f: [f0 * 0.92, f0 * 1.06, f0 * 1.02, f0 * 0.9], gain: 0.5,
      formants: [[res, 9, 1], [res * 2.1, 8, 0.55], [res * 3.4, 7, 0.2]], vib: [5, 0.012], noise: [0.08, res, 2], attack: 0.07, release: d * 0.35,
    });
  }
  return n * (d + 0.12);
};

/** sauropods: a low rumble you feel more than hear, with a hollow honk on top */
const rumble: Family = (v, t) => {
  const { P, D, F } = v;
  const d = v.r(1.6, 2.1) * D;
  tone(v, { t, dur: d, wave: 'sawtooth', f: [85 * P, 95 * P, 80 * P], gain: 0.6, lp: 320 * F, sub: 1, am: [7 + v.h(12) * 4, 0.35], attack: 0.35, release: d * 0.5 });
  hiss(v, t, d * 0.8, 260 * F, 0.6, 0.18, 'lowpass', 0.3);
  if (v.pick(2, 5)) tone(v, { t: t + d * 0.35, dur: d * 0.5, wave: 'sawtooth', f: [190 * P, 210 * P, 170 * P], gain: 0.3, formants: [[350 * F, 6, 1], [800 * F, 6, 0.4]], attack: 0.1 });
  return d + 0.1;
};

/** horned, armoured and plated herbivores (and other big grazers): grunting bellows */
const bellow: Family = (v, t) => {
  const { P, D, F } = v;
  const n = 1 + v.pick(3, 3);
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = v.r(0.4, 0.65) * D;
    const f0 = 150 * P * v.r(0.95, 1.05);
    tone(v, {
      t: at, dur: d, wave: 'sawtooth', f: [f0, f0 * 1.08, f0 * 0.82], gain: 0.5,
      formants: [[420 * F, 3.5, 1], [1150 * F, 4.5, 0.45], [2500 * F, 6, 0.15]], am: [17 + v.h(13) * 10, 0.3 + v.rough * 0.3], noise: [0.22, 500 * F, 0.8], sub: 0.4, attack: 0.05, release: d * 0.5,
    });
    at += d + v.r(0.12, 0.25);
  }
  if (v.g.archetype === 'pachycephalosaur') { knock(v, at, 180, 0.6); knock(v, at + 0.18, 170, 0.5); at += 0.3; }
  return at - t;
};

/** pterosaurs: harsh screeches or a cackle */
const screech: Family = (v, t) => {
  const { P, D, F } = v;
  const cackle = v.pick(2) === 1;
  const n = cackle ? 4 + v.pick(3, 3) : 1 + v.pick(2, 3);
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = (cackle ? 0.09 : v.r(0.3, 0.45)) * D;
    const f0 = 1500 * P;
    tone(v, { t: at, dur: d, wave: 'sawtooth', f: cackle ? [f0, f0 * 0.9] : [f0 * 1.15, f0 * 1.3, f0 * 0.75], gain: 0.38, formants: [[1900 * F, 3, 1], [3400 * F, 4, 0.45]], am: [42, 0.25 + v.rough * 0.4], noise: [0.35, 3000 * F, 0.8], attack: 0.01, release: d * 0.5 });
    at += d + (cackle ? 0.05 : 0.12);
  }
  return at - t + 0.1;
};

/** whales: slow, singing moans — or a train of clicks */
const whale: Family = (v, t) => {
  const { P, D } = v;
  if (v.pick(3) === 2) {
    for (let i = 0; i < 14; i++) hiss(v, t + i * v.r(0.06, 0.11), 0.012, 3500, 1, 0.5, 'bandpass', 0.001);
    return 1.4;
  }
  const d = v.r(2.2, 2.8) * D;
  const f0 = 260 * P;
  const shape = [[f0, f0 * 1.6, f0 * 1.3, f0 * 2], [f0 * 2, f0 * 1.2, f0 * 1.5, f0 * 0.9], [f0, f0 * 0.8, f0 * 1.4, f0 * 1.1]][v.pick(3, 6)];
  tone(v, { t, dur: d, wave: 'sine', f: shape, gain: 0.5, vib: [4, 0.015], attack: 0.4, release: d * 0.4 });
  tone(v, { t, dur: d, wave: 'triangle', f: shape.map((x) => x * 2), gain: 0.15, attack: 0.5, release: d * 0.4 });
  return d + 0.2;
};

/** ichthyosaurs: dolphin-like whistles and click trains */
const dolphin: Family = (v, t) => {
  const { P } = v;
  const f0 = 4200 * Math.min(1.3, P * 1.4);
  const n = 1 + v.pick(2);
  for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.45, dur: 0.38, wave: 'sine', f: [f0 * 0.7, f0 * 1.1, f0 * 0.8, f0 * 1.2], gain: 0.22, attack: 0.02 });
  const at = t + n * 0.45;
  for (let i = 0; i < 10; i++) hiss(v, at + i * 0.035, 0.008, 6000, 1, 0.35, 'bandpass', 0.001);
  return n * 0.45 + 0.45;
};

/** marine reptiles and sea cows: muffled underwater moans, grunts and bubbles */
const seamoan: Family = (v, t) => {
  const { P, D, F } = v;
  const d = v.r(0.9, 1.3) * D;
  const f0 = 170 * P;
  if (v.g.archetype === 'mosasaur' || v.g.archetype === 'pliosaur') {
    tone(v, { t, dur: d, wave: 'sawtooth', f: [f0 * 0.6, f0 * 0.75, f0 * 0.5], gain: 0.6, lp: 700 * F, am: [24, 0.5], sub: 0.7, attack: 0.1 });
  } else if (v.g.archetype === 'sirenian') {
    for (let i = 0; i < 3; i++) tone(v, { t: t + i * 0.22, dur: 0.16, wave: 'sine', f: [2200 * P, 2900 * P, 2400 * P], gain: 0.2, attack: 0.01 });
  } else {
    tone(v, { t, dur: d, wave: 'triangle', f: [f0, f0 * 1.25, f0 * 0.9], gain: 0.5, lp: 900 * F, vib: [3, 0.03], attack: 0.15 });
  }
  for (let i = 0; i < 4 + v.pick(4, 4); i++) bubble(v, t + d * 0.3 + i * v.r(0.05, 0.13), v.r(500, 1100), 0.12);
  return d + 0.3;
};

/** lizards, snakes, turtles and other small reptiles: hisses (some chirp like geckos or grunt) */
const hissing: Family = (v, t) => {
  const { D, F, P } = v;
  const a = v.g.archetype;
  if (a === 'lizard' && v.pick(2) === 1) {
    for (let i = 0; i < 5; i++) tone(v, { t: t + i * 0.09, dur: 0.05, wave: 'square', f: [1700 * P, 1300 * P], gain: 0.12, lp: 3500, attack: 0.003 });
    return 0.55;
  }
  const d = v.r(0.6, 1) * D;
  if (a === 'turtle' || a === 'aetosaur' || a === 'rhynchosaur' || a === 'tanystropheus') tone(v, { t, dur: 0.3 * D, wave: 'sawtooth', f: [110 * P, 90 * P], gain: 0.35, lp: 500, am: [20, 0.4], attack: 0.03 });
  const st = a === 'turtle' || a === 'aetosaur' || a === 'rhynchosaur' ? 0.25 * D : 0;
  hiss(v, t + st, d, (3800 + v.h(14) * 2500) * Math.min(1.2, F), 1.2, 0.45, 'bandpass', 0.06);
  if (a === 'snake') hiss(v, t + st + d * 0.5, d * 0.6, 6000, 1.5, 0.2, 'bandpass', 0.05);
  return st + d + 0.1;
};

/** crocodiles, phytosaurs, early synapsids and other heavy reptiles: low bellow-growls, a splash, a hiss */
const croc: Family = (v, t) => {
  const { P, D, F } = v;
  const d = v.r(0.8, 1.2) * D;
  tone(v, { t, dur: d, wave: 'sawtooth', f: [75 * P, 90 * P, 70 * P], gain: 0.6, formants: [[300 * F, 2.5, 1], [800 * F, 3, 0.4]], am: [19 + v.h(15) * 8, 0.5], sub: 0.8, noise: [0.2, 400, 0.8], attack: 0.08 });
  if (v.water) for (let i = 0; i < 6; i++) bubble(v, t + d * 0.6 + i * 0.05, v.r(400, 900), 0.12);
  if (v.pick(2, 5)) hiss(v, t + d, 0.5 * D, 3500 * F, 1, 0.3, 'bandpass', 0.04);
  return d + 0.55 * D;
};

/** amphibians and early tetrapods: croaks — pulse trains through a throat pouch */
const croak: Family = (v, t) => {
  const { P, D, F } = v;
  const n = 1 + v.pick(3, 3);
  const rate = 14 + v.h(16) * 14;
  const pulses = Math.round(v.r(5, 9));
  let at = t;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < pulses; i++) tone(v, { t: at + i / rate, dur: 0.035, wave: 'sawtooth', f: [260 * P, 210 * P], gain: 0.4, formants: [[550 * F, 4, 1], [1300 * F, 5, 0.4]], attack: 0.003, release: 0.025 });
    at += pulses / rate + v.r(0.15, 0.3) * D;
  }
  return at - t;
};

/** fish, jawless fish, ammonites and other swimmers: bubbles, drumming grunts, a jaw clack */
const fish: Family = (v, t) => {
  const { P, D } = v;
  const a = v.g.archetype;
  let end = 0.4;
  if (a === 'bony_fish' || a === 'lobefin' || (a === 'placoderm' && v.pick(2))) {
    // many fish drum with their swim bladder
    const n = 3 + v.pick(4, 5);
    for (let i = 0; i < n; i++) knock(v, t + i * v.r(0.07, 0.11), 140 * P, 0.4);
    end = n * 0.1;
  } else if (a === 'shark' || a === 'placoderm') {
    hiss(v, t, 0.7 * D, 300, 0.7, 0.4, 'lowpass', 0.2, 1200);
    if (a === 'placoderm') knock(v, t + 0.5, 220, 0.6);
    end = 0.8 * D;
  }
  for (let i = 0; i < 5 + v.pick(5, 5); i++) bubble(v, t + 0.05 + i * v.r(0.06, 0.14), v.r(450, 1300) * Math.min(1.3, P), 0.16);
  return end + 0.6;
};

/** trilobites, sea scorpions, arthropods: clicks and scuttling */
const scuttle: Family = (v, t) => {
  const n = 8 + v.pick(8, 5);
  let at = t;
  for (let i = 0; i < n; i++) {
    hiss(v, at, v.r(0.006, 0.014), v.r(3000, 6500), 2, v.r(0.25, 0.45), 'bandpass', 0.001);
    at += v.r(0.03, 0.1);
  }
  if (v.g.archetype === 'radiodont' || v.g.archetype === 'eurypterid') hiss(v, t, 0.5, 600, 0.8, 0.25, 'lowpass', 0.15, 2000);
  if (v.water) for (let i = 0; i < 3; i++) bubble(v, at + i * 0.08, v.r(600, 1200), 0.1);
  return at - t + 0.25;
};

/** giant insects: a buzz of wings, passing by */
const buzz: Family = (v, t) => {
  const { P, D } = v;
  const d = v.r(1, 1.4) * D;
  const f0 = 130 * P;
  tone(v, { t, dur: d, wave: 'sawtooth', f: [f0, f0 * 1.1, f0 * 0.9], gain: 0.4, formants: [[700, 2, 1], [2200, 3, 0.5]], am: [32, 0.6], attack: 0.2, release: 0.4 });
  return d;
};

/** elephants and their kin: a brassy trumpet, then a rumble */
const trumpet: Family = (v, t) => {
  const { P, D, F } = v;
  const d = v.r(1, 1.3) * D;
  const f0 = 330 * P;
  tone(v, { t, dur: d, wave: 'sawtooth', f: [f0 * 0.7, f0 * 1.15, f0, f0 * 0.85], gain: 0.5, formants: [[750 * F, 3, 1], [1600 * F, 4, 0.7], [3000 * F, 5, 0.3]], vib: [6.5, 0.025], noise: [0.18, 1500 * F, 1], attack: 0.06, release: d * 0.4 });
  tone(v, { t: t + d, dur: 0.9 * D, wave: 'sawtooth', f: [70 * P, 60 * P], gain: 0.35, lp: 250, sub: 1, am: [8, 0.3], attack: 0.15 });
  return d + 0.9 * D;
};

/** horses: a whinny with a fast vibrato, then a snort */
const whinny: Family = (v, t) => {
  const { P, D, F } = v;
  const d = v.r(0.9, 1.2) * D;
  const f0 = 900 * P;
  tone(v, { t, dur: d, wave: 'sawtooth', f: [f0 * 0.8, f0 * 1.2, f0, f0 * 0.7, f0 * 0.5], gain: 0.35, formants: [[1000 * F, 4, 1], [2300 * F, 5, 0.5]], vib: [9 + v.h(17) * 3, 0.07], attack: 0.04 });
  hiss(v, t + d + 0.05, 0.25, 900, 0.8, 0.35, 'bandpass', 0.01);
  return d + 0.35;
};

/** deer and other hoofed animals: bleats or a bugle */
const bleat: Family = (v, t) => {
  const { P, D, F } = v;
  if (v.g.archetype === 'deer' && v.pick(2)) {
    const d = 1.2 * D;
    tone(v, { t, dur: d, wave: 'triangle', f: [700 * P, 1600 * P, 1900 * P, 900 * P], gain: 0.35, vib: [7, 0.02], attack: 0.1 });
    return d + 0.1;
  }
  const n = 1 + v.pick(2, 3);
  for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.55 * D, dur: 0.45 * D, wave: 'sawtooth', f: [420 * P, 520 * P, 380 * P], gain: 0.4, formants: [[750 * F, 4, 1], [1900 * F, 5, 0.5]], vib: [7, 0.05], attack: 0.03 });
  return n * 0.55 * D;
};

/** cats, dogs, bears, sabre-tooths, entelodonts: growls and roars */
const growl: Family = (v, t) => {
  const { P, D, F } = v;
  const a = v.g.archetype;
  if (a === 'entelodont') {
    for (let i = 0; i < 4; i++) tone(v, { t: t + i * 0.2, dur: 0.15, wave: 'sawtooth', f: [180 * P, 140 * P], gain: 0.4, formants: [[500 * F, 3, 1]], noise: [0.4, 600, 1], attack: 0.01 });
    return 0.9;
  }
  const d = v.r(1, 1.4) * D;
  const f0 = 110 * P;
  const roarish = a === 'sabertooth' || (a === 'carnivoran' && v.pick(2));
  tone(v, {
    t, dur: d, wave: 'sawtooth', f: roarish ? [f0, f0 * 1.6, f0 * 1.3, f0 * 0.8] : [f0, f0 * 1.05, f0 * 0.95], gain: 0.55,
    formants: [[520 * F, 3, 1], [1300 * F, 4, 0.5], [2600 * F, 5, 0.15]], am: [roarish ? 22 : 36 + v.h(18) * 10, 0.55], noise: [0.35, 700 * F, 0.8], sub: 0.5, attack: roarish ? 0.08 : 0.15,
  });
  return d + 0.1;
};

/** apes: hoots that speed up, sometimes a scream */
const hoot: Family = (v, t) => {
  const { P, F } = v;
  const n = 4 + v.pick(3, 3);
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = 0.22 - i * 0.02;
    tone(v, { t: at, dur: d, wave: 'triangle', f: [(300 + i * 40) * P, (380 + i * 50) * P], gain: 0.4, formants: [[500 * F, 3, 1], [1000 * F, 4, 0.4]], attack: 0.02 });
    at += d + 0.08 - i * 0.008;
  }
  if (v.pick(2, 5)) { tone(v, { t: at, dur: 0.5, wave: 'sawtooth', f: [900 * P, 1100 * P, 800 * P], gain: 0.35, formants: [[1200 * F, 3, 1], [2800, 4, 0.4]], noise: [0.3, 2000, 1] }); at += 0.5; }
  return at - t;
};

/** rodents, small mammals, cynodonts: squeaks */
const squeak: Family = (v, t) => {
  const { P, D } = v;
  const n = 2 + v.pick(4, 3);
  let at = t;
  for (let i = 0; i < n; i++) {
    const d = v.r(0.04, 0.09) * D;
    const f0 = 3800 * Math.min(1.2, P / 1.6);
    tone(v, { t: at, dur: d, wave: 'sine', f: [f0, f0 * 1.25, f0 * 0.9], gain: 0.25, attack: 0.004 });
    at += d + v.r(0.04, 0.12);
  }
  return at - t;
};

/** oviraptors: soft, bird-like cooing */
const coo: Family = (v, t) => {
  const { P, D } = v;
  const n = 2 + v.pick(3, 3);
  for (let i = 0; i < n; i++) tone(v, { t: t + i * 0.32 * D, dur: 0.26 * D, wave: 'sine', f: [330 * P, 370 * P, 300 * P], gain: 0.45, lp: 900, sub: 0.3, attack: 0.04 });
  return n * 0.32 * D;
};

const FAMILY: Record<string, Family> = {
  theropod_large: roar, spinosaur: croc, rauisuchian: roar,
  theropod_small: shriek, raptor: shriek, poposaur: shriek, oviraptor: coo, ornithomimid: coo,
  early_bird: chirp, bird: chirp, diving_bird: seabird, terror_bird: boom, giant_bird: boom,
  sauropod: rumble, prosauropod: honk, ornithopod: honk, hadrosaur: honk,
  ceratopsid: bellow, small_ceratopsian: bellow, pachycephalosaur: bellow, ankylosaur: bellow, stegosaur: bellow, therizinosaur: bellow,
  rhamphorhynchoid: screech, pterodactyloid: screech, azhdarchid: screech,
  ichthyosaur: dolphin, plesiosaur: seamoan, pliosaur: seamoan, nothosaur: seamoan, placodont: seamoan, mosasaur: seamoan, thalattosaur: seamoan,
  marine_croc: seamoan, sea_turtle: seamoan, sirenian: seamoan, whale: whale, early_whale: seamoan,
  crocodile: croc, land_croc: croc, phytosaur: croc, sail_back: croc, pelycosaur: croc, caseid: bellow, gorgonopsid: growl,
  aetosaur: hissing, rhynchosaur: hissing, tanystropheus: hissing, lizard: hissing, snake: hissing, turtle: hissing, early_reptile: hissing,
  pareiasaur: bellow, dinocephalian: bellow, dicynodont: bellow, cynodont: squeak,
  proboscidean: trumpet, rhino: bellow, horse: whinny, brontothere: bellow, chalicothere: bellow, entelodont: growl, deer: bleat, ungulate: bleat,
  sabertooth: growl, carnivoran: growl, bear: growl, ground_sloth: bellow, glyptodont: bellow, diprotodont: bellow, ape: hoot, rodent: squeak,
  small_mammal: squeak, mesonychid: growl,
  temnospondyl: croak, diplocaulus: croak, early_tetrapod: croak, reptiliomorph: croak, fishapod: croak,
  placoderm: fish, shark: fish, bony_fish: fish, lobefin: fish, jawless_fish: fish,
  ammonite: fish, orthocone: fish, belemnite: fish, soft_bodied: fish,
  trilobite: scuttle, eurypterid: scuttle, radiodont: scuttle, cambrian_arthropod: scuttle, lobopod: scuttle, myriapod: scuttle,
  giant_insect: buzz,
};

/** loudness trim per family (measured offline: every family lands near the same RMS without clipping) */
const FAMILY_GAIN = new Map<Family, number>([
  [scuttle, 2.6], [fish, 1.5], [dolphin, 2.4], [seamoan, 0.65], [rumble, 0.5], [roar, 0.85], [hissing, 1.8], [buzz, 1.6],
  [croc, 1.1], [boom, 0.6], [coo, 0.6], [bellow, 1.25], [honk, 1.2], [croak, 1.2], [trumpet, 0.9], [growl, 1.15], [whale, 0.9],
]);

export const FAMILY_NAMES: Record<string, string> = {};
for (const [k, f] of Object.entries(FAMILY)) FAMILY_NAMES[k] = f === roar ? 'ryk' : f === shriek ? 'skrzek' : f === chirp ? 'świergot' : f === seabird ? 'krzyk' : f === boom ? 'dudnienie' : f === honk ? 'trąbienie grzebieniem' : f === rumble ? 'pomruk' : f === bellow ? 'ryczenie' : f === screech ? 'wrzask' : f === whale ? 'pieśń' : f === dolphin ? 'gwizdy' : f === seamoan ? 'zawodzenie' : f === hissing ? 'syk' : f === croc ? 'bulgot' : f === croak ? 'rechot' : f === fish ? 'bąbelki' : f === scuttle ? 'klikanie' : f === buzz ? 'bzyczenie' : f === trumpet ? 'trąbienie' : f === whinny ? 'rżenie' : f === bleat ? 'beczenie' : f === growl ? 'warczenie' : f === hoot ? 'pohukiwanie' : f === squeak ? 'piski' : f === coo ? 'gruchanie' : 'głos';

// ---------------------------------------------------------------- public

/** schedule a genus's call on any audio context; returns its length in seconds */
export function renderVoice(o: VoiceOut, genusId: number, at: number, opts: { stage?: number; seed?: number } = {}): number {
  const g = GENERA.get(genusId);
  if (!g) return 0;
  const fam = FAMILY[g.archetype] ?? bellow;
  const id = g.id;
  const h = (k: number) => hash(id, k);
  const stage = opts.stage ?? 2;
  const juv = stage <= 0 ? 1.35 : stage === 1 ? 1.15 : 1;
  let seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const v: V = {
    o,
    P: SIZE_P[g.size] * 2 ** ((h(1) - 0.5) * 0.7) * juv,
    D: SIZE_D[g.size] * (0.8 + h(2) * 0.45) / Math.sqrt(juv),
    F: (0.85 + h(3) * 0.3) * (juv > 1 ? 1.12 : 1),
    h,
    pick: (n, k = 4) => Math.floor(h(20 + k) * n),
    r: (a, b) => a + rnd() * (b - a),
    rough: h(5),
    stage,
    water: g.habitat === 'marine' || g.habitat === 'freshwater',
    g,
  };
  const trim = o.c.createGain();
  trim.gain.value = FAMILY_GAIN.get(fam) ?? 1;
  trim.connect(o.out);
  v.o = { ...o, out: trim };
  // underwater animals are heard through the water: muffle them a little
  if (g.habitat === 'marine' && fam !== fish && fam !== scuttle && fam !== dolphin) {
    const lp = o.c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(trim);
    v.o = { ...o, out: lp };
  }
  return fam(v, at);
}

/** which family a genus uses (for the encyclopedia / tooltips) */
export const voiceName = (genusId: number) => FAMILY_NAMES[GENERA.get(genusId)?.archetype ?? ''] ?? 'głos';

// Soft, "ASMR" dig sounds synthesised with Web Audio — no audio files. Everything is short, filtered noise
// (brush strokes, gravel, chips) and gentle bell tones (discoveries). Volume 0 = silent.

import { renderVoice } from './voices';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let voiceBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let volume = 0.6;

function ac(): Ctx | null {
  if (volume <= 0) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume * 0.8;
    // a touch of soft room: short feedback delay through a low-pass
    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = 0.045;
    const fb = ctx.createGain();
    fb.gain.value = 0.18;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(ctx.destination);
    // pink-ish noise buffer, reused by every sound
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2;
    }
    // animal voices: their own bus with a gentle compressor so a roar and a chirp sit at a similar loudness
    voiceBus = ctx.createGain();
    voiceBus.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    voiceBus.connect(comp);
    comp.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume * 0.8;
}
export const getVolume = () => volume;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** a burst of filtered noise */
function noise(c: Ctx, at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', attack = 0.004) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rnd(0.85, 1.15);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f); f.connect(g); g.connect(master!);
  src.start(at, rnd(0, 1.2), dur + 0.05);
}

/** a soft sine/triangle tone with an exponential tail */
function tone(c: Ctx, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', glide = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(master!);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export const sfx = {
  /** brush stroke (soft "shhk") or hammer knock; pitch rises a little with the streak */
  hit(tool: 'brush' | 'hammer', streak = 0, crit = false) {
    const c = ac(); if (!c) return;
    const t = c.currentTime, up = 1 + Math.min(12, streak) * 0.025;
    if (tool === 'hammer') {
      tone(c, t, rnd(85, 105) * up, 0.16, 0.5, 'sine', 0.55);
      noise(c, t, 0.12, rnd(500, 800) * up, 0.8, 0.45, 'lowpass');
      noise(c, t + 0.01, 0.06, rnd(2200, 2800), 2, 0.12);
    } else {
      noise(c, t, rnd(0.07, 0.11), rnd(2600, 3600) * up, 1.1, 0.22, 'bandpass', 0.012);
      noise(c, t, 0.05, rnd(900, 1300) * up, 1.5, 0.18);
      tone(c, t, rnd(180, 220) * up, 0.05, 0.08, 'triangle', 0.7);
    }
    if (crit) { noise(c, t + 0.01, 0.18, 4200, 3, 0.18); tone(c, t + 0.01, 660 * up, 0.12, 0.06, 'triangle', 1.5); }
  },
  /** a tile gives way: a little trickle of gravel */
  crumble(big = false) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) noise(c, t + i * rnd(0.012, 0.03), rnd(0.02, 0.05), rnd(1500, 4200), 2.5, rnd(0.07, 0.16));
    noise(c, t, 0.22, 380, 0.7, big ? 0.22 : 0.14, 'lowpass', 0.01);
  },
  /** first glimpse of a bone: a soft glassy chime, brighter for rarer finds */
  reveal(rarity = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime, base = [523.25, 659.25, 783.99, 987.77][rarity] ?? 523.25;
    tone(c, t, base, 1.1, 0.11);
    tone(c, t + 0.07, base * 1.5, 0.9, 0.06);
    if (rarity >= 2) tone(c, t + 0.14, base * 2, 0.8, 0.05);
  },
  /** a find lifts out of the rock */
  find(kind: 'fossil' | 'minor' | 'amber' | 'mineral', rarity = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const chord = kind === 'fossil' ? [392, 493.88, 587.33, 783.99].slice(0, 3 + Math.min(1, rarity)) : kind === 'minor' ? [659.25, 987.77] : kind === 'amber' ? [440, 554.37, 659.25] : [587.33, 880, 1174.66];
    chord.forEach((f, i) => tone(c, t + i * 0.055, f * (1 + rarity * 0.02), kind === 'minor' ? 0.35 : 0.9, kind === 'minor' ? 0.05 : 0.07, i ? 'sine' : 'triangle'));
    noise(c, t, 0.25, 6000, 0.7, 0.04, 'highpass', 0.02);
  },
  /** the find lands in the stash */
  land() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, t, 1046.5, 0.18, 0.05);
    noise(c, t, 0.05, 2000, 1.5, 0.05);
  },
  /** a layer is cleared */
  layer() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(c, t + i * 0.09, f, 0.9, 0.06));
    noise(c, t, 0.7, 300, 0.6, 0.1, 'lowpass', 0.05);
  },
  /** an epoch chest pops open */
  chest() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, t, 196, 0.25, 0.15, 'triangle', 0.8);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, t + 0.12 + i * 0.07, f, 1, 0.06));
    for (let i = 0; i < 8; i++) tone(c, t + 0.2 + i * 0.05, rnd(1800, 3200), 0.12, 0.025);
  },
  /** fuse hiss before a charge blows */
  fuse() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.9, 5200, 1.2, 0.07, 'bandpass', 0.05);
    for (let i = 0; i < 7; i++) noise(c, t + i * 0.11, 0.03, rnd(3000, 6000), 3, 0.06);
  },
  /** a charge goes off: deep thump + rumble + falling gravel */
  boom(big = false) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, t, 70, 0.6, 0.7, 'sine', 0.4);
    tone(c, t, 45, 0.9, 0.5, 'sine', 0.6);
    noise(c, t, 0.9, 260, 0.6, 0.7, 'lowpass', 0.005);
    noise(c, t, 0.25, 1600, 0.8, 0.35, 'bandpass', 0.003);
    for (let i = 0; i < (big ? 18 : 12); i++) noise(c, t + 0.15 + i * rnd(0.03, 0.06), rnd(0.02, 0.06), rnd(1500, 4500), 2.5, rnd(0.05, 0.12));
  },
  /** a waiting chest rattles */
  chestShake() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) { tone(c, t + i * 0.07, rnd(140, 180), 0.08, 0.12, 'triangle', 0.8); noise(c, t + i * 0.07, 0.05, 1800, 2, 0.06); }
  },
  /** the lid flies open: wooden creak, then a shimmering treasure chord */
  chestOpen(tier = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, t, 220, 0.18, 0.12, 'sawtooth', 0.7);
    noise(c, t, 0.2, 700, 1.2, 0.12);
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].slice(0, 4 + tier);
    chord.forEach((f, i) => tone(c, t + 0.15 + i * 0.06, f, 1.6, 0.07, i % 2 ? 'sine' : 'triangle'));
    tone(c, t + 0.15, 130.81, 1.4, 0.12, 'sine');
    for (let i = 0; i < 14 + tier * 6; i++) tone(c, t + 0.3 + i * 0.04, rnd(2000, 4200), 0.18, 0.025);
  },
  /** one loot item pops out of the chest (k-th in a row; rare 0–3) */
  loot(k: number, rare = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const f = 659.25 * 2 ** ((k * 2) / 12);
    tone(c, t, f, 0.5, 0.07, 'triangle');
    tone(c, t + 0.04, f * 1.5, 0.45, 0.04);
    noise(c, t, 0.06, 3000, 1.5, 0.05);
    if (rare >= 2) [1, 1.25, 1.5, 2].forEach((m, i) => tone(c, t + 0.08 + i * 0.06, f * m, 0.9, 0.05));
    if (rare >= 3) for (let i = 0; i < 10; i++) tone(c, t + 0.2 + i * 0.035, rnd(2400, 4800), 0.2, 0.03);
  },
  /** the golden flash is caught */
  golden() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 6; i++) tone(c, t + i * 0.045, 880 * 2 ** (i / 5), 0.35, 0.05);
  },
  /** quiet tick for UI (buying upgrades) */
  click() {
    const c = ac(); if (!c) return;
    tone(c, c.currentTime, 880, 0.08, 0.05, 'triangle');
  },

  // ---------------------------------------------------------------- park

  /** something is built: a few hammer knocks on wood, a settling thud, a small chime */
  build(big = false) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const n = big ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const at = t + i * rnd(0.09, 0.13);
      tone(c, at, rnd(190, 240), 0.09, 0.22, 'triangle', 0.6);
      noise(c, at, 0.05, rnd(1600, 2400), 2, 0.14);
    }
    const end = t + n * 0.11;
    tone(c, end, 75, 0.3, 0.45, 'sine', 0.6);
    noise(c, end, 0.28, 300, 0.7, 0.3, 'lowpass', 0.005);
    for (let i = 0; i < 6; i++) noise(c, end + 0.05 + i * rnd(0.02, 0.04), 0.03, rnd(1500, 3500), 2.5, 0.06);
    [659.25, 987.77].forEach((f, i) => tone(c, end + 0.12 + i * 0.07, f, 0.5, 0.05));
  },
  /** an upgrade: building noises and a rising fanfare */
  upgrade() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) { tone(c, t + i * 0.08, rnd(200, 260), 0.07, 0.16, 'triangle', 0.6); noise(c, t + i * 0.08, 0.04, 2000, 2, 0.1); }
    [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => tone(c, t + 0.26 + i * 0.07, f, 0.8, 0.06, i % 2 ? 'sine' : 'triangle'));
    noise(c, t + 0.26, 0.5, 6000, 0.7, 0.03, 'highpass', 0.05);
  },
  /** a path tile: gravel under a shovel */
  path() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) noise(c, t + i * rnd(0.01, 0.025), rnd(0.02, 0.04), rnd(1800, 3800), 2.2, rnd(0.05, 0.09));
    noise(c, t, 0.08, 500, 0.8, 0.07, 'lowpass', 0.005);
  },
  /** wild land cleared: rustling leaves, a falling trunk, gravel */
  clear() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.6, 5000, 0.9, 0.12, 'bandpass', 0.08);
    for (let i = 0; i < 10; i++) noise(c, t + i * rnd(0.03, 0.06), 0.04, rnd(3000, 7000), 3, 0.05);
    tone(c, t + 0.45, 70, 0.4, 0.5, 'sine', 0.55);
    noise(c, t + 0.45, 0.4, 350, 0.7, 0.3, 'lowpass', 0.005);
  },
  /** coins out of a building: a little jingle that grows with the amount */
  coins(n = 1) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const k = Math.min(7, 2 + Math.floor(Math.log10(Math.max(1, n))));
    for (let i = 0; i < k; i++) {
      const f = rnd(1900, 2600);
      tone(c, t + i * rnd(0.035, 0.06), f, 0.25, 0.045, 'triangle');
      tone(c, t + i * 0.05 + 0.01, f * 1.5, 0.18, 0.025);
    }
  },
  /** food from a farm: a crate set down, rustle */
  harvest() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, t, 140, 0.12, 0.25, 'triangle', 0.7);
    noise(c, t, 0.1, 900, 1.2, 0.15);
    noise(c, t + 0.06, 0.3, 4200, 1, 0.07, 'bandpass', 0.03);
    tone(c, t + 0.12, 784, 0.3, 0.04);
  },
  /** an animal eats: chomps for meat, crunchy leaves for plants, a splash and a gulp for fish */
  feed(food: 'meat' | 'plants' | 'fish' | 'plankton', times = 1) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const bites = Math.min(6, 2 + times);
    for (let i = 0; i < bites; i++) {
      const at = t + 0.08 + i * rnd(0.13, 0.19);
      if (food === 'meat') { noise(c, at, 0.09, rnd(350, 600), 1.4, 0.32, 'bandpass', 0.006); tone(c, at, rnd(90, 120), 0.08, 0.18, 'sine', 0.6); }
      else if (food === 'plants') { noise(c, at, 0.07, rnd(2500, 4200), 1.6, 0.22, 'bandpass', 0.004); for (let k = 0; k < 3; k++) noise(c, at + k * 0.015, 0.015, rnd(4000, 7000), 3, 0.08); }
      else { noise(c, at, 0.06, rnd(900, 1500), 1.2, 0.18); tone(c, at, rnd(300, 420), 0.07, 0.12, 'sine', 2.2); }
    }
    if (food === 'fish' || food === 'plankton') noise(c, t, 0.25, 1200, 0.6, 0.2, 'bandpass', 0.01);
    const end = t + 0.1 + bites * 0.16;
    tone(c, end, 523.25, 0.4, 0.05, 'triangle'); tone(c, end + 0.07, 783.99, 0.5, 0.05);
  },
  /** an animal evolves */
  evolve() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 12; i++) tone(c, t + i * 0.04, 400 * 2 ** (i / 8), 0.3, 0.04, i % 2 ? 'sine' : 'triangle');
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(c, t + 0.5, f, 1.4, 0.06));
  },
  /** demolition: crack, crash, rubble */
  demolish() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.05, 2500, 1.5, 0.3, 'bandpass', 0.002);
    tone(c, t + 0.04, 60, 0.5, 0.5, 'sine', 0.5);
    noise(c, t + 0.04, 0.6, 400, 0.6, 0.35, 'lowpass', 0.01);
    for (let i = 0; i < 12; i++) noise(c, t + 0.15 + i * rnd(0.03, 0.06), rnd(0.02, 0.05), rnd(1500, 4500), 2.5, rnd(0.04, 0.1));
  },
};

// ---------------------------------------------------------------- animal voices

let lastVoice = 0;
/** play a genus's call (see voices.ts). `gain` 0–1 (quieter from far away on the map). */
export function voice(genusId: number, opts: { stage?: number; gain?: number; delay?: number } = {}): number {
  const c = ac(); if (!c || !voiceBus) return 0;
  const now = c.currentTime;
  if (!opts.delay && now - lastVoice < 0.12) return 0;
  lastVoice = now;
  const g = c.createGain();
  g.gain.value = Math.max(0, Math.min(1, opts.gain ?? 1));
  g.connect(voiceBus);
  const len = renderVoice({ c, out: g, nb: noiseBuf! }, genusId, now + 0.02 + (opts.delay ?? 0), { stage: opts.stage });
  window.setTimeout(() => g.disconnect(), (len + (opts.delay ?? 0) + 1.5) * 1000);
  return len;
}

/** a pen calls: up to three of its animals, one after another and overlapping a little */
export function chorus(animals: { genusId: number; stage?: number }[]): void {
  const pick = [...animals].sort(() => Math.random() - 0.5).slice(0, 3);
  let at = 0;
  pick.forEach((a, i) => {
    const len = voice(a.genusId, { stage: a.stage, delay: at, gain: i ? 0.75 : 1 });
    at += Math.max(0.25, len * 0.55);
  });
}

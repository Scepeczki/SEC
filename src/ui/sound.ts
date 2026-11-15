// Soft, "ASMR" dig sounds synthesised with Web Audio — no audio files. Everything is short, filtered noise
// (brush strokes, gravel, chips) and gentle bell tones (discoveries). Volume 0 = silent.

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
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
};

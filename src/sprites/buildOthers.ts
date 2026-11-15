// Builders for swimmers, flipper-swimmers, fliers, arthropods, shelled cephalopods and snakes.

import { Draw, M, T, type Pt } from './raster';
import type { ArthroP, Feat, FlipP, FlyP, ShellP, SnakeP, SwimP } from './look';
import { P, add, arc, lerp, pol, rad } from './geom';

const PI = Math.PI;

// ------------------------------------------------------------------ swimmers
export function buildSwim(d: Draw, p: SwimP, f: Feat, phase: number): void {
  const L = p.len, H = p.h;
  if (p.disc) {
    d.ell(0, 0, L / 2, H / 2, 0, M.BODY, T.TORSO);
    d.cap(P(-L * 0.45, 0), P(L * 0.42, 0), 0.01, 0.01, M.MOUTH, T.FEATURE);
    const n = 10;
    for (let i = 1; i < n; i++) {
      const x = -L / 2 + (L * i) / n;
      const yy = (H / 2) * Math.sqrt(Math.max(0, 1 - (x / (L / 2)) ** 2)) * 0.95;
      d.cap(P(x, 0), P(x - L * 0.03, -yy), 0.01, 0.01, M.MARK, T.FEATURE);
      d.cap(P(x, 0), P(x - L * 0.03, yy), 0.01, 0.01, M.MARK, T.FEATURE);
    }
    return;
  }
  const hf = p.headFrac;
  const ph = phase ? PI * 0.55 : 0;
  const spine = (t: number): Pt => P(L / 2 - L * t, Math.sin(t * PI * 1.25 + ph) * H * 0.13 * t * t * (1 + p.eel * 1.5));
  const radius = (t: number): number => {
    const tipR = 0.08 + 0.35 * (1 - p.snout);
    let sh: number;
    if (t < hf) sh = tipR + (0.86 - tipR) * Math.sqrt(t / hf);
    else if (t < 0.45) sh = 0.86 + 0.14 * ((t - hf) / Math.max(0.01, 0.45 - hf));
    else sh = 1 - 0.82 * Math.pow((t - 0.45) / 0.55, 1 + p.eel * 1.6);
    return (H / 2) * sh;
  };
  const N = 22;
  const fin = (pts: Pt[], m: number = M.FIN) => d.poly(pts, m, T.FEATURE);
  const E = spine(1);
  const fH = H * 0.95;

  // far flipper behind body
  if (p.flippers) {
    const b = add(spine(0.3), 1, radius(0.3) * 0.5);
    const ang = PI / 2 + rad(55) + (phase ? rad(10) : -rad(10));
    const c = pol(b, ang, H * 0.42 * p.flippers);
    d.ell(c.x, c.y, H * 0.45 * p.flippers, H * 0.15 * p.flippers, ang, M.FAR, T.LIMB);
  }
  // tail fin
  switch (p.tail) {
    case 'fork': fin([add(E, 0.6, 0), add(E, -fH * 0.55, -fH * 0.62), add(E, -fH * 0.22, 0), add(E, -fH * 0.55, fH * 0.62)]); break;
    case 'shark': fin([add(E, 0.6, -0.3), add(E, -fH * 0.75, -fH * 0.95), add(E, -fH * 0.15, 0), add(E, -fH * 0.42, fH * 0.5)]); break;
    case 'lunate': fin([add(E, 0.5, 0), add(E, -fH * 0.32, -fH * 0.92), add(E, -fH * 0.12, -fH * 0.1), add(E, -fH * 0.12, fH * 0.1), add(E, -fH * 0.32, fH * 0.92)]); break;
    case 'fluke': fin([add(E, 0.5, -fH * 0.16), add(E, -fH * 0.75, -fH * 0.14), add(E, -fH * 0.82, 0), add(E, -fH * 0.75, fH * 0.12), add(E, 0.5, fH * 0.16)], M.BODY); break;
    case 'paddle': fin([add(E, 0.6, -0.2), add(E, -fH * 0.62, fH * 0.6), add(E, -fH * 0.25, -fH * 0.3)]); break;
    case 'round': d.ell(E.x - fH * 0.3, E.y, fH * 0.42, fH * 0.48, 0, M.FIN, T.FEATURE); break;
    case 'squid': fin([add(E, 0.8, 0), add(E, -fH * 0.35, -fH * 0.45), add(E, -fH * 0.55, 0), add(E, -fH * 0.35, fH * 0.45)]); break;
    case 'eel': fin([spine(0.6), add(spine(0.8), 0, -radius(0.8) - H * 0.18), add(E, -fH * 0.2, 0), add(spine(0.8), 0, radius(0.8) + H * 0.18), spine(0.6)]); break;
    default: break;
  }
  // dorsal fin (behind body)
  if (p.dorsal) {
    const t = p.dorsalPos;
    const top = add(spine(t), 0, -radius(t) * 0.8);
    if (p.brush) {
      fin([add(top, L * 0.05, 0), add(top, L * 0.05, -H * 0.7), add(top, -L * 0.1, -H * 0.75), add(top, -L * 0.08, 0)], M.ACCENT);
      for (let i = 0; i < 4; i++) d.ell(top.x + L * 0.03 - i * L * 0.04, top.y - H * 0.75, 0.6, 0.6, 0, M.BONE, T.FEATURE);
    } else {
      fin([add(top, L * 0.07, 0.4), add(top, -L * 0.05, -H * 0.6 * p.dorsal), add(top, -L * 0.1, 0.4)]);
    }
  }
  // body
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const tag = t0 < hf ? T.HEAD : t0 > 0.72 ? T.TAIL : T.TORSO;
    d.cap(spine(t0), spine(t1), radius(t0), radius(t1), M.BODY, tag);
  }
  if (p.headArmor) {
    const c = spine(hf * 0.75);
    d.ell(c.x, c.y - radius(hf) * 0.05, L * hf * 0.75, radius(hf) * 1.06 * p.headArmor, 0, M.ARMOR, T.FEATURE);
    d.cap(add(c, -L * hf * 0.4, -radius(hf) * 0.4), add(c, L * hf * 0.3, -radius(hf) * 0.5), 0.01, 0.01, M.MOUTH, T.FEATURE);
  }
  if (p.jawBlade) {
    const tp = spine(0.01);
    fin([add(tp, 0.3, radius(0.02) * 0.4), add(tp, -L * 0.12, radius(0.05) + H * 0.12 * p.jawBlade), add(tp, -L * 0.14, radius(0.05) * 0.3)], M.BONE);
  }
  if (p.whorl) {
    const c = add(spine(0.07), 0, radius(0.07) * 0.7);
    d.ell(c.x, c.y, H * 0.2 * p.whorl, H * 0.2 * p.whorl, 0, M.BONE, T.FEATURE);
    d.ell(c.x, c.y, H * 0.09 * p.whorl, H * 0.09 * p.whorl, 0, M.MOUTH, T.FEATURE);
  }
  // pectoral / pelvic fins
  if (p.pectoral) {
    const b = add(spine(0.28), 0, radius(0.28) * 0.55);
    fin([add(b, L * 0.03, 0), add(b, -H * 0.5 * p.pectoral, H * 0.5 * p.pectoral), add(b, -H * 0.12, 0)]);
  }
  if (p.pelvic) {
    const b = add(spine(0.62), 0, radius(0.62) * 0.6);
    fin([add(b, L * 0.02, 0), add(b, -H * 0.3 * p.pelvic, H * 0.3 * p.pelvic), add(b, -H * 0.1, 0)]);
  }
  if (p.flippers) {
    const b = add(spine(0.3), 0, radius(0.3) * 0.5);
    const ang = PI / 2 + rad(50) + (phase ? -rad(10) : rad(10));
    const c = pol(b, ang, H * 0.42 * p.flippers);
    d.ell(c.x, c.y, H * 0.45 * p.flippers, H * 0.15 * p.flippers, ang, M.BODY, T.LIMB);
    if (p.flippers > 0.6 && p.tail === 'paddle') {
      const b2 = add(spine(0.62), 0, radius(0.62) * 0.5);
      const c2 = pol(b2, ang + rad(10), H * 0.3 * p.flippers);
      d.ell(c2.x, c2.y, H * 0.3 * p.flippers, H * 0.11 * p.flippers, ang, M.BODY, T.LIMB);
    }
  }
  if (p.tentacles) {
    const tp = spine(0);
    for (let i = 0; i < 4; i++) d.chain(arc(tp, rad(-25 + i * 18), L * 0.22 * p.tentacles, 2, rad(10)), H * 0.07, 0.2, M.BODY, T.LIMB);
  }
  // eye + mouth
  const ec = add(spine(hf * 0.42), 0, -radius(hf * 0.42) * 0.3);
  const er = H * 0.065 * (f.bigEye ? 2 : 1);
  d.ell(ec.x, ec.y, er, er, 0, M.EYE, T.FEATURE);
  if (p.mouth) {
    const m1 = add(spine(0.005), 0, radius(0.01) * 0.15);
    const m2 = add(spine(hf * 0.75), 0, radius(hf * 0.75) * 0.3);
    d.cap(m1, m2, 0.01, 0.01, M.MOUTH, T.FEATURE);
    if (f.teeth) for (let i = 0; i < 3; i++) { const q = add(lerp(m1, m2, 0.2 + i * 0.25), 0, 0.6); d.cap(q, add(q, 0, H * 0.06 * f.teeth + 0.3), 0.01, 0.01, M.BONE, T.FEATURE); }
  }
}

// ------------------------------------------------------------------ flipper swimmers
export function buildFlipper(d: Draw, p: FlipP, f: Feat, phase: number): void {
  const rx = p.bodyL / 2, ry = p.bodyH / 2;
  const sw = phase ? rad(12) : -rad(12);
  const flip = (at: Pt, ang: number, len: number, m: number) => {
    const c = pol(at, ang, len * 0.45);
    d.ell(c.x, c.y, len * 0.52, len * 0.16, ang, m, T.LIMB);
  };
  flip(P(rx * 0.35 + 1.2, ry * 0.3 - 0.5), PI / 2 + rad(50) - sw, p.flipL, M.FAR);
  flip(P(-rx * 0.45 + 1.2, ry * 0.3 - 0.5), PI / 2 + rad(60) + sw, p.flipL * 0.85, M.FAR);
  const tail = arc(P(-rx * 0.85, 0), PI + rad(4), p.tailL, 3, -rad(6));
  d.chain(tail, ry * 0.45, 0.3, M.BODY, T.TAIL);
  d.ell(0, 0, rx, ry, 0, M.BODY, T.TORSO);
  if (p.shell) {
    d.ell(0, -ry * 0.25, rx * 1.1, ry * 0.95 * p.shell, 0, M.SHELL, T.FEATURE);
    for (let i = -2; i <= 2; i++) d.ell(i * rx * 0.33, -ry * 0.6, rx * 0.1, ry * 0.12, 0, M.ARMOR, T.FEATURE);
  }
  const neck = arc(P(rx * 0.85, -ry * 0.2), -rad(p.neckA), Math.max(0.1, p.neckL), 4, rad(p.neckA * 0.18));
  d.chain(neck, p.neckT, Math.max(p.headH * 0.42, p.neckT * 0.6), M.BODY, T.NECK);
  const hb = neck[neck.length - 1];
  const ha = rad(4);
  const tip = pol(hb, ha, p.headL);
  d.cap(pol(hb, ha + PI, p.headH * 0.2), tip, p.headH / 2, Math.max(0.3, (p.headH / 2) * p.snout), M.BODY, T.HEAD);
  if (p.headL > p.headH * 1.4) {
    const jc = pol(hb, ha, p.headL * 0.28);
    d.ell(jc.x, jc.y, p.headL * 0.3, p.headH * 0.5, ha, M.BODY, T.HEAD);
  }
  const e = pol(pol(hb, ha, p.headL * 0.26), ha - PI / 2, p.headH * 0.18);
  d.ell(e.x, e.y, p.headH * 0.11, p.headH * 0.11, 0, M.EYE, T.FEATURE);
  if (p.headL > 2.2) {
    const m1 = pol(pol(hb, ha, p.headL * 0.3), ha + PI / 2, p.headH * 0.12);
    const m2 = pol(tip, ha + PI / 2, p.headH * 0.05);
    d.cap(m1, m2, 0.01, 0.01, M.MOUTH, T.FEATURE);
    if (f.teeth) for (let i = 0; i < 4; i++) { const q = add(lerp(m1, m2, 0.15 + i * 0.22), 0, 0.6); d.cap(q, add(q, 0.2, p.headH * 0.14 * f.teeth), 0.01, 0.01, M.BONE, T.FEATURE); }
  }
  flip(P(rx * 0.35, ry * 0.35), PI / 2 + rad(45) + sw, p.flipL, M.BODY);
  flip(P(-rx * 0.45, ry * 0.35), PI / 2 + rad(55) - sw, p.flipL * 0.85, M.BODY);
}

// ------------------------------------------------------------------ fliers
export function buildFly(d: Draw, p: FlyP, f: Feat, phase: number): void {
  const rx = p.bodyL / 2, ry = p.bodyH / 2;
  const W = p.wing;
  const upWing = phase === 0;
  if (p.kind === 'insect') {
    // dragonfly-like, head right
    const wingAng = upWing ? -rad(20) : rad(12);
    for (const [dx, ang, len, m] of [[1, -PI / 2 - rad(10) + wingAng, W, M.MEMBRANE], [-1.5, -PI / 2 - rad(40) + wingAng, W * 0.95, M.MEMBRANE]] as [number, number, number, number][]) {
      const base = P(rx * 0.2 + dx, -ry * 0.6);
      const c = pol(base, ang, len * 0.5);
      d.ell(c.x, c.y, len * 0.5, len * 0.11, ang, m, T.FEATURE);
    }
    const abd = arc(P(-rx * 0.6, 0), PI + rad(3), p.tailL, 5, -rad(2));
    d.chain(abd, ry * 0.55, ry * 0.35, M.BODY, T.TAIL);
    abd.slice(1, -1).forEach((q) => d.cap(add(q, 0, -ry * 0.5), add(q, 0, ry * 0.5), 0.01, 0.01, M.MARK, T.FEATURE));
    d.ell(0, 0, rx, ry, 0, M.BODY, T.TORSO);
    d.ell(rx * 1.1, -ry * 0.1, ry * 0.85, ry * 0.85, 0, M.BODY, T.HEAD);
    d.ell(rx * 1.25, -ry * 0.3, ry * 0.55, ry * 0.55, 0, M.EYE, T.FEATURE);
    for (let i = 0; i < 3; i++) d.cap(P(rx * (0.4 - i * 0.4), ry * 0.6), P(rx * (0.3 - i * 0.5), ry * 2.2), 0.01, 0.01, M.FAR, T.LIMB);
    return;
  }
  const S = P(rx * 0.35, -ry * 0.45);
  const Hp = P(-rx * 0.55, -ry * 0.1);
  const wingPts = (o: Pt): Pt[] => {
    const s = add(S, o.x, o.y), h = add(Hp, o.x, o.y);
    if (upWing) {
      const e = add(s, W * 0.08, -W * 0.24), w = add(e, W * 0.1, -W * 0.1), t = add(w, -W * 0.48, -W * 0.4);
      return [s, e, w, t, lerp(lerp(t, h, 0.45), w, 0.32), h];
    }
    const e = add(s, W * 0.12, W * 0.06), w = add(e, W * 0.14, W * 0.08), t = add(w, -W * 0.42, W * 0.36);
    return [s, e, w, t, lerp(lerp(t, h, 0.45), w, 0.32), h];
  };
  const wingMat = p.kind === 'pterosaur' ? M.MEMBRANE : M.BODY;
  // far wing
  d.poly(wingPts(P(2.2, -1.2)), M.FAR, T.FEATURE);
  // tail
  if (p.tailL > 0.5) {
    const tail = arc(P(-rx * 0.85, 0), PI + rad(5), p.tailL, 4, rad(3));
    d.chain(tail, ry * 0.35, 0.3, M.BODY, T.TAIL);
    const te = tail[tail.length - 1];
    if (p.vane && p.kind === 'pterosaur') d.poly([add(te, 0.5, 0), add(te, -p.tailL * 0.1, -ry * 0.7), add(te, -p.tailL * 0.2, 0), add(te, -p.tailL * 0.1, ry * 0.7)], M.ACCENT, T.FEATURE);
    if (p.kind === 'bird') d.poly([tail[1], add(te, -p.tailL * 0.15, -ry * 0.7), add(te, -p.tailL * 0.2, ry * 0.5)], M.BODY, T.TAIL);
  }
  // legs
  const legEnd = add(Hp, -p.legL * 0.3, p.legL);
  d.cap(add(Hp, 0.5, ry * 0.4), legEnd, ry * 0.25, ry * 0.15, M.FAR, T.LIMB);
  d.cap(add(Hp, 1.5, ry * 0.4), add(legEnd, 1.5, 0), ry * 0.28, ry * 0.18, M.BODY, T.LIMB);
  // body
  d.ell(0, 0, rx, ry, -rad(8), M.BODY, T.TORSO);
  // neck + head
  const neck = arc(P(rx * 0.8, -ry * 0.35), -rad(p.neckA), Math.max(0.1, p.neckL), 2, rad(p.neckA * 0.4));
  d.chain(neck, ry * 0.45, Math.max(p.headH * 0.4, ry * 0.3), M.BODY, T.NECK);
  const hb = neck[neck.length - 1];
  const ha = rad(p.kind === 'pterosaur' ? 12 : 5);
  const tip = pol(hb, ha, p.headL);
  if (p.kind === 'bird') {
    d.ell(hb.x + p.headH * 0.2, hb.y, p.headH * 0.6, p.headH * 0.5, 0, M.BODY, T.HEAD);
    d.cap(pol(hb, ha, p.headH * 0.5), tip, p.headH * 0.28 * Math.max(0.6, p.snout), p.headH * 0.08, M.BONE, T.FEATURE);
    d.cap(tip, add(tip, -0.2, p.headH * 0.25), p.headH * 0.08, 0.05, M.BONE, T.FEATURE);
  } else {
    d.cap(pol(hb, ha + PI, p.headH * 0.25), tip, p.headH / 2, Math.max(0.25, (p.headH / 2) * p.snout), M.BODY, T.HEAD);
  }
  if (f.crest) {
    const hup = ha - PI / 2;
    const H = (t: number, lift: number) => pol(pol(hb, ha, p.headL * t), hup, p.headH * lift);
    if (f.crest.type === 'fan') d.poly([H(0.15, 0.4), pol(H(0, 0.35), ha + PI + rad(15), p.headL * 0.8 * f.crest.s), H(-0.1, 0)], M.ACCENT, T.FEATURE);
    else if (f.crest.type === 'tall') d.poly([H(0.1, 0.4), pol(H(0.25, 0.4), hup - rad(15), p.headH * 2.6 * f.crest.s), H(-0.2, 0.1), H(0.55, 0.3)], M.ACCENT, T.FEATURE);
    else d.poly([H(0.3, 0.4), pol(H(0.45, 0.4), hup, p.headH * 0.9 * f.crest.s), H(0.7, 0.3)], M.ACCENT, T.FEATURE);
  }
  const e = pol(pol(hb, ha, p.kind === 'bird' ? p.headH * 0.15 : p.headL * 0.22), ha - PI / 2, p.headH * 0.15);
  d.ell(e.x, e.y, p.headH * 0.12, p.headH * 0.12, 0, M.EYE, T.FEATURE);
  if (p.teeth) {
    for (let i = 0; i < 4; i++) { const q = pol(pol(hb, ha, p.headL * (0.35 + i * 0.15)), ha + PI / 2, p.headH * 0.2); d.cap(q, add(q, 0, p.headH * 0.2), 0.01, 0.01, M.BONE, T.FEATURE); }
  }
  // near wing
  const wp = wingPts(P(0, 0));
  d.poly(wp, wingMat, p.kind === 'bird' ? T.TORSO : T.FEATURE);
  if (p.kind === 'pterosaur') {
    d.cap(wp[0], wp[1], ry * 0.32, ry * 0.26, M.BODY, T.LIMB);
    d.cap(wp[1], wp[2], ry * 0.26, ry * 0.2, M.BODY, T.LIMB);
    d.cap(wp[2], wp[3], ry * 0.18, 0.05, M.BODY, T.LIMB);
  } else {
    // feather tips along trailing edge
    for (let i = 1; i <= 4; i++) {
      const q = lerp(wp[3], wp[5], i / 6);
      d.cap(q, lerp(q, lerp(wp[1], wp[2], 0.5), 0.35), 0.01, 0.01, M.MARK, T.FEATURE);
    }
    if (f.claws) d.cap(wp[2], add(wp[2], W * 0.08, W * 0.05), 0.3, 0.05, M.BONE, T.FEATURE);
  }
}

// ------------------------------------------------------------------ arthropods (mostly top view, head right)
export function buildArthro(d: Draw, p: ArthroP, phase: number): void {
  const L = p.len, Wd = p.wid;
  const s = phase ? 1 : -1;
  switch (p.kind) {
    case 'trilobite': {
      if (p.spines >= 2) d.cap(P(L * 0.42, 0), P(L * 0.72, 0), Wd * 0.05, Wd * 0.03, M.BODY, T.FEATURE);
      if (p.spines >= 2) for (const yy of [-1, 1]) d.cap(P(L * 0.62, 0), P(L * 0.72, yy * Wd * 0.14), Wd * 0.03, 0.05, M.BODY, T.FEATURE);
      for (const yy of [-1, 1]) d.cap(P(L * 0.12, yy * Wd * 0.46), P(-L * 0.12 - L * 0.22 * p.spines, yy * Wd * (0.55 + 0.05 * p.spines)), Wd * 0.07, 0.05, M.BODY, T.FEATURE);
      d.ell(0, 0, L / 2, Wd / 2, 0, M.BODY, T.TORSO);
      d.ell(L * 0.3, 0, L * 0.22, Wd * 0.52, 0, M.BODY, T.HEAD);
      d.cap(P(L * 0.42, 0), P(-L * 0.42, 0), Wd * 0.16, Wd * 0.08, M.BELLY, T.FEATURE);
      d.ell(L * 0.32, 0, L * 0.12, Wd * 0.17, 0, M.BELLY, T.FEATURE);
      const segs = Math.max(4, p.segs);
      for (let i = 0; i <= segs; i++) {
        const x = L * 0.1 - i * ((L * 0.48) / segs);
        const yy = (Wd / 2) * Math.sqrt(Math.max(0, 1 - (x / (L / 2)) ** 2)) * 0.97;
        d.cap(P(x, -yy), P(x, yy), 0.01, 0.01, M.MARK, T.FEATURE);
        if (p.spines >= 1.5 && i % 2 === 0) for (const sg of [-1, 1]) d.cap(P(x, sg * yy), P(x - L * 0.06, sg * (yy + Wd * 0.12)), 0.3, 0.05, M.BODY, T.FEATURE);
      }
      d.ell(-L * 0.38, 0, L * 0.12, Wd * (0.25 + 0.1 * p.paddle), 0, M.BODY, T.TAIL);
      for (const yy of [-1, 1]) d.ell(L * 0.28, yy * Wd * 0.27, L * 0.045, Wd * 0.07, 0, M.EYE, T.FEATURE);
      return;
    }
    case 'eurypterid': {
      // telson
      if (p.telson >= 1) d.poly([P(-L * 0.42, -Wd * 0.05), P(-L * 0.42 - L * 0.28 * p.telson, 0), P(-L * 0.42, Wd * 0.05)], M.BODY, T.TAIL);
      if (p.paddle > 1.2) d.ell(-L * 0.52, 0, L * 0.1, Wd * 0.22, 0, M.BODY, T.TAIL);
      // swimming paddles
      for (const yy of [-1, 1]) {
        const a = P(L * 0.2, yy * Wd * 0.3);
        const b = add(a, -L * 0.18, yy * Wd * (0.55 + s * 0.08 * yy));
        d.cap(a, b, Wd * 0.05, Wd * 0.04, M.FAR, T.LIMB);
        d.ell(b.x - L * 0.04, b.y, L * 0.09, Wd * 0.1, 0, M.FAR, T.LIMB);
        for (let k = 0; k < 3; k++) d.cap(P(L * (0.32 + k * 0.05), yy * Wd * 0.25), P(L * (0.4 + k * 0.08), yy * Wd * 0.55), 0.01, 0.01, M.FAR, T.LIMB);
      }
      if (p.claws) for (const yy of [-1, 1]) {
        const a = P(L * 0.42, yy * Wd * 0.1);
        const b = add(a, L * 0.22 * p.claws, yy * Wd * 0.18);
        d.cap(a, b, Wd * 0.05, Wd * 0.05, M.BODY, T.LIMB);
        d.cap(b, add(b, L * 0.1 * p.claws, -yy * Wd * 0.1), Wd * 0.06, 0.05, M.BONE, T.FEATURE);
      }
      const n = Math.max(6, p.segs);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        d.ell(L * 0.05 - t * L * 0.45, 0, L * 0.06, Wd * (0.45 - 0.33 * t * t), 0, M.BODY, T.TORSO);
        d.cap(P(L * 0.05 - t * L * 0.45 - L * 0.04, -Wd * (0.42 - 0.33 * t * t)), P(L * 0.05 - t * L * 0.45 - L * 0.04, Wd * (0.42 - 0.33 * t * t)), 0.01, 0.01, M.MARK, T.FEATURE);
      }
      d.ell(L * 0.28, 0, L * 0.16, Wd * 0.38, 0, M.BODY, T.HEAD);
      for (const yy of [-1, 1]) d.ell(L * 0.33, yy * Wd * 0.2, L * 0.03, Wd * 0.06, 0, M.EYE, T.FEATURE);
      return;
    }
    case 'radiodont':
    case 'opabinia': {
      // tail fan
      for (const yy of [-1, 1]) for (let k = 0; k < 3; k++) d.ell(-L * 0.45 - k * L * 0.02, yy * Wd * (0.15 + k * 0.08), L * 0.1, Wd * 0.06, yy * rad(25 + k * 12), M.FIN, T.FEATURE);
      // lateral flaps
      const n = Math.max(6, p.segs);
      for (let i = 0; i < n; i++) {
        const x = L * 0.2 - (i / (n - 1)) * L * 0.6;
        const w = Wd * (0.42 - 0.2 * (i / n)) + (i % 2 === (phase ? 0 : 1) ? Wd * 0.05 : 0);
        for (const yy of [-1, 1]) d.ell(x, yy * w * 0.7, L * 0.07, w * 0.45, yy * rad(-20), M.FIN, T.LIMB);
      }
      d.ell(-L * 0.05, 0, L * 0.4, Wd * 0.22, 0, M.BODY, T.TORSO);
      d.ell(L * 0.32, 0, L * 0.12, Wd * 0.2, 0, M.BODY, T.HEAD);
      if (p.kind === 'opabinia') {
        d.cap(P(L * 0.42, 0), P(L * 0.75, 0), Wd * 0.04, Wd * 0.03, M.BODY, T.LIMB);
        for (const yy of [-1, 1]) d.cap(P(L * 0.75, 0), P(L * 0.82, yy * Wd * 0.08), 0.3, 0.05, M.BONE, T.FEATURE);
        for (let k = 0; k < 5; k++) d.ell(L * (0.3 + (k % 3) * 0.04), (k - 2) * Wd * 0.09, 0.7, 0.7, 0, M.EYE, T.FEATURE);
      } else {
        for (const yy of [-1, 1]) {
          const pts = arc(P(L * 0.4, yy * Wd * 0.08), yy * rad(15), L * 0.32 * Math.max(0.6, p.claws), 4, yy * rad(38));
          d.chain(pts, Wd * 0.07, Wd * 0.04, M.ACCENT, T.LIMB);
          pts.slice(1).forEach((q) => d.cap(q, add(q, 0, yy * Wd * 0.06), 0.01, 0.01, M.BONE, T.FEATURE));
          d.cap(P(L * 0.36, yy * Wd * 0.15), P(L * 0.36, yy * Wd * 0.3), 0.3, 0.3, M.BODY, T.LIMB);
          d.ell(L * 0.36, yy * Wd * 0.32, Wd * 0.08, Wd * 0.08, 0, M.EYE, T.FEATURE);
        }
      }
      return;
    }
    case 'myriapod': {
      const n = Math.max(8, p.segs);
      for (let i = 0; i < n; i++) {
        const x = L / 2 - (i + 0.5) * (L / n);
        for (const yy of [-1, 1]) d.cap(P(x, yy * Wd * 0.35), P(x + (i % 2 === phase ? 1 : -1) * 0.6, yy * Wd * 0.68), 0.01, 0.01, M.FAR, T.LIMB);
      }
      for (let i = 0; i < n; i++) {
        const x = L / 2 - (i + 0.5) * (L / n);
        d.ell(x, 0, (L / n) * 0.62, Wd * 0.42, 0, i === 0 ? M.BODY : M.BODY, i === 0 ? T.HEAD : T.TORSO);
        d.cap(P(x - (L / n) * 0.5, -Wd * 0.38), P(x - (L / n) * 0.5, Wd * 0.38), 0.01, 0.01, M.MARK, T.FEATURE);
      }
      for (const yy of [-1, 1]) d.cap(P(L * 0.46, yy * Wd * 0.1), P(L * 0.62, yy * Wd * 0.35), 0.01, 0.01, M.BODY, T.LIMB);
      return;
    }
    case 'lobopod': {
      // side view worm with legs and back spines
      const pts = arc(P(-L / 2, 0), 0, L, 6, 0).map((q, i) => add(q, 0, Math.sin(i + phase) * 0.4));
      for (let i = 1; i < 7; i++) {
        const q = pts[i];
        d.cap(q, add(q, (i % 2 === phase ? 0.5 : -0.5), Wd * 1.0), 0.3, 0.25, M.BODY, T.LIMB);
        d.cap(q, add(q, -0.5, -Wd * 1.2 * Math.max(0.5, p.spines)), 0.3, 0.05, M.BONE, T.FEATURE);
      }
      d.chain(pts, Wd * 0.3, Wd * 0.2, M.BODY, T.TORSO);
      d.ell(pts[6].x + 0.5, pts[6].y, Wd * 0.38, Wd * 0.32, 0, M.BODY, T.HEAD);
      return;
    }
    case 'wiwaxia': {
      for (let i = 0; i < 7; i++) {
        const x = -L * 0.35 + i * L * 0.11;
        for (const yy of [-1, 1]) d.cap(P(x, yy * Wd * 0.2), P(x - L * 0.08, yy * Wd * 0.9 * Math.max(0.6, p.spines)), 0.35, 0.05, M.BONE, T.FEATURE);
      }
      d.ell(0, 0, L / 2, Wd / 2, 0, M.BODY, T.TORSO);
      for (let i = 0; i < 6; i++) for (let j = -1; j <= 1; j++) d.ell(-L * 0.35 + i * L * 0.14, j * Wd * 0.22, L * 0.05, Wd * 0.08, rad(30), M.ARMOR, T.FEATURE);
      return;
    }
    case 'marrella':
    case 'shrimp':
    default: {
      // tail segments
      const n = Math.max(5, p.segs);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        for (const yy of [-1, 1]) d.cap(P(L * 0.1 - t * L * 0.5, yy * Wd * 0.2), P(L * 0.1 - t * L * 0.5 + (i % 2 === phase ? 0.4 : -0.4), yy * Wd * 0.5), 0.01, 0.01, M.FAR, T.LIMB);
        d.ell(L * 0.1 - t * L * 0.5, 0, L * 0.07, Wd * (0.32 - 0.18 * t), 0, M.BODY, T.TORSO);
      }
      if (p.kind === 'marrella') for (const yy of [-1, 1]) d.chain(arc(P(L * 0.25, yy * Wd * 0.15), PI - yy * rad(20), L * 0.55, 3, yy * rad(-8)), Wd * 0.08, 0.2, M.ACCENT, T.FEATURE);
      d.ell(L * 0.22, 0, L * 0.2, Wd * 0.4, 0, M.BODY, T.HEAD);
      for (const yy of [-1, 1]) d.chain(arc(P(L * 0.38, yy * Wd * 0.1), yy * rad(18), L * 0.38 * Math.max(0.5, p.antennae), 3, yy * rad(12)), 0.3, 0.1, M.BODY, T.LIMB);
      if (p.eyes) for (const yy of [-1, 1]) d.ell(L * 0.33, yy * Wd * 0.2, 0.7, 0.7, 0, M.EYE, T.FEATURE);
      if (p.telson) d.poly([P(-L * 0.42, -Wd * 0.12), P(-L * 0.6, 0), P(-L * 0.42, Wd * 0.12)], M.FIN, T.FEATURE);
      return;
    }
  }
}

// ------------------------------------------------------------------ shelled cephalopods
export function buildShell(d: Draw, p: ShellP, phase: number): void {
  if (p.kind === 'coil') {
    const R = p.size / 2;
    for (let i = 0; i < 4; i++) d.chain(arc(P(R * 0.75, R * 0.3), rad(10 + i * 18), R * 0.65 * p.tentacles, 3, rad(14 + (phase ? 6 : 0))), R * 0.1, 0.25, M.BODY, T.LIMB);
    d.ell(R * 0.82, R * 0.22, R * 0.28, R * 0.3, 0, M.BODY, T.HEAD);
    d.ell(R * 0.9, R * 0.08, R * 0.07, R * 0.07, 0, M.EYE, T.FEATURE);
    d.ell(0, 0, R, R, 0, M.SHELL, T.FEATURE);
    if (p.keel) for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * PI; d.ell(Math.cos(a) * R, Math.sin(a) * R, R * 0.07 * p.keel, R * 0.07 * p.keel, 0, M.BONE, T.FEATURE); }
    for (let k = 0; k < p.ribs; k++) {
      const a = (k / p.ribs) * 2 * PI;
      d.cap(P(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42), P(Math.cos(a + 0.15) * R * 0.97, Math.sin(a + 0.15) * R * 0.97), 0.01, 0.01, M.ARMOR, T.FEATURE);
    }
    d.ell(0, 0, R * 0.42, R * 0.42, 0, M.ARMOR, T.FEATURE);
    d.ell(0, 0, R * 0.3, R * 0.3, 0, M.SHELL, T.FEATURE);
    d.ell(0, 0, R * 0.12, R * 0.12, 0, M.ARMOR, T.FEATURE);
    return;
  }
  const L = p.len, R = p.size / 2;
  for (let i = 0; i < 5; i++) d.chain(arc(P(L / 2 + R * 0.2, R * 0.1), rad(-30 + i * 15), R * 1.6 * p.tentacles, 3, rad(phase ? 8 : -4)), R * 0.14, 0.25, M.BODY, T.LIMB);
  d.ell(L / 2 + R * 0.1, 0, R * 0.55, R * 0.8, 0, M.BODY, T.HEAD);
  d.ell(L / 2 + R * 0.3, -R * 0.3, R * 0.15, R * 0.15, 0, M.EYE, T.FEATURE);
  d.cap(P(-L / 2, 0), P(L / 2 - R * 0.2, 0), 0.4, R, M.SHELL, T.FEATURE);
  for (let i = 1; i < p.ribs; i++) {
    const x = -L / 2 + (L * i) / p.ribs;
    const r = 0.4 + (R - 0.4) * (i / p.ribs);
    d.cap(P(x, -r * 0.95), P(x, r * 0.95), 0.01, 0.01, M.ARMOR, T.FEATURE);
  }
}

// ------------------------------------------------------------------ snakes
export function buildSnake(d: Draw, p: SnakeP, phase: number): void {
  const n = 18;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(P(-p.len / 2 + p.len * t, Math.sin(t * PI * 2 * p.waves + (phase ? PI / 2 : 0)) * p.thick * 1.1 * (0.3 + 0.7 * (1 - t * 0.6))));
  }
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const r = p.thick * (0.15 + 0.85 * Math.sin(PI * Math.min(1, t * 1.15 + 0.05)) ** 0.6);
    const r2 = p.thick * (0.15 + 0.85 * Math.sin(PI * Math.min(1, (t + 1 / n) * 1.15 + 0.05)) ** 0.6);
    d.cap(pts[i], pts[i + 1], r, r2, M.BODY, t > 0.85 ? T.NECK : T.TORSO);
  }
  const hp = pts[n];
  d.ell(hp.x + p.headL * 0.4, hp.y, p.headL * 0.6, p.thick * 0.75, 0, M.BODY, T.HEAD);
  d.ell(hp.x + p.headL * 0.55, hp.y - p.thick * 0.3, p.thick * 0.18, p.thick * 0.18, 0, M.EYE, T.FEATURE);
  const tq = P(hp.x + p.headL, hp.y + p.thick * 0.1);
  d.cap(tq, add(tq, p.headL * 0.45, 0), 0.01, 0.01, M.ACCENT, T.FEATURE);
}

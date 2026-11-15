// Builder for walking animals: bipeds, quadrupeds, sprawlers (dinosaurs, mammals, crocs, synapsids…)

import { Draw, M, T, type Pt } from './raster';
import type { Feat, TetraP } from './look';
import { P, add, arc, lerp, pol, rad } from './geom';

const PI = Math.PI;

export function buildTetra(d: Draw, p: TetraP, f: Feat, phase: number): void {
  const rx = p.bodyL / 2, ry = p.bodyH / 2;
  let tiltDeg = p.tilt;
  if (p.stance === 'quad') tiltDeg = (Math.atan2(p.foreL - p.legH, 1.05 * rx) * 180) / PI + p.tilt;
  const a = -rad(tiltDeg);
  const ca = Math.cos(a), sa = Math.sin(a);
  let cy = 0;
  const B = (u: number, v: number): Pt => ({ x: u * ca - v * sa, y: cy + u * sa + v * ca });
  cy = -p.legH - B(-rx * 0.5, ry * 0.3).y;
  if (p.stance === 'sprawl') cy = Math.min(cy, -ry * 0.95 - 0.4);
  const up = a - PI / 2; // body "up" direction
  const s = phase ? 1 : -1;
  const swing = (p.stance === 'biped' ? 0.2 : 0.13) * p.legH * s;

  // ---------- key points
  const hip = B(-rx * 0.5, ry * 0.3);
  const sh = B(rx * 0.55, ry * 0.3);
  const neckBase = B(rx * 0.82, -ry * 0.3);
  const neckPts = p.neckL > 0.5 ? arc(neckBase, -rad(p.neckA), p.neckL, 3, rad(p.neckCurve)) : [neckBase];
  const hb = neckPts[neckPts.length - 1];
  const ha = -rad(p.headA);
  const hup = ha - PI / 2;
  const hdn = ha + PI / 2;
  const tip = pol(hb, ha, p.headL);
  const tailBase = B(-rx * 0.85, -ry * 0.1);
  const tailPts = arc(tailBase, PI + rad(p.tailA) + rad(3 * s), p.tailL, 4, -rad(p.tailCurve));
  const tailEnd = tailPts[tailPts.length - 1];
  const H = (t: number, lift: number) => pol(pol(hb, ha, p.headL * t), hup, p.headH * lift);

  // ---------- legs
  const leg = (top: Pt, th: number, sw: number, kind: 'bip' | 'quadH' | 'quadF' | 'spr', m: number) => {
    const fx = top.x + sw;
    if (kind === 'bip') {
      const len = -top.y;
      const K = P(top.x + len * 0.22 + sw * 0.4, top.y + len * 0.45);
      const A = P(fx - len * 0.08, -len * 0.17);
      d.cap(top, K, th, th * 0.72, m, T.LIMB);
      d.cap(K, A, th * 0.62, th * 0.42, m, T.LIMB);
      d.cap(A, P(fx + len * 0.2, -th * 0.3), th * 0.42, th * 0.28, m, T.LIMB);
      if (f.sickle && m === M.BODY) d.cap(P(fx + len * 0.04, -th * 0.5), P(fx + len * 0.09, -th * 1.7), th * 0.22, 0.05, M.BONE, T.FEATURE);
    } else if (kind === 'spr') {
      const len = Math.max(1, -top.y);
      const K = P(top.x - len * 0.35 + sw * 0.4, top.y + len * 0.5);
      const F0 = P(fx + len * 0.05, -th * 0.45);
      d.cap(top, K, th, th * 0.8, m, T.LIMB);
      d.cap(K, F0, th * 0.75, th * 0.55, m, T.LIMB);
      d.cap(F0, P(F0.x + th * 1.4, -th * 0.3), th * 0.45, th * 0.3, m, T.LIMB);
    } else {
      const len = -top.y;
      const k = kind === 'quadH' ? 1 : -1;
      const K = P(top.x + k * len * 0.08 + sw * 0.4, top.y + len * 0.5);
      const F0 = P(fx, -th * 0.5);
      d.cap(top, K, th, th * 0.8, m, T.LIMB);
      d.cap(K, F0, th * 0.78, th * 0.6, m, T.LIMB);
      if (p.foot === 'hoof') d.ell(fx, -th * 0.4, th * 0.62, th * 0.42, 0, m === M.FAR ? M.FAR : M.MOUTH, T.LIMB);
      else if (p.foot === 'pad') d.ell(fx + th * 0.2, -th * 0.38, th * 0.8, th * 0.42, 0, m, T.LIMB);
      else d.ell(fx + th * 0.45, -th * 0.35, th * 0.85, th * 0.35, 0, m, T.LIMB);
    }
  };
  const arm = (top: Pt, m: number, sw: number) => {
    const el = add(top, p.armL * 0.25 + sw * 0.1, p.armL * 0.5);
    const hd = add(el, p.armL * 0.5, p.armL * 0.05);
    d.cap(top, el, p.foreT, p.foreT * 0.8, m, T.LIMB);
    d.cap(el, hd, p.foreT * 0.75, p.foreT * 0.5, m, T.LIMB);
    if (m === M.BODY && f.feathers) {
      d.poly([el, hd, pol(hd, PI / 2 + rad(35), p.armL * 0.55 * f.feathers), pol(el, PI / 2 + rad(50), p.armL * 0.4 * f.feathers)], M.BODY, T.LIMB);
    }
    if (m === M.BODY && f.claws) {
      for (let i = 0; i < 3; i++) d.cap(hd, pol(hd, rad(55 + i * 22), p.armL * 0.38 * f.claws), p.foreT * 0.3, 0.05, M.BONE, T.FEATURE);
    }
  };

  // far limbs
  const farOff = (q: Pt) => add(q, 1.4, -0.5);
  if (p.stance === 'biped') {
    leg(farOff(hip), p.legT, -swing, 'bip', M.FAR);
    if (p.armL > 0) arm(farOff(B(rx * 0.62, ry * 0.4)), M.FAR, -s);
  } else if (p.stance === 'quad') {
    leg(farOff(hip), p.legT, -swing, 'quadH', M.FAR);
    leg(farOff(sh), p.foreT, swing, 'quadF', M.FAR);
  } else {
    leg(farOff(hip), p.legT, -swing, 'spr', M.FAR);
    leg(farOff(sh), p.foreT, swing, 'spr', M.FAR);
  }

  // ---------- back features (behind torso)
  if (f.sail) {
    const n = 10;
    const bases: Pt[] = [], tops: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const base = B(-rx * 0.6 + rx * 1.25 * t, -ry * 0.7);
      let hh = Math.pow(Math.sin(PI * t), 0.75);
      if (f.sail.type === 'tall') hh = Math.min(1, Math.sin(PI * t) * 2.2) * (0.75 + 0.25 * t);
      if (f.sail.type === 'hump') hh = Math.pow(Math.sin(PI * t), 1.5) * 0.6;
      const top = pol(base, up, p.bodyH * 1.25 * f.sail.s * hh + 0.2);
      bases.push(base); tops.push(top);
    }
    const mat = f.sail.type === 'hump' ? M.BODY : f.sail.type === 'tall' ? M.ACCENT : M.MEMBRANE;
    d.poly([...bases, ...tops.reverse()], mat, f.sail.type === 'hump' ? T.TORSO : T.FEATURE);
    if (f.sail.type === 'spined' || f.sail.type === 'crossbar') {
      tops.reverse();
      for (let i = 1; i < n; i += 2) {
        d.cap(bases[i], tops[i], 0.35, 0.15, M.BONE, T.FEATURE);
        if (f.sail.type === 'crossbar') d.cap(lerp(bases[i], tops[i], 0.5), add(lerp(bases[i], tops[i], 0.5), 0.9, 0), 0.2, 0.2, M.BONE, T.FEATURE);
      }
    }
  }
  if (f.plates) {
    const pts: Pt[] = [];
    for (let i = 0; i < 5; i++) pts.push(B(rx * 0.7 - rx * 1.5 * (i / 4), -ry * 0.85));
    pts.push(tailPts[1], tailPts[2]);
    pts.forEach((c, i) => {
      const t = i / (pts.length - 1);
      const hgt = p.bodyH * f.plates! * (0.32 + 0.4 * Math.sin(PI * Math.min(1, t * 1.25)));
      const w = hgt * 0.36;
      const c2 = add(c, -w * 0.9, 0.3);
      d.poly([add(c2, w * 0.8, 0.2), pol(add(c2, -w * 0.15, 0), up - rad(14), hgt * 0.8), add(c2, -w * 0.8, 0.2)], M.ARMOR, T.FEATURE);
      d.poly([add(c, w, 0.2), pol(add(c, -w * 0.2, 0), up - rad(10), hgt), add(c, -w, 0.2)], M.ACCENT, T.FEATURE);
    });
  }
  if (f.neckSpines) {
    neckPts.slice(0, -1).forEach((q) => {
      d.cap(q, pol(q, -PI / 2 - rad(25), p.neckT * 2.8 * f.neckSpines!), 0.3, 0.1, M.BONE, T.FEATURE);
    });
  }

  // ---------- tail
  d.chain(tailPts, p.tailT, 0.35, M.BODY, T.TAIL);
  if (f.feathers && p.stance === 'biped') {
    const fe = f.feathers;
    d.poly([tailPts[2], add(tailPts[3], 0, -p.tailT * 1.1 * fe), add(tailEnd, -p.tailL * 0.04, -p.tailT * 0.9 * fe), add(tailEnd, -p.tailL * 0.07, 0), add(tailEnd, -p.tailL * 0.04, p.tailT * 0.9 * fe), add(tailPts[3], 0, p.tailT * 1.1 * fe)], M.BODY, T.TAIL);
  }
  if (f.thagomizer) {
    for (let i = 0; i < 4; i++) {
      const q = lerp(tailPts[2], tailPts[4], 0.15 + i * 0.22);
      d.cap(q, pol(q, -PI / 2 - rad(40 + (i % 2) * 25), p.bodyH * 0.6 * f.thagomizer), 0.45, 0.08, M.BONE, T.FEATURE);
    }
  }
  if (f.quills) {
    for (let i = 0; i < 6; i++) {
      const q = lerp(tailPts[0], tailPts[2], i / 5);
      d.cap(q, pol(q, -PI / 2 - rad(20), p.tailT * 2.2 * f.quills), 0.2, 0.08, M.BONE, T.FEATURE);
    }
  }
  if (f.club) d.ell(tailEnd.x, tailEnd.y, p.tailT * 1.7 * f.club, p.tailT * 1.25 * f.club, 0, M.ARMOR, T.FEATURE);
  if (f.tailSpikes) {
    for (let i = 0; i < 4; i++) {
      const q = lerp(tailPts[3], tailEnd, i / 3);
      d.cap(q, pol(q, -PI / 2 - rad(15), p.tailT * 1.5 * f.tailSpikes), 0.35, 0.05, M.BONE, T.FEATURE);
      d.cap(q, pol(q, PI / 2 + rad(15), p.tailT * 1.2 * f.tailSpikes), 0.35, 0.05, M.BONE, T.FEATURE);
    }
  }

  // ---------- torso
  d.ell(0, cy, rx, ry, a, M.BODY, T.TORSO);
  if (p.hump > 0) {
    const hc = B(rx * 0.35, -ry * 0.2);
    d.ell(hc.x, hc.y, rx * 0.55, ry * (0.75 + 0.45 * p.hump), a, M.BODY, T.TORSO);
  }
  if (f.fur) {
    for (let i = 0; i <= 7; i++) {
      const q = B(-rx * 0.75 + rx * 1.5 * (i / 7), ry * 0.75);
      d.cap(q, add(q, -0.4, ry * 0.45 * f.fur), ry * 0.17, 0.25, M.BODY, T.TORSO);
    }
  }
  if (f.shellBack) {
    const c = B(0, -ry * 0.25);
    d.ell(c.x, c.y, rx * 1.1, ry * 0.95 * f.shellBack, a, M.SHELL, T.FEATURE);
    for (let i = -2; i <= 2; i++) {
      for (let j = 0; j < 2; j++) {
        const q = B(i * rx * 0.33 + (j ? rx * 0.16 : 0), -ry * (0.75 - j * 0.45));
        d.ell(q.x, q.y, rx * 0.09, ry * 0.12, 0, M.ARMOR, T.FEATURE);
      }
    }
  }
  if (f.armor) {
    if (f.armor >= 1) {
      const c = B(0, -ry * 0.18);
      d.ell(c.x, c.y, rx * 1.03, ry * 0.86, a, M.ARMOR, T.TORSO);
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const q = B(-rx * 0.8 + rx * 1.6 * (i / (n - 1)), -ry * 0.92);
      d.ell(q.x, q.y, p.bodyH * 0.09 * f.armor, p.bodyH * 0.08 * f.armor, 0, M.BONE, T.FEATURE);
    }
    tailPts.slice(0, 3).forEach((q) => d.ell(q.x, q.y - p.tailT * 0.8, p.tailT * 0.4, p.tailT * 0.35, 0, M.BONE, T.FEATURE));
  }
  if (f.shoulderSpikes) {
    for (let i = 0; i < 3; i++) {
      const q = B(rx * (0.55 - i * 0.28), -ry * 0.3);
      d.cap(q, pol(q, up + rad(35 - i * 10), p.bodyH * 0.55 * f.shoulderSpikes), p.bodyH * 0.09, 0.05, M.BONE, T.FEATURE);
    }
  }

  // ---------- neck + frill + head
  if (neckPts.length > 1) d.chain(neckPts, p.neckT, Math.max(p.headH * 0.42, p.neckT * 0.55), M.BODY, T.NECK);
  if (f.fur && p.neckL > 0.5) d.ell(neckPts[1].x, neckPts[1].y - p.neckT * 0.3, p.neckT * 1.1, p.neckT * 0.9, 0, M.BODY, T.NECK);
  if (f.frill) {
    const fc = pol(pol(hb, ha + PI, p.headH * 0.25), hup, p.headH * 0.55);
    const frx = p.headH * 1.0 * f.frill.s * (f.frill.long ? 1.45 : 1);
    const fry = p.headH * 1.2 * f.frill.s;
    const rot = ha - rad(68);
    d.ell(fc.x, fc.y, frx, fry, rot, M.ARMOR, T.FEATURE);
    d.ell(fc.x, fc.y, frx * 0.74, fry * 0.72, rot, M.ACCENT, T.FEATURE);
    d.ell(fc.x, fc.y, frx * 0.4, fry * 0.38, rot, M.ACCENT2, T.FEATURE);
    for (let k = 0; k < f.frill.spikes; k++) {
      const th = -PI * 0.15 - (PI * 0.75 * (k + 0.5)) / Math.max(1, f.frill.spikes);
      const ex = Math.cos(th) * frx, ey = Math.sin(th) * fry;
      const rim = P(fc.x + ex * Math.cos(rot) - ey * Math.sin(rot), fc.y + ex * Math.sin(rot) + ey * Math.cos(rot));
      d.cap(rim, pol(rim, Math.atan2(rim.y - fc.y, rim.x - fc.x), p.headH * 0.55 * f.frill.s), p.headH * 0.13, 0.05, M.BONE, T.FEATURE);
    }
  }
  if (f.antlers) {
    const base = H(0.12, 0.45);
    const L = p.headH * 2.1 * f.antlers;
    const beam = arc(base, -PI / 2 - rad(28), L, 3, rad(18));
    d.chain(beam, p.headH * 0.12 * Math.max(1, f.antlers * 0.8), p.headH * 0.07, M.BONE, T.FEATURE);
    beam.slice(1).forEach((q, i) => d.cap(q, pol(q, -PI / 2 + rad(20 + i * 10), L * 0.32), p.headH * 0.08, 0.05, M.BONE, T.FEATURE));
    if (f.antlers > 1.5) d.ell(beam[2].x, beam[2].y, L * 0.28, L * 0.13, -rad(30), M.BONE, T.FEATURE);
  }
  // head
  const back = pol(hb, ha + PI, p.headH * 0.2);
  d.cap(back, tip, p.headH / 2, Math.max(0.3, (p.headH / 2) * p.snout), M.BODY, T.HEAD);
  if (p.headL > p.headH * 1.4) {
    const jc = pol(hb, ha, p.headL * 0.28);
    d.ell(jc.x, jc.y, p.headL * 0.3, p.headH * 0.52, ha, M.BODY, T.HEAD);
  }
  if (f.ears) {
    d.poly([H(0.02, 0.3), pol(pol(hb, ha + PI, p.headH * 0.2), hup, p.headH * (0.55 + 0.45 * f.ears)), H(0.16, 0.42)], M.BODY, T.HEAD);
  }
  if (f.duckbill) {
    const c = pol(hb, ha, p.headL * 0.84);
    d.ell(c.x, c.y, p.headL * 0.24 * f.duckbill, p.headH * 0.3 * f.duckbill, ha, M.BODY, T.HEAD);
    const c2 = pol(c, ha, p.headL * 0.14);
    d.ell(c2.x, c2.y, p.headL * 0.1, p.headH * 0.24, ha, M.BONE, T.FEATURE);
  }
  if (f.beak) {
    d.cap(pol(hb, ha, p.headL * 0.68), pol(hb, ha, p.headL * 1.03), p.headH * 0.3 * Math.max(0.6, p.snout) * f.beak, p.headH * 0.1, M.BONE, T.FEATURE);
    d.cap(pol(hb, ha, p.headL * 0.98), pol(pol(hb, ha, p.headL * 0.98), hdn, p.headH * 0.3), p.headH * 0.1, 0.05, M.BONE, T.FEATURE);
  }
  if (f.dome) {
    const c = H(0.18, 0.42);
    d.ell(c.x, c.y, p.headH * 0.62 * f.dome, p.headH * 0.5 * f.dome, ha, M.ARMOR, T.FEATURE);
  }
  if (f.crest) {
    const cs = f.crest.s;
    switch (f.crest.type) {
      case 'double':
        for (let k = 0; k < 2; k++) {
          const pts: Pt[] = [];
          for (let i = 0; i <= 6; i++) pts.push(pol(H(0.2 + 0.55 * (i / 6) + k * 0.06, 0.45), hup, p.headH * 0.7 * cs * Math.sin((PI * i) / 6)));
          pts.push(H(0.75 + k * 0.06, 0.35), H(0.2 + k * 0.06, 0.35));
          d.poly(pts, k ? M.ACCENT2 : M.ACCENT, T.FEATURE);
        }
        break;
      case 'tube': {
        const st = H(0.45, 0.35);
        d.cap(st, pol(st, ha + PI + rad(20), p.headL * 1.35 * cs), p.headH * 0.2, p.headH * 0.17, M.ACCENT, T.FEATURE);
        break;
      }
      case 'helmet': {
        const c = H(0.35, 0.5);
        d.ell(c.x, c.y, p.headL * 0.3 * cs, p.headH * 0.55 * cs, ha, M.ACCENT, T.FEATURE);
        break;
      }
      case 'fan':
        d.poly([H(0.1, 0.45), pol(H(-0.05, 0.4), ha + PI + rad(18), p.headL * 0.85 * cs), H(-0.12, 0)], M.ACCENT, T.FEATURE);
        break;
      case 'tall':
        d.poly([H(0.15, 0.4), pol(H(0.3, 0.4), hup - rad(10), p.headH * 2.3 * cs), H(-0.15, 0.2), H(0.6, 0.35)], M.ACCENT, T.FEATURE);
        break;
      case 'back':
        d.poly([H(0.15, 0.45), pol(H(0, 0.4), ha + PI + rad(35), p.headL * 0.45 * cs), H(-0.1, 0.2)], M.ACCENT, T.FEATURE);
        break;
      case 'comb':
        for (let i = 0; i < 3; i++) d.cap(H(0.25 + i * 0.18, 0.4), pol(H(0.25 + i * 0.18, 0.4), hup, p.headH * 0.6 * cs), p.headH * 0.15, 0.1, M.ACCENT, T.FEATURE);
        break;
      case 'knob':
        for (let i = 0; i < 3; i++) { const c = H(0.2 + i * 0.22, 0.5); d.ell(c.x, c.y, p.headH * 0.14 * cs, p.headH * 0.14 * cs, 0, M.ACCENT, T.FEATURE); }
        break;
    }
  }
  if (f.browHorns) {
    const st2 = H(0.2, 0.5);
    d.cap(st2, pol(st2, ha - rad(58), p.headH * 1.3 * f.browHorns), p.headH * 0.13, 0.08, M.ARMOR, T.FEATURE);
    const st = H(0.3, 0.42);
    d.cap(st, pol(st, ha - rad(48), p.headH * 1.4 * f.browHorns), p.headH * 0.15, 0.08, M.BONE, T.FEATURE);
  }
  if (f.noseHorn) {
    const st = H(0.8, 0.3 * Math.max(0.4, p.snout));
    d.cap(st, pol(st, ha - rad(78), p.headH * 0.95 * f.noseHorn), p.headH * 0.16, 0.06, M.BONE, T.FEATURE);
  }
  if (f.cheekHorns) {
    const st = H(0.25, -0.35);
    d.cap(st, pol(st, ha + PI * 0.75, p.headH * 0.5 * f.cheekHorns), p.headH * 0.13, 0.05, M.BONE, T.FEATURE);
  }
  if (f.rhinoHorn) {
    const st = H(0.86, 0.3);
    d.cap(st, pol(st, ha - rad(65), p.headH * 1.15 * f.rhinoHorn), p.headH * 0.22, 0.06, M.BONE, T.FEATURE);
    if (f.rhinoHorn >= 1.25) {
      const st2 = H(0.6, 0.42);
      d.cap(st2, pol(st2, ha - rad(75), p.headH * 0.6 * f.rhinoHorn), p.headH * 0.17, 0.06, M.BONE, T.FEATURE);
    }
  }
  if (f.yHorn) {
    const st = H(0.8, 0.35);
    d.cap(st, pol(st, ha - rad(55), p.headH * 0.85 * f.yHorn), p.headH * 0.2, p.headH * 0.17, M.ARMOR, T.FEATURE);
    d.cap(st, pol(st, ha - rad(85), p.headH * 0.8 * f.yHorn), p.headH * 0.2, p.headH * 0.17, M.ARMOR, T.FEATURE);
  }
  // eye + mouth
  const er = p.headH * 0.1 * (f.bigEye ? 1.7 : 1);
  const e = H(0.27, 0.18);
  d.ell(e.x, e.y, er, er, 0, M.EYE, T.FEATURE);
  if (p.headL > 2.2) {
    const m1 = pol(pol(hb, ha, p.headL * 0.32), hdn, p.headH * 0.14);
    const m2 = pol(pol(hb, ha, p.headL * 0.96), hdn, p.headH * 0.06 * p.snout);
    d.cap(m1, m2, 0.01, 0.01, M.MOUTH, T.FEATURE);
    if (f.teeth) {
      for (let i = 0; i < 4; i++) {
        const q = pol(lerp(m1, m2, 0.25 + i * 0.22), hdn, 0.55);
        d.cap(q, pol(q, hdn, p.headH * 0.12 * f.teeth), 0.01, 0.01, M.BONE, T.FEATURE);
      }
    }
  }
  if (f.sabre) {
    const st = pol(pol(hb, ha, p.headL * 0.62), hdn, p.headH * 0.2);
    d.cap(st, add(st, p.headL * 0.06, p.headH * 1.05 * f.sabre), p.headH * 0.11, 0.05, M.BONE, T.FEATURE);
  }

  // ---------- near limbs
  if (p.stance === 'biped') {
    leg(hip, p.legT, swing, 'bip', M.BODY);
    if (p.armL > 0) arm(B(rx * 0.62, ry * 0.4), M.BODY, s);
  } else if (p.stance === 'quad') {
    leg(hip, p.legT, swing, 'quadH', M.BODY);
    leg(sh, p.foreT, -swing, 'quadF', M.BODY);
    if (f.claws) for (let i = 0; i < 3; i++) d.cap(P(sh.x - swing, -p.foreT * 0.5), P(sh.x - swing + p.foreT * (0.8 + i * 0.3), -0.1), p.foreT * 0.18, 0.05, M.BONE, T.FEATURE);
  } else {
    leg(hip, p.legT, swing, 'spr', M.BODY);
    leg(sh, p.foreT, -swing, 'spr', M.BODY);
  }

  // ---------- front-most head features
  if (f.tusks) {
    const L = p.headL * 1.5 * f.tusks.s;
    const o = pol(pol(hb, ha, p.headL * 0.6), hdn, p.headH * 0.22);
    let pts: Pt[];
    if (f.tusks.mode === 'up') pts = [o, add(o, L * 0.35, L * 0.28), add(o, L * 0.72, L * 0.22), add(o, L * 0.9, -L * 0.08)];
    else if (f.tusks.mode === 'down') pts = [o, add(o, L * 0.05, L * 0.3), add(o, -L * 0.12, L * 0.5)];
    else if (f.tusks.mode === 'shovel') pts = [o, add(o, L * 0.5, L * 0.12)];
    else pts = [o, add(o, L * 0.06, L * 0.25)];
    const r0 = f.tusks.mode === 'shovel' ? p.headH * 0.22 : p.headH * 0.13;
    d.chain(pts, r0, f.tusks.mode === 'shovel' ? p.headH * 0.2 : p.headH * 0.05, M.BONE, T.FEATURE);
  }
  if (f.trunk) {
    const pts = arc(tip, PI / 2 - rad(15), p.headL * 1.15 * f.trunk, 3, rad(16));
    d.chain(pts, p.headH * 0.25, p.headH * 0.11, M.BODY, T.NECK);
  }
}

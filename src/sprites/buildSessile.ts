// Builders for animals without a "swim / walk" body plan: sponges, archaeocyaths, brachiopods, polyps, comb jellies and
// floating discs, stalked echinoderms, graptolites, snails and worms. Side view, ground at y = 0, up = -y.

import { Draw, M, T, type Pt } from './raster';
import type { SessileP } from './look';
import { P, add, arc, rad } from './geom';

const PI = Math.PI;

export function buildSessile(d: Draw, p: SessileP, phase: number): void {
  const H = p.h, W = p.w;
  const sway = phase ? 1 : -1;
  switch (p.kind) {
    case 'sponge': {
      // a vase or a tube standing on the sea floor, with needle-like spicules at the rim
      const top = -H, rimW = W * 0.5, baseW = W * 0.18;
      d.poly([P(-baseW, 0), P(-rimW, top), P(rimW, top), P(baseW, 0)], M.BODY, T.TORSO);
      d.ell(0, top, rimW, W * 0.12, 0, M.DARK, T.FEATURE);
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const y = top * t, hw = baseW + (rimW - baseW) * t;
        d.cap(P(-hw * 0.95, y), P(hw * 0.95, y), 0.01, 0.01, M.MARK, T.FEATURE);
      }
      for (let i = 0; i < p.n; i++) {
        const x = -rimW + (2 * rimW * i) / Math.max(1, p.n - 1);
        d.cap(P(x, top), P(x * 1.15 + sway * 0.3, top - H * 0.22), 0.25, 0.02, M.BONE, T.FEATURE);
      }
      return;
    }
    case 'branching': {
      // a bushy, branching sponge
      const stems: Pt[][] = [arc(P(0, 0), -PI / 2, H, 4, 0)];
      for (let i = 0; i < p.n; i++) stems.push(arc(P(0, -H * (0.15 + 0.12 * i)), -PI / 2 + (i % 2 ? 1 : -1) * rad(25 + 6 * i), H * (0.7 - 0.06 * i), 3, (i % 2 ? -1 : 1) * rad(10)));
      for (const st of stems) d.chain(st, W * 0.13, W * 0.11, M.BODY, T.TORSO);
      for (const st of stems) d.ell(st[st.length - 1].x, st[st.length - 1].y, W * 0.1, W * 0.06, 0, M.DARK, T.FEATURE);
      return;
    }
    case 'cup': {
      // archaeocyath: a double-walled cup full of pores
      const top = -H, rimW = W * 0.5, baseW = W * 0.12;
      d.cap(P(0, 0), P(0, H * 0.18), W * 0.06, W * 0.02, M.BODY, T.LIMB);
      d.poly([P(-baseW, 0), P(-rimW, top), P(rimW, top), P(baseW, 0)], M.SHELL, T.TORSO);
      d.poly([P(-baseW * 0.4, -H * 0.2), P(-rimW * 0.7, top), P(rimW * 0.7, top), P(baseW * 0.4, -H * 0.2)], M.DARK, T.FEATURE);
      for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) {
        const t = 0.25 + i * 0.18;
        d.ell(sg * (baseW + (rimW - baseW) * t) * 0.85, top * t, 0.35, 0.35, 0, M.MARK, T.FEATURE);
      }
      d.ell(0, top, rimW, W * 0.1, 0, M.ARMOR, T.FEATURE);
      return;
    }
    case 'urchin': {
      // sea urchin: a dome of plates bristling with spines
      const cy = -H * 0.42;
      for (let i = 0; i < p.n; i++) {
        const a = PI + (PI * (i + 0.5)) / p.n;
        d.cap(P(Math.cos(a) * W * 0.3, cy + Math.sin(a) * H * 0.3), P(Math.cos(a) * W * 0.62, cy + Math.sin(a) * H * 0.75), 0.35, 0.05, M.BONE, T.FEATURE);
      }
      d.ell(0, cy, W * 0.42, H * 0.4, 0, M.SHELL, T.TORSO);
      for (let i = -2; i <= 2; i++) d.cap(P(i * W * 0.1, cy - H * 0.38), P(i * W * 0.16, cy + H * 0.36), 0.01, 0.01, M.ARMOR, T.FEATURE);
      return;
    }
    case 'star': {
      // starfish / brittle star seen from above: five arms (thin and wavy when n > 0)
      const thin = p.n > 0;
      for (let i = 0; i < 5; i++) {
        const a = -PI / 2 + (i * 2 * PI) / 5;
        d.chain(arc(P(0, -H * 0.5), a, W * (thin ? 0.55 : 0.45), 4, (thin ? rad(14) : rad(3)) * (i % 2 ? 1 : -1) * sway), W * (thin ? 0.05 : 0.12), W * 0.03, M.BODY, T.LIMB);
      }
      d.ell(0, -H * 0.5, W * (thin ? 0.12 : 0.16), W * (thin ? 0.12 : 0.16), 0, M.SHELL, T.TORSO);
      return;
    }
    case 'bivalve':
    case 'brachiopod': {
      // two valves seen from the side, ribs fanning out from the hinge; a fleshy stalk (pedicle) underneath
      const R = W * 0.5;
      const cy = -H * 0.55;
      if (p.n > 0 && p.kind === 'brachiopod') d.cap(P(0, cy + H * 0.4), P(sway * 0.4, 0), W * 0.07, W * 0.05, M.BODY, T.LIMB);
      d.ell(0, cy, R, H * 0.45, 0, M.SHELL, T.TORSO);
      const hinge = P(0, cy + H * 0.42);
      const ribs = Math.max(5, p.n || 9);
      for (let i = 0; i < ribs; i++) {
        const a = PI + (PI * (i + 0.5)) / ribs;
        d.cap(hinge, P(Math.cos(a) * R * 0.95, cy + Math.sin(a) * H * 0.43), 0.01, 0.01, M.ARMOR, T.FEATURE);
      }
      d.cap(P(-R * 0.98, cy + H * 0.05), P(R * 0.98, cy + H * 0.05), 0.02, 0.02, M.DARK, T.FEATURE);
      d.ell(0, hinge.y, R * 0.18, H * 0.06, 0, M.ARMOR, T.FEATURE);
      return;
    }
    case 'polyp': {
      // sea anemone-like polyp: a column with a crown of tentacles
      d.cap(P(0, 0), P(0, -H * 0.65), W * 0.22, W * 0.18, M.BODY, T.TORSO);
      for (let i = 0; i < p.n; i++) {
        const a = -PI / 2 + (i - (p.n - 1) / 2) * rad(150 / p.n);
        d.chain(arc(P(0, -H * 0.65), a, H * 0.45, 3, (a > -PI / 2 ? 1 : -1) * rad(12) + sway * rad(4)), W * 0.05, 0.15, M.ACCENT, T.LIMB);
      }
      d.ell(0, -H * 0.66, W * 0.2, W * 0.07, 0, M.MOUTH, T.FEATURE);
      return;
    }
    case 'jelly': {
      // comb jelly: a glassy bell with shimmering comb rows
      const cy = -H * 0.6;
      d.ell(0, cy, W * 0.42, H * 0.42, 0, M.MEMBRANE, T.TORSO);
      for (let i = 0; i < p.n; i++) {
        const x = -W * 0.3 + (W * 0.6 * i) / Math.max(1, p.n - 1);
        d.cap(P(x, cy - H * 0.32), P(x * 1.1, cy + H * 0.32), 0.25, 0.25, M.GLOW, T.FEATURE);
      }
      for (const sg of [-1, 1]) d.chain(arc(P(sg * W * 0.12, cy + H * 0.38), PI / 2 + sg * rad(10), H * 0.35, 3, sg * rad(10) * sway), 0.2, 0.08, M.ACCENT, T.LIMB);
      return;
    }
    case 'disc': {
      // a floating disc (Eldonia-like): a flat bell with a coiled gut and short tentacles
      const cy = -H * 0.6;
      for (let i = 0; i < 5; i++) d.chain(arc(P(-W * 0.2 + i * W * 0.1, cy + H * 0.12), PI / 2, H * 0.4, 2, rad(8) * sway), 0.35, 0.15, M.ACCENT, T.LIMB);
      d.ell(0, cy, W * 0.5, H * 0.18, 0, M.MEMBRANE, T.TORSO);
      d.ell(0, cy - H * 0.06, W * 0.3, H * 0.08, 0, M.MARK, T.FEATURE);
      d.ell(0, cy - H * 0.06, W * 0.16, H * 0.05, 0, M.BODY, T.FEATURE);
      return;
    }
    case 'crinoid': {
      // stalked echinoderm: a stem, a cup (calyx) and arms reaching up into the current
      const stem = arc(P(0, 0), -PI / 2, H * 0.6, 5, rad(3) * sway);
      d.chain(stem, W * 0.06, W * 0.05, M.ARMOR, T.LIMB);
      for (let i = 1; i < stem.length; i++) d.cap(add(stem[i], -W * 0.07, 0), add(stem[i], W * 0.07, 0), 0.01, 0.01, M.MARK, T.FEATURE);
      const c = stem[stem.length - 1];
      for (let i = 0; i < p.n; i++) {
        const a = -PI / 2 + (i - (p.n - 1) / 2) * rad(110 / p.n);
        d.chain(arc(add(c, 0, -W * 0.1), a, H * 0.42, 4, (a > -PI / 2 ? 1 : -1) * rad(9)), W * 0.05, W * 0.02, M.BODY, T.LIMB);
      }
      d.ell(c.x, c.y - W * 0.08, W * 0.16, W * 0.13, 0, M.BODY, T.TORSO);
      for (const sg of [-1, 1]) d.ell(c.x + sg * W * 0.07, c.y - W * 0.08, W * 0.04, W * 0.04, 0, M.ARMOR, T.FEATURE);
      return;
    }
    case 'globe': {
      // cystoid: a ball of plates on a short stalk
      d.chain(arc(P(0, 0), -PI / 2, H * 0.3, 3, rad(3) * sway), W * 0.06, W * 0.05, M.ARMOR, T.LIMB);
      const cy = -H * 0.62;
      d.ell(0, cy, W * 0.36, H * 0.34, 0, M.SHELL, T.TORSO);
      for (let i = -2; i <= 2; i++) {
        d.cap(P(i * W * 0.12 - W * 0.1, cy - H * 0.28), P(i * W * 0.12 + W * 0.1, cy + H * 0.28), 0.01, 0.01, M.ARMOR, T.FEATURE);
        d.cap(P(i * W * 0.12 + W * 0.1, cy - H * 0.28), P(i * W * 0.12 - W * 0.1, cy + H * 0.28), 0.01, 0.01, M.ARMOR, T.FEATURE);
      }
      for (let i = 0; i < 3; i++) d.chain(arc(P(0, cy - H * 0.32), -PI / 2 + (i - 1) * rad(30), H * 0.2, 2, 0), 0.3, 0.1, M.BODY, T.LIMB);
      return;
    }
    case 'graptolite': {
      // a colony of tiny tubes along thin branches (stipes), hanging in the plankton
      const top = P(0, -H);
      const n = Math.max(1, p.n);
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? PI / 2 : PI / 2 + (i - (n - 1) / 2) * rad(n === 2 ? 140 : 40);
        const st = arc(top, a, H * 0.9, 6, (i - (n - 1) / 2) * rad(2) * sway);
        d.chain(st, 0.35, 0.3, M.BODY, T.TORSO);
        for (let k = 1; k < st.length; k++) {
          const q = st[k];
          d.poly([q, add(q, W * 0.08, -W * 0.06), add(q, W * 0.1, W * 0.02)], M.ACCENT, T.FEATURE);
        }
      }
      d.cap(top, add(top, 0, -H * 0.12), 0.2, 0.1, M.BONE, T.FEATURE);
      return;
    }
    case 'snail': {
      // coiled shell on a creeping foot
      d.cap(P(-W * 0.45, -H * 0.06), P(W * 0.5, -H * 0.06), H * 0.08, H * 0.06, M.BODY, T.LIMB);
      d.ell(W * 0.48, -H * 0.12, W * 0.08, H * 0.08, 0, M.BODY, T.HEAD);
      for (const sg of [0, 1]) d.cap(P(W * 0.5, -H * 0.16), P(W * 0.62 + sg * W * 0.04, -H * 0.36 + sg * H * 0.06), 0.25, 0.15, M.BODY, T.FEATURE);
      const R = H * 0.42;
      d.ell(-W * 0.05, -H * 0.5, R * 1.1, R, 0, M.SHELL, T.TORSO);
      d.ell(-W * 0.1, -H * 0.56, R * 0.66, R * 0.6, 0, M.ARMOR, T.FEATURE);
      d.ell(-W * 0.12, -H * 0.6, R * 0.38, R * 0.34, 0, M.SHELL, T.FEATURE);
      d.ell(-W * 0.13, -H * 0.62, R * 0.14, R * 0.13, 0, M.ARMOR, T.FEATURE);
      for (let i = 0; i < p.n; i++) {
        const a = (i / p.n) * 2 * PI;
        d.cap(P(-W * 0.05 + Math.cos(a) * R * 0.7, -H * 0.5 + Math.sin(a) * R * 0.64), P(-W * 0.05 + Math.cos(a) * R * 1.05, -H * 0.5 + Math.sin(a) * R * 0.96), 0.01, 0.01, M.MARK, T.FEATURE);
      }
      return;
    }
    case 'tube': {
      // a worm in a tube: the tube stands in the mud, the worm peeks out with its spiny snout
      d.cap(P(0, 0), P(sway * 0.3, -H * 0.7), W * 0.16, W * 0.2, M.SHELL, T.TORSO);
      for (let i = 1; i < 6; i++) d.cap(P(-W * 0.18, -H * 0.12 * i), P(W * 0.18, -H * 0.12 * i), 0.01, 0.01, M.MARK, T.FEATURE);
      const tip = P(sway * 0.3, -H * 0.7);
      d.chain(arc(tip, -PI / 2 + sway * rad(10), H * 0.3, 3, sway * rad(14)), W * 0.12, W * 0.08, M.BODY, T.NECK);
      d.ell(tip.x, tip.y - H * 0.3, W * 0.12, W * 0.1, 0, M.BODY, T.HEAD);
      return;
    }
    case 'worm':
    default: {
      // a worm: a curved body; priapulids get a spiny snout, bristle worms rows of bristles
      const pts = arc(P(-W * 0.5, -H * 0.3), rad(-10), W, 8, rad(4) * sway).map((q, i) => add(q, 0, Math.sin(i * 0.9 + phase) * H * 0.12));
      if (p.n > 0) for (let i = 1; i < pts.length - 1; i++) for (const sg of [-1, 1]) d.cap(pts[i], add(pts[i], -0.3, sg * H * 0.32), 0.2, 0.02, M.ACCENT, T.LIMB);
      d.chain(pts, H * 0.14, H * 0.2, M.BODY, T.TORSO);
      for (let i = 1; i < pts.length - 1; i++) d.cap(add(pts[i], 0, -H * 0.16), add(pts[i], 0, H * 0.16), 0.01, 0.01, M.MARK, T.FEATURE);
      const head = pts[pts.length - 1];
      if (p.n === 0) for (let k = 0; k < 4; k++) d.cap(add(head, -k * W * 0.04, -H * 0.2), add(head, -k * W * 0.04 + W * 0.03, -H * 0.3), 0.2, 0.02, M.BONE, T.FEATURE);
      d.ell(head.x + W * 0.04, head.y, H * 0.22, H * 0.2, 0, M.BODY, T.HEAD);
      return;
    }
  }
}

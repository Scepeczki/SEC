// Tiny vector-to-pixel rasterizer + pixel-art post-processing (countershading,
// patterns, evolution spikes, shading, outline, glow). Pure TS: runs in browser and Node.

import { hash2 } from './rng';
import { type Palette, type RGBA, mix as mixc, shade } from './palette';

export const M = {
  EMPTY: 0, BODY: 1, FAR: 2, BELLY: 3, ACCENT: 4, ACCENT2: 5, BONE: 6, EYE: 7, ARMOR: 8,
  SHELL: 9, MEMBRANE: 10, FIN: 11, MOUTH: 12, GLOW: 13, MARK: 14, SPIKE: 15, DARK: 16,
} as const;
export const T = { NONE: 0, TORSO: 1, NECK: 2, HEAD: 3, TAIL: 4, LIMB: 5, FEATURE: 6 } as const;

export type Shape =
  | { k: 'e'; x: number; y: number; rx: number; ry: number; rot: number; m: number; t: number }
  | { k: 'c'; x1: number; y1: number; r1: number; x2: number; y2: number; r2: number; m: number; t: number }
  | { k: 'p'; pts: number[]; m: number; t: number };

export interface Pt { x: number; y: number }

/** Shape collector with drawing helpers (model space: x right, y down, ground at y=0). */
export class Draw {
  shapes: Shape[] = [];
  ell(x: number, y: number, rx: number, ry: number, rot = 0, m: number = M.BODY, t: number = T.TORSO) {
    this.shapes.push({ k: 'e', x, y, rx, ry, rot, m, t });
  }
  cap(a: Pt, b: Pt, r1: number, r2: number, m: number = M.BODY, t: number = T.LIMB) {
    this.shapes.push({ k: 'c', x1: a.x, y1: a.y, r1, x2: b.x, y2: b.y, r2, m, t });
  }
  poly(pts: Pt[], m: number = M.ACCENT, t: number = T.FEATURE) {
    this.shapes.push({ k: 'p', pts: pts.flatMap((p) => [p.x, p.y]), m, t });
  }
  /** chain of tapered capsules through points */
  chain(pts: Pt[], r0: number, r1: number, m: number = M.BODY, t: number = T.TAIL) {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const ra = r0 + (r1 - r0) * (i / n);
      const rb = r0 + (r1 - r0) * ((i + 1) / n);
      this.cap(pts[i], pts[i + 1], ra, rb, m, t);
    }
  }
}

export interface RasterOpts {
  scale: number;
  pad: number;
  stage: number;
  seed: number;
  /** spike every N columns along the back for stage >= 3 (0 = none) */
  spikeEvery: number;
  spikeHeight: number;
  glow: boolean;
  aura: boolean;
  /** skip countershading (e.g. trilobites seen from above) */
  noBelly?: boolean;
}

export interface SpriteImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** pixel row corresponding to model y = 0 (ground) */
  groundY: number;
}

export function shapeBBox(s: Shape): [number, number, number, number] {
  if (s.k === 'e') {
    const r = Math.max(s.rx, s.ry);
    return [s.x - r, s.y - r, s.x + r, s.y + r];
  }
  if (s.k === 'c') {
    return [
      Math.min(s.x1 - s.r1, s.x2 - s.r2), Math.min(s.y1 - s.r1, s.y2 - s.r2),
      Math.max(s.x1 + s.r1, s.x2 + s.r2), Math.max(s.y1 + s.r1, s.y2 + s.r2),
    ];
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < s.pts.length; i += 2) {
    x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i]);
    y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1]);
  }
  return [x0, y0, x1, y1];
}

function inside(s: Shape, x: number, y: number, minR: number): boolean {
  if (s.k === 'e') {
    const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
    const dx = x - s.x, dy = y - s.y;
    const u = dx * c - dy * sn, v = dx * sn + dy * c;
    const rx = Math.max(s.rx, minR), ry = Math.max(s.ry, minR);
    return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
  }
  if (s.k === 'c') {
    const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? ((x - s.x1) * vx + (y - s.y1) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = s.x1 + vx * t, py = s.y1 + vy * t;
    const r = Math.max(s.r1 + (s.r2 - s.r1) * t, minR);
    const dx = x - px, dy = y - py;
    return dx * dx + dy * dy <= r * r;
  }
  let inPoly = false;
  const p = s.pts;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inPoly = !inPoly;
  }
  return inPoly;
}

const SHADED_TAGS = new Set<number>([T.TORSO, T.NECK, T.TAIL, T.HEAD]);

export function rasterize(shapes: Shape[], pal: Palette, o: RasterOpts): SpriteImage {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    const b = shapeBBox(s);
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  const pad = o.pad;
  const sc = o.scale;
  const w = Math.max(4, Math.ceil((x1 - x0) * sc) + pad * 2);
  const h = Math.max(4, Math.ceil((y1 - y0) * sc) + pad * 2);
  const mat = new Uint8Array(w * h);
  const tag = new Uint8Array(w * h);
  const minR = 0.5 / sc;

  for (const s of shapes) {
    const b = shapeBBox(s);
    const px0 = Math.max(0, Math.floor((b[0] - x0) * sc + pad) - 1);
    const py0 = Math.max(0, Math.floor((b[1] - y0) * sc + pad) - 1);
    const px1 = Math.min(w - 1, Math.ceil((b[2] - x0) * sc + pad) + 1);
    const py1 = Math.min(h - 1, Math.ceil((b[3] - y0) * sc + pad) + 1);
    for (let py = py0; py <= py1; py++) {
      const my = (py + 0.5 - pad) / sc + y0;
      for (let px = px0; px <= px1; px++) {
        const mx = (px + 0.5 - pad) / sc + x0;
        if (inside(s, mx, my, minR)) {
          mat[py * w + px] = s.m;
          tag[py * w + px] = s.t;
        }
      }
    }
  }

  // ---- column runs: countershading + relative position for patterns
  const runPos = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!SHADED_TAGS.has(tag[y * w + x]) || mat[y * w + x] === M.EMPTY) { y++; continue; }
      const start = y;
      while (y < h && SHADED_TAGS.has(tag[y * w + x]) && mat[y * w + x] !== M.EMPTY) y++;
      const len = y - start;
      for (let k = start; k < y; k++) {
        const rp = len > 1 ? (k - start) / (len - 1) : 0.5;
        runPos[k * w + x] = rp;
        if (!o.noBelly && len >= 4 && rp > 0.66 && mat[k * w + x] === M.BODY) mat[k * w + x] = M.BELLY;
      }
    }
  }

  // ---- patterns
  const ps = pal.patternScale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mat[i] !== M.BODY || !SHADED_TAGS.has(tag[i])) continue;
      const rp = runPos[i];
      let on = false;
      switch (pal.pattern) {
        case 'stripes': on = rp < 0.7 && Math.floor((x + y * 0.4) / (2.2 * ps)) % 2 === 0; break;
        case 'spots': on = rp < 0.72 && hash2(x >> 1, y >> 1, o.seed) < 0.22; break;
        case 'saddle': on = rp < 0.3; break;
        case 'bands': on = rp < 0.8 && Math.floor(x / (3.5 * ps)) % 2 === 0; break;
        case 'speckle': on = hash2(x, y, o.seed) < 0.13; break;
      }
      if (o.glow && pal.pattern === 'none') on = rp < 0.5 && Math.floor((x + y) / 3) % 3 === 0;
      if (on) mat[i] = o.glow ? M.GLOW : M.MARK;
    }
  }

  // ---- evolution spikes along the back (stage >= 3)
  if (o.spikeEvery > 0) {
    let k = 0;
    for (let x = 1; x < w - 1; x++) {
      let top = -1;
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        if (mat[i] !== M.EMPTY) { if (SHADED_TAGS.has(tag[i]) && tag[i] !== T.HEAD) top = y; break; }
      }
      if (top < 0) { k = 0; continue; }
      if (k++ % o.spikeEvery !== 0) continue;
      for (let d = 1; d <= o.spikeHeight; d++) {
        const yy = top - d;
        if (yy < 0) break;
        const i = yy * w + x;
        if (mat[i] === M.EMPTY) { mat[i] = M.SPIKE; tag[i] = T.FEATURE; }
        if (d === 1 && mat[i - 1] === M.EMPTY) { mat[i - 1] = M.SPIKE; tag[i - 1] = T.FEATURE; }
      }
    }
  }

  // ---- color + shading
  const colorOf = (m: number): RGBA => {
    switch (m) {
      case M.BODY: return pal.body;
      case M.FAR: return shade(pal.body, -0.3);
      case M.BELLY: return pal.belly;
      case M.ACCENT: return pal.accent;
      case M.ACCENT2: return pal.accent2;
      case M.BONE: return pal.bone;
      case M.EYE: return o.glow ? pal.glow : pal.eye;
      case M.ARMOR: return pal.armor;
      case M.SHELL: return pal.shell;
      case M.MEMBRANE: return pal.membrane;
      case M.FIN: return shade(mixc(pal.body, pal.accent, 0.35), -0.08);
      case M.MOUTH: return shade(pal.body, -0.5);
      case M.GLOW: return pal.glow;
      case M.MARK: return pal.mark;
      case M.SPIKE: return o.glow ? pal.accent2 : pal.bone;
      case M.DARK: return pal.outline;
      default: return pal.body;
    }
  };
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mat[i];
      if (m === M.EMPTY) continue;
      let c = colorOf(m);
      if (m !== M.EYE && m !== M.GLOW && m !== M.DARK && m !== M.MOUTH) {
        const up = y > 0 ? mat[i - w] : M.EMPTY;
        const dn = y < h - 1 ? mat[i + w] : M.EMPTY;
        if (up === M.EMPTY) c = shade(c, 0.16);
        else if (dn === M.EMPTY) c = shade(c, -0.18);
      }
      out.set(c, i * 4);
    }
  }
  // ---- outline
  const ol = pal.outline;
  const isFilled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mat[y * w + x] !== M.EMPTY;
  const outlineMask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mat[y * w + x] !== M.EMPTY) continue;
      if (isFilled(x - 1, y) || isFilled(x + 1, y) || isFilled(x, y - 1) || isFilled(x, y + 1)) {
        out.set(ol, (y * w + x) * 4);
        outlineMask[y * w + x] = 1;
      }
    }
  }
  // ---- aura for apex forms
  if (o.aura) {
    const g = pal.glow;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mat[i] !== M.EMPTY || outlineMask[i]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && outlineMask[yy * w + xx]) { near = true; break; }
          }
        }
        if (near) out.set([g[0], g[1], g[2], 90], i * 4);
      }
    }
  }
  return { w, h, data: out, groundY: Math.round((0 - y0) * sc + pad) };
}

import type { Pt } from './raster';

export const rad = (deg: number) => (deg * Math.PI) / 180;
export const pol = (a: Pt, ang: number, len: number): Pt => ({ x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len });
export const add = (a: Pt, dx: number, dy: number): Pt => ({ x: a.x + dx, y: a.y + dy });
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const P = (x: number, y: number): Pt => ({ x, y });

/** points along a curved line starting at p with direction ang (radians), turning by curve each step */
export function arc(p: Pt, ang: number, len: number, n: number, curve: number): Pt[] {
  const pts = [p];
  let a = ang;
  let cur = p;
  for (let i = 0; i < n; i++) {
    cur = pol(cur, a, len / n);
    pts.push(cur);
    a += curve;
  }
  return pts;
}

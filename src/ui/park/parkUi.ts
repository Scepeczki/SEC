// UI state of the park screen (shared by the map, the side panel, the build bar and the Transporter).

import { create } from 'zustand';

export type ParkTool =
  | { kind: 'place'; defId: string; rot: 0 | 1 }
  | { kind: 'move'; id: number; rot: 0 | 1 }
  | { kind: 'path' }
  | { kind: 'unpath' }
  | { kind: 'clear' }
  | { kind: 'demolish' }
  | null;

export type ParkSel =
  | { kind: 'obj'; id: number }
  | { kind: 'animal'; uid: number }
  | { kind: 'island'; id: number }
  | { kind: 'chunk'; island: number; chunk: number }
  | null;

export type BuildCat = 'enclosure' | 'station' | 'farm' | 'visitor' | 'paths' | 'decor' | 'land';

interface ParkUi {
  build: boolean;
  cat: BuildCat;
  tool: ParkTool;
  sel: ParkSel;
  /** enclosure shown from the inside */
  interior: number | null;
  listOpen: boolean;
  /** animal being dragged */
  drag: number | null;
  setBuild: (on: boolean) => void;
  setCat: (c: BuildCat) => void;
  setTool: (t: ParkTool) => void;
  select: (s: ParkSel) => void;
  setInterior: (id: number | null) => void;
  setListOpen: (on: boolean) => void;
  setDrag: (uid: number | null) => void;
}

export const usePark = create<ParkUi>((set) => ({
  build: false,
  cat: 'enclosure',
  tool: null,
  sel: null,
  interior: null,
  listOpen: false,
  drag: null,
  setBuild: (on) => set({ build: on, tool: null }),
  setCat: (cat) => set({ cat }),
  setTool: (tool) => set({ tool }),
  select: (sel) => set({ sel }),
  setInterior: (interior) => set({ interior }),
  setListOpen: (listOpen) => set({ listOpen }),
  setDrag: (drag) => set({ drag }),
}));

/** camera: centre in world pixels and zoom (screen px per world px); kept between visits to the tab */
export const camera = { x: 28 * 16, y: 24 * 16, z: 1.15, tx: NaN, ty: NaN, tz: NaN };
export const ZOOM_MIN = 0.12, ZOOM_MAX = 3.2;

/** last pointer position in window coordinates (for drag ghosts and hover) */
export const pointer = { x: 0, y: 0 };

/** an animal being fed: the map and the enclosure view drop food onto it and show hearts */
export interface FeedEvent { uid: number; food: 'meat' | 'plants' | 'fish' | 'plankton'; levels: number; t0: number }
export const feedEvents: FeedEvent[] = [];
export const FEED_MS = 1600;
export function pushFeed(uid: number, food: FeedEvent['food'], levels: number) {
  const now = performance.now();
  for (let i = feedEvents.length - 1; i >= 0; i--) if (now - feedEvents[i].t0 > FEED_MS || feedEvents[i].uid === uid) feedEvents.splice(i, 1);
  feedEvents.push({ uid, food, levels, t0: now });
}

/** food bits falling onto an animal standing at (x, y) in canvas pixels, `k` = pixel scale */
export function drawFeed(ctx: CanvasRenderingContext2D, e: FeedEvent, now: number, x: number, y: number, k: number, h: number) {
  const t = (now - e.t0) / FEED_MS;
  if (t < 0 || t >= 1) return;
  const col = e.food === 'meat' ? ['#c9524a', '#e9857a'] : e.food === 'plants' ? ['#5f9a3e', '#9fd47a'] : ['#6db6e0', '#c9e6f5'];
  // bits fall during the first 55%, then the animal munches them
  for (let i = 0; i < 6; i++) {
    const lt = t * 1.8 - i * 0.08;
    if (lt < 0 || lt > 1) continue;
    const bx = x + (((i * 37) % 13) - 6) * k * 1.3;
    const by = y - h - 16 * k + lt * lt * (h + 14 * k);
    ctx.globalAlpha = lt > 0.85 ? (1 - lt) / 0.15 : 1;
    ctx.fillStyle = col[i % 2];
    if (e.food === 'meat') { ctx.fillRect(bx - 2 * k, by - 1.5 * k, 4 * k, 3 * k); ctx.fillStyle = '#f1e3c8'; ctx.fillRect(bx + 1.5 * k, by - 0.5 * k, 1.5 * k, 1 * k); }
    else if (e.food === 'plants') { ctx.fillRect(bx - 2 * k, by - k, 4 * k, 2 * k); ctx.fillRect(bx - k, by - 2 * k, 2 * k, 1 * k); }
    else { ctx.fillRect(bx - 2.5 * k, by - k, 4 * k, 2 * k); ctx.fillRect(bx + 1.5 * k, by - 1.5 * k, 1.5 * k, 3 * k); }
  }
  ctx.globalAlpha = 1;
  // hearts and the level gain rise from the animal
  if (t > 0.45) {
    const ht = (t - 0.45) / 0.55;
    ctx.globalAlpha = 1 - ht * ht;
    for (let i = 0; i < 3; i++) {
      const hx = x + (i - 1) * 7 * k, hy = y - h - ht * 18 * k - i * 3 * k;
      ctx.fillStyle = '#ff7a8a';
      ctx.fillRect(hx - 2 * k, hy - k, 1.6 * k, 1.6 * k); ctx.fillRect(hx + 0.4 * k, hy - k, 1.6 * k, 1.6 * k); ctx.fillRect(hx - 1.6 * k, hy + 0.4 * k, 3.2 * k, 1.2 * k); ctx.fillRect(hx - 0.6 * k, hy + 1.4 * k, 1.2 * k, 0.9 * k);
    }
    ctx.font = `900 ${Math.max(10, Math.round(6 * k))}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#14130e'; ctx.strokeText(`+${e.levels} poz.`, x, y - h - 10 * k - ht * 22 * k);
    ctx.fillStyle = '#ffe08a'; ctx.fillText(`+${e.levels} poz.`, x, y - h - 10 * k - ht * 22 * k);
    ctx.globalAlpha = 1;
  }
}

/** the map registers these so panels can steer it */
export const mapApi: {
  flyTo?: (wx: number, wy: number, z?: number) => void;
  /** enclosure pen under a window point, if any */
  penAt?: (clientX: number, clientY: number) => { enc: number; pen: number } | null;
  /** floating text at a window point */
  floatText?: (clientX: number, clientY: number, text: string, color: string) => void;
} = {};

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

/** the map registers these so panels can steer it */
export const mapApi: {
  flyTo?: (wx: number, wy: number, z?: number) => void;
  /** enclosure pen under a window point, if any */
  penAt?: (clientX: number, clientY: number) => { enc: number; pen: number } | null;
  /** floating text at a window point */
  floatText?: (clientX: number, clientY: number, text: string, color: string) => void;
} = {};

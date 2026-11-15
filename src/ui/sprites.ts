// Browser sprite cache: SpriteImage -> data URL (pixelated <img>) and canvases.

import { useEffect, useState } from 'react';
import { GENERA, spriteSpec } from '../data/db';
import { renderSprite, type SpriteSpec } from '../sprites/generator';
import type { SpriteImage } from '../sprites/raster';

const urlCache = new Map<string, { url: string; w: number; h: number; groundY: number }>();
const canvasCache = new Map<string, HTMLCanvasElement>();

function toCanvas(img: SpriteImage, silhouette: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.w;
  c.height = img.h;
  const ctx = c.getContext('2d')!;
  const data = new Uint8ClampedArray(img.data);
  if (silhouette) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) { data[i] = 38; data[i + 1] = 44; data[i + 2] = 40; data[i + 3] = data[i + 3] > 120 ? 255 : 0; }
    }
  }
  ctx.putImageData(new ImageData(data, img.w, img.h), 0, 0);
  return c;
}

export function specKey(spec: SpriteSpec, stage: number, frame: number, silhouette: boolean): string {
  return `${spec.name}|${stage}|${frame}|${silhouette ? 1 : 0}`;
}

export function spriteCanvas(spec: SpriteSpec, stage: number, frame = 0, silhouette = false): HTMLCanvasElement {
  const key = specKey(spec, stage, frame, silhouette);
  let c = canvasCache.get(key);
  if (!c) {
    c = toCanvas(renderSprite(spec, stage, frame), silhouette);
    canvasCache.set(key, c);
  }
  return c;
}

export function spriteUrl(spec: SpriteSpec, stage: number, frame = 0, silhouette = false) {
  const key = specKey(spec, stage, frame, silhouette);
  let u = urlCache.get(key);
  if (!u) {
    const img = renderSprite(spec, stage, frame);
    const c = toCanvas(img, silhouette);
    u = { url: c.toDataURL(), w: img.w, h: img.h, groundY: img.groundY };
    urlCache.set(key, u);
  }
  return u;
}

export function genusSpec(id: number): SpriteSpec {
  return spriteSpec(GENERA.get(id)!);
}

// shared animation clock (2 frames)
let frame = 0;
const listeners = new Set<(f: number) => void>();
setInterval(() => {
  frame = 1 - frame;
  listeners.forEach((l) => l(frame));
}, 420);

export function useAnimFrame(enabled = true): number {
  const [f, setF] = useState(frame);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setF);
    return () => { listeners.delete(setF); };
  }, [enabled]);
  return enabled ? f : 0;
}

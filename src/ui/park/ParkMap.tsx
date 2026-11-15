// The park map: one continuous sea with islands, a free camera (drag to pan, wheel to zoom), buildings and enclosures,
// animals walking in their pens, visitors on the paths, click-to-collect bubbles, and every build-mode overlay.

import { useEffect, useRef } from 'react';
import { GENERA } from '../../data/db';
import { FOOD_NAMES, fmt } from '../../game/balance';
import { chunkOf, inside, terrain, Tile } from '../../game/islands';
import { CHUNK, ISLANDS, ISLAND_BY_ID, PLACE_BY_ID } from '../../game/parkContent';
import {
  boughtIslands, canClear, canMove, canPath, canPlace, canPut, collect, defOf, islandCache, isBought, lacksPath, levelOf, moveObject,
  objectsOn, objById, objectRate, place, produces, rectOf, removeObject, setPaths, sizeAt, storeFill, clearChunk, canRemove, animalsIn, enclosures,
} from '../../game/parkmap';
import type { GameState, ParkObject } from '../../game/state';
import { sfx } from '../sound';
import { genusSpec, spriteCanvas } from '../sprites';
import { useStore } from '../store';
import { TS, WATER_DEEP, drawIsland, liftOf, objectArt, penRects } from './art';
import { ZOOM_MAX, ZOOM_MIN, camera, mapApi, pointer, usePark } from './parkUi';

interface Mover { x: number; y: number; tx: number; ty: number; wait: number; dir: number; enc: number; pen: number }
interface Walker { island: number; at: number; to: number; p: number; col: string; speed: number }
interface Floater { x: number; y: number; text: string; color: string; t0: number }
interface Bubble { id: number; x: number; y: number; r: number }
interface Hover { island: number; x: number; y: number }

const SHIRTS = ['#c25a4a', '#4a7fa8', '#e0b04a', '#7aa05a', '#b98be3', '#efe7d3', '#e07a7a'];
const isl = (id: number) => ISLAND_BY_ID.get(id)!;

/** world bounds of everything (with sea around) */
const BOUNDS = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of ISLANDS) { x0 = Math.min(x0, d.wx); y0 = Math.min(y0, d.wy); x1 = Math.max(x1, d.wx + d.w); y1 = Math.max(y1, d.wy + d.h); }
  return { x0: (x0 - 20) * TS, y0: (y0 - 20) * TS, x1: (x1 + 20) * TS, y1: (y1 + 20) * TS };
})();

/** a bubble shows once there is about half a minute of takings (or 4% of the storage) waiting */
function worthCollecting(s: GameState, o: ParkObject): boolean {
  if (o.store < 1) return false;
  return o.store >= objectRate(s, o) * 30 || storeFill(s, o) >= 0.04;
}

function tileAtWorld(wx: number, wy: number): Hover | null {
  for (const d of ISLANDS) {
    const tx = Math.floor(wx / TS) - d.wx, ty = Math.floor(wy / TS) - d.wy;
    if (tx >= 0 && ty >= 0 && tx < d.w && ty < d.h) return { island: d.id, x: tx, y: ty };
  }
  return null;
}

export function ParkMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!, tipEl = tip.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      W = box.clientWidth; H = box.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const terrainCache = new Map<number, { sig: string; c: HTMLCanvasElement }>();
    const movers = new Map<number, Mover>();
    const walkers: Walker[] = [];
    const floaters: Floater[] = [];
    let bubbles: Bubble[] = [];
    let hover: Hover | null = null;
    let mouse = { x: -1, y: -1, in: false };
    let ghost: { ok: boolean; why?: string; x: number; y: number; w: number; h: number; island: number; defId: string; level: number; cost: number } | null = null;

    const S = () => useStore.getState().s;
    const act = <T,>(fn: (s: GameState) => T) => useStore.getState().act(fn);
    const toast = (t: string, k: 'good' | 'bad' | 'info' = 'bad') => useStore.getState().toast(t, k);

    const toScreen = (wx: number, wy: number) => [(wx - camera.x) * camera.z + W / 2, (wy - camera.y) * camera.z + H / 2];
    const toWorld = (sx: number, sy: number) => [(sx - W / 2) / camera.z + camera.x, (sy - H / 2) / camera.z + camera.y];
    const local = (cx: number, cy: number) => { const r = canvas.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };

    const clampCam = () => {
      camera.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.z));
      camera.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, camera.x));
      camera.y = Math.max(BOUNDS.y0, Math.min(BOUNDS.y1, camera.y));
    };
    mapApi.flyTo = (wx, wy, z) => { camera.tx = wx; camera.ty = wy; camera.tz = z ?? Math.max(camera.z, 1.1); };
    mapApi.floatText = (cx, cy, text, color) => { const [sx, sy] = local(cx, cy); const [wx, wy] = toWorld(sx, sy); floaters.push({ x: wx, y: wy, text, color, t0: performance.now() }); };

    // ------------------------------------------------------------ helpers on the current state

    function terrainOf(s: GameState, id: number): HTMLCanvasElement {
      const ic = isBought(s, id) ? islandCache(s, id) : null;
      const cleared = ic ? ic.cleared : terrain(id).startChunks;
      const paths = ic ? ic.paths : new Set<number>();
      const sig = ic ? `${[...cleared].length}|${s.park.paths[id]?.length ?? 0}|${(s.park.paths[id] ?? []).slice(-3).join(',')}|${(s.park.paths[id] ?? [])[0] ?? ''}` : 'locked';
      let e = terrainCache.get(id);
      if (!e || e.sig !== sig) { e = { sig, c: drawIsland(id, cleared, paths, !ic) }; terrainCache.set(id, e); }
      return e.c;
    }

    function penWorld(o: ParkObject) {
      const r = rectOf(o);
      return penRects(r.w, r.h, o.pens ?? 2).map((p) => ({ x: (isl(o.island).wx + r.x + p.x) * TS, y: (isl(o.island).wy + r.y + p.y) * TS, w: p.w * TS, h: p.h * TS }));
    }

    function penAtWorld(s: GameState, wx: number, wy: number): { enc: number; pen: number } | null {
      for (const o of enclosures(s)) {
        const pens = penWorld(o);
        for (let p = 0; p < pens.length; p++) { const r = pens[p]; if (wx >= r.x && wy >= r.y && wx < r.x + r.w && wy < r.y + r.h) return { enc: o.id, pen: p }; }
      }
      return null;
    }
    mapApi.penAt = (cx, cy) => {
      const el = document.elementFromPoint(cx, cy);
      if (el !== canvas) return null;
      const [sx, sy] = local(cx, cy);
      const [wx, wy] = toWorld(sx, sy);
      return penAtWorld(S(), wx, wy);
    };

    function objectAtTile(s: GameState, h: Hover | null): ParkObject | null {
      if (!h || !isBought(s, h.island)) return null;
      const t = terrain(h.island);
      if (!inside(t, h.x, h.y)) return null;
      const id = islandCache(s, h.island).occ[h.y * t.w + h.x];
      return id ? objById(s, id) ?? null : null;
    }

    function animalAt(s: GameState, sx: number, sy: number): number | null {
      if (camera.z < 0.55) return null;
      let best: number | null = null, bestD = 14 * camera.z;
      for (const a of s.animals) {
        const m = movers.get(a.uid);
        if (!m || !a.enc) continue;
        const [ax, ay] = toScreen(m.x, m.y - 8);
        const d = Math.hypot(ax - sx, ay - sy);
        if (d < bestD) { bestD = d; best = a.uid; }
      }
      return best;
    }

    // ------------------------------------------------------------ ghost / hint

    function updateGhost() {
      const s = S();
      const { tool } = usePark.getState();
      ghost = null;
      let hint = '';
      if (!hover || !mouse.in) { tipEl.style.display = 'none'; return; }
      if (tool?.kind === 'place' || tool?.kind === 'move') {
        const o = tool.kind === 'move' ? objById(s, tool.id) : undefined;
        const defId = tool.kind === 'place' ? tool.defId : o?.def;
        if (!defId) return;
        const def = PLACE_BY_ID.get(defId)!;
        const level = o?.level ?? 1;
        const [w, h] = sizeAt(def, level, tool.rot);
        const x = hover.x - Math.floor(w / 2), y = hover.y - Math.floor(h / 2);
        const c = tool.kind === 'move' ? canMove(s, tool.id, hover.island, x, y, tool.rot) : canPlace(s, defId, hover.island, x, y, tool.rot);
        ghost = { ok: c.ok, why: c.why, x, y, w, h, island: hover.island, defId, level, cost: c.cost };
        hint = c.ok ? (c.cost ? `${def.name} · 💰 ${fmt(c.cost)}` : def.name) : c.why ?? '';
      } else if (tool?.kind === 'path' || tool?.kind === 'unpath') {
        const c = canPath(s, hover.island, hover.x, hover.y);
        hint = tool.kind === 'unpath' ? 'Usuń ścieżkę (przeciągnij)' : c.ok ? 'Ścieżka · 💰 5 za pole (przeciągnij)' : c.why ?? '';
      } else if (tool?.kind === 'clear') {
        const t = terrain(hover.island);
        const c = canClear(s, hover.island, chunkOf(t, hover.x, hover.y));
        hint = c.ok ? `Oczyść teren · 💰 ${fmt(c.cost)}` : c.why ?? '';
      } else if (tool?.kind === 'demolish') {
        const o = objectAtTile(s, hover);
        if (o) { const c = canRemove(s, o.id); hint = c.ok ? `Rozbierz: ${defOf(o).name} (zwrot 💰 ${fmt(c.refund)})` : c.why ?? ''; }
      }
      if (hint) {
        tipEl.textContent = hint;
        tipEl.style.display = 'block';
        tipEl.style.left = `${mouse.x + 16}px`;
        tipEl.style.top = `${mouse.y + 18}px`;
        tipEl.className = `map-tip ${ghost && !ghost.ok ? 'bad' : ''}`;
      } else tipEl.style.display = 'none';
    }

    // ------------------------------------------------------------ drawing

    function drawCoin(x: number, y: number, r: number) {
      ctx.fillStyle = '#a26f1d'; ctx.beginPath(); ctx.arc(x, y + 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f9dc8a'; ctx.fillRect(x - r * 0.4, y - r * 0.5, r * 0.3, r * 0.8);
    }

    function drawBubble(s: GameState, o: ParkObject, now: number) {
      const def = defOf(o);
      if (!worthCollecting(s, o)) return;
      const fill = storeFill(s, o);
      const r = rectOf(o);
      const [sx, sy] = toScreen((isl(o.island).wx + r.x + r.w / 2) * TS, (isl(o.island).wy + r.y) * TS - liftOf(def) - 6);
      const full = fill >= 0.98;
      const rad = (full ? 15 : 11 + fill * 3) * Math.min(1.3, Math.max(0.8, camera.z));
      const bob = Math.sin(now / 300 + o.id) * 2;
      const y = sy - rad + bob;
      if (full) { ctx.fillStyle = `rgba(242,193,78,${0.25 + 0.2 * Math.sin(now / 200)})`; ctx.beginPath(); ctx.arc(sx, y, rad + 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#201e17ee'; ctx.beginPath(); ctx.arc(sx, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = full ? '#f2c14e' : '#4d4634'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 4, y + rad - 1); ctx.lineTo(sx, y + rad + 6); ctx.lineTo(sx + 4, y + rad - 1); ctx.fillStyle = '#201e17ee'; ctx.fill();
      if (def.cat === 'farm') {
        const f = def.food![0];
        ctx.fillStyle = f === 'meat' ? '#d0655a' : f === 'plants' ? '#7fbf5a' : '#6db6e0';
        ctx.beginPath(); ctx.ellipse(sx, y, rad * 0.5, rad * 0.38, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff55'; ctx.fillRect(sx - rad * 0.3, y - rad * 0.2, rad * 0.25, rad * 0.12);
      } else drawCoin(sx, y, rad * 0.5);
      bubbles.push({ id: o.id, x: sx, y, r: rad + 4 });
    }

    function drawNoPath(o: ParkObject) {
      const r = rectOf(o);
      const [sx, sy] = toScreen((isl(o.island).wx + r.x + r.w / 2) * TS, (isl(o.island).wy + r.y) * TS - liftOf(defOf(o)));
      const k = Math.max(0.8, Math.min(1.3, camera.z));
      ctx.fillStyle = '#e0735e'; ctx.beginPath(); ctx.arc(sx, sy - 12 * k, 9 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(13 * k)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', sx, sy - 12 * k + 1);
      if (camera.z > 0.8) { ctx.font = `800 ${Math.round(11 * k)}px Nunito, sans-serif`; ctx.fillStyle = '#ffd2c8'; ctx.fillText('brak ścieżki', sx, sy - 26 * k); }
    }

    function drawAnimals(s: GameState, o: ParkObject, now: number, dt: number) {
      const here = animalsIn(s, o.id);
      if (!here.length) return;
      const pens = penWorld(o);
      const frame = Math.floor(now / 420) % 2;
      const list = here.map((a) => {
        let m = movers.get(a.uid);
        const p = pens[a.pen] ?? pens[0];
        const rnd = () => [p.x + 6 + Math.random() * Math.max(1, p.w - 12), p.y + 10 + Math.random() * Math.max(1, p.h - 14)];
        if (!m || m.enc !== o.id || m.pen !== a.pen) {
          const [x, y] = rnd();
          m = { x, y, tx: x, ty: y, wait: Math.random() * 2, dir: Math.random() < 0.5 ? -1 : 1, enc: o.id, pen: a.pen };
          movers.set(a.uid, m);
        }
        if (m.wait > 0) m.wait -= dt;
        else {
          const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
          if (d < 1) { m.wait = 1 + Math.random() * 4; [m.tx, m.ty] = rnd(); }
          else { const v = 7 * dt; m.x += (dx / d) * Math.min(v, d); m.y += (dy / d) * Math.min(v, d); if (Math.abs(dx) > 0.5) m.dir = dx < 0 ? -1 : 1; }
        }
        return { a, m };
      }).sort((p, q) => p.m.y - q.m.y);
      const sel = usePark.getState().sel;
      for (const { a, m } of list) {
        const sc = spriteCanvas(genusSpec(a.genusId), a.stage, m.wait <= 0 ? frame : 0);
        const k = 0.5 * camera.z;
        const w = sc.width * k, h = sc.height * k;
        const [sx, sy] = toScreen(m.x, m.y);
        if (sx < -w || sx > W + w || sy < -h || sy > H + h) continue;
        if (sel?.kind === 'animal' && sel.uid === a.uid) { ctx.fillStyle = '#ffd86699'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.45, 4 * camera.z, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.32, 2.5 * camera.z, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.save();
        ctx.translate(sx, sy - h);
        if (m.dir < 0) { ctx.scale(-1, 1); ctx.drawImage(sc, -w / 2, 0, w, h); } else ctx.drawImage(sc, -w / 2, 0, w, h);
        ctx.restore();
      }
    }

    function stepWalkers(s: GameState, dt: number) {
      for (const id of boughtIslands(s)) {
        const conn = [...islandCache(s, id).conn];
        const animals = objectsOn(s, id).reduce((n, o) => n + (defOf(o).cat === 'enclosure' ? animalsIn(s, o.id).length : 0), 0);
        const want = conn.length < 4 ? 0 : Math.min(40, 2 + animals * 2);
        const mine = walkers.filter((w) => w.island === id);
        for (let k = mine.length; k < want; k++) {
          const at = conn[Math.floor(Math.random() * conn.length)];
          walkers.push({ island: id, at, to: at, p: 1, col: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], speed: 1.2 + Math.random() });
        }
        if (mine.length > want) for (const w of mine.slice(want)) walkers.splice(walkers.indexOf(w), 1);
      }
      for (const w of walkers) {
        const ic = islandCache(s, w.island);
        if (!ic.conn.has(w.at)) { const c = [...ic.conn]; if (!c.length) continue; w.at = w.to = c[Math.floor(Math.random() * c.length)]; }
        w.p += w.speed * dt;
        if (w.p >= 1) {
          w.at = w.to; w.p = 0;
          const t = terrain(w.island);
          const x = w.at % t.w, y = (w.at - x) / t.w;
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (y + dy) * t.w + x + dx).filter((j) => ic.conn.has(j));
          w.to = nb.length ? nb[Math.floor(Math.random() * nb.length)] : w.at;
        }
      }
    }

    function drawWalkers() {
      if (camera.z < 0.6) return;
      for (const w of walkers) {
        const t = terrain(w.island);
        const ax = w.at % t.w, ay = (w.at - ax) / t.w, bx = w.to % t.w, by = (w.to - bx) / t.w;
        const x = (isl(w.island).wx + ax + (bx - ax) * w.p + 0.5) * TS + ((w.at * 7) % 7) - 3;
        const y = (isl(w.island).wy + ay + (by - ay) * w.p + 0.5) * TS + ((w.at * 3) % 5) - 2;
        const [sx, sy] = toScreen(x, y);
        if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;
        const k = camera.z;
        ctx.fillStyle = '#00000033'; ctx.fillRect(sx - 1.5 * k, sy, 3 * k, 1 * k);
        ctx.fillStyle = w.col; ctx.fillRect(sx - 1.5 * k, sy - 4 * k, 3 * k, 3 * k);
        ctx.fillStyle = '#e8c9a0'; ctx.fillRect(sx - 1 * k, sy - 6 * k, 2 * k, 2 * k);
        ctx.fillStyle = '#3a3226'; ctx.fillRect(sx - 1.5 * k, sy - 1 * k, 1 * k, 1 * k); ctx.fillRect(sx + 0.5 * k, sy - 1 * k, 1 * k, 1 * k);
      }
    }

    let last = performance.now();
    let raf = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = S();
      const ui = usePark.getState();
      // fly
      if (!Number.isNaN(camera.tx)) {
        const k = 1 - Math.pow(0.002, dt);
        camera.x += (camera.tx - camera.x) * k; camera.y += (camera.ty - camera.y) * k; camera.z += (camera.tz - camera.z) * k;
        if (Math.abs(camera.tx - camera.x) < 1 && Math.abs(camera.ty - camera.y) < 1 && Math.abs(camera.tz - camera.z) < 0.01) camera.tx = camera.ty = camera.tz = NaN;
      }
      // keyboard pan
      const v = 600 / camera.z * dt;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) camera.x -= v;
      if (keys.has('KeyD') || keys.has('ArrowRight')) camera.x += v;
      if (keys.has('KeyW') || keys.has('ArrowUp')) camera.y -= v;
      if (keys.has('KeyS') || keys.has('ArrowDown')) camera.y += v;
      clampCam();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = WATER_DEEP;
      ctx.fillRect(0, 0, W, H);
      // sea sparkle
      if (camera.z > 0.25) {
        ctx.fillStyle = '#2c6487';
        const step = 64;
        const [wx0, wy0] = toWorld(0, 0), [wx1, wy1] = toWorld(W, H);
        for (let gy = Math.floor(wy0 / step) * step; gy < wy1; gy += step) for (let gx = Math.floor(wx0 / step) * step; gx < wx1; gx += step) {
          const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
          const ph = (now / 1600 + (h % 100) / 100) % 1;
          const [sx, sy] = toScreen(gx + (h % 40), gy + ((h >> 8) % 40));
          ctx.globalAlpha = Math.sin(ph * Math.PI);
          ctx.fillRect(sx, sy, 8 * camera.z, Math.max(1, camera.z));
        }
        ctx.globalAlpha = 1;
      }
      // islands
      for (const d of ISLANDS) {
        const [sx, sy] = toScreen(d.wx * TS, d.wy * TS);
        const w = d.w * TS * camera.z, h = d.h * TS * camera.z;
        if (sx > W || sy > H || sx + w < 0 || sy + h < 0) continue;
        ctx.drawImage(terrainOf(s, d.id), sx, sy, w, h);
      }
      // build grid
      if (ui.build && camera.z > 0.5) {
        ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 1;
        for (const id of boughtIslands(s)) {
          const d = isl(id);
          const [sx, sy] = toScreen(d.wx * TS, d.wy * TS);
          ctx.beginPath();
          for (let x = 0; x <= d.w; x++) { ctx.moveTo(sx + x * TS * camera.z, sy); ctx.lineTo(sx + x * TS * camera.z, sy + d.h * TS * camera.z); }
          for (let y = 0; y <= d.h; y++) { ctx.moveTo(sx, sy + y * TS * camera.z); ctx.lineTo(sx + d.w * TS * camera.z, sy + y * TS * camera.z); }
          ctx.stroke();
        }
      }
      // clearable chunks
      if (ui.tool?.kind === 'clear') {
        for (const id of boughtIslands(s)) {
          const t = terrain(id);
          for (const c of t.landChunks) {
            const cc = canClear(s, id, c);
            if (cc.why === 'Już oczyszczone' || cc.why?.startsWith('Oczyszczaj')) continue;
            const cx = (c % t.cw) * CHUNK, cy = Math.floor(c / t.cw) * CHUNK;
            const [sx, sy] = toScreen((isl(id).wx + cx) * TS, (isl(id).wy + cy) * TS);
            const sz = CHUNK * TS * camera.z;
            const hov = hover && hover.island === id && chunkOf(t, hover.x, hover.y) === c;
            ctx.fillStyle = hov ? (cc.ok ? '#8bb04f66' : '#e0735e55') : '#f2c14e22';
            ctx.fillRect(sx, sy, sz, sz);
            ctx.strokeStyle = cc.ok ? '#f2c14e' : '#e0735e'; ctx.setLineDash([4, 3]); ctx.strokeRect(sx + 1, sy + 1, sz - 2, sz - 2); ctx.setLineDash([]);
          }
        }
      }
      // objects (back to front)
      const objs = s.park.objects.filter((o) => isBought(s, o.island)).map((o) => ({ o, r: rectOf(o) })).sort((a, b) => a.r.y + a.r.h + isl(a.o.island).wy - (b.r.y + b.r.h + isl(b.o.island).wy));
      const moving = ui.tool?.kind === 'move' ? ui.tool.id : -1;
      const hoverObj = objectAtTile(s, hover);
      bubbles = [];
      for (const { o, r } of objs) {
        const def = defOf(o);
        const lift = liftOf(def);
        const [sx, sy] = toScreen((isl(o.island).wx + r.x) * TS, (isl(o.island).wy + r.y) * TS - lift);
        const w = r.w * TS * camera.z, h = (r.h * TS + lift) * camera.z;
        if (sx > W || sy > H || sx + w < 0 || sy + h < 0) continue;
        ctx.globalAlpha = o.id === moving ? 0.35 : 1;
        ctx.drawImage(objectArt(def, { level: levelOf(s, o), w: r.w, h: r.h, pens: o.pens, decor: o.decor, seed: o.id }), sx, sy, w, h);
        ctx.globalAlpha = 1;
        if (def.cat === 'enclosure' && camera.z > 0.3) drawAnimals(s, o, now, dt);
        const selected = ui.sel?.kind === 'obj' && ui.sel.id === o.id;
        const demolishHover = ui.tool?.kind === 'demolish' && hoverObj?.id === o.id;
        if (selected || demolishHover || (ui.build && !ui.tool && hoverObj?.id === o.id)) {
          const [fx, fy] = toScreen((isl(o.island).wx + r.x) * TS, (isl(o.island).wy + r.y) * TS);
          ctx.strokeStyle = demolishHover ? '#e0735e' : '#f2c14e'; ctx.lineWidth = 2;
          ctx.strokeRect(fx - 1, fy - 1, r.w * TS * camera.z + 2, r.h * TS * camera.z + 2);
          if (demolishHover) { ctx.fillStyle = '#e0735e33'; ctx.fillRect(fx, fy, r.w * TS * camera.z, r.h * TS * camera.z); }
        }
      }
      stepWalkers(s, dt);
      drawWalkers();
      // pens while dragging an animal
      if (ui.drag !== null && camera.z > 0.3) {
        const [px, py] = local(pointer.x, pointer.y);
        const [wx, wy] = toWorld(px, py);
        const at = penAtWorld(s, wx, wy);
        for (const o of enclosures(s)) {
          if (defOf(o).habitat !== GENERA.get(s.animals.find((a) => a.uid === ui.drag)?.genusId ?? -1)?.habitat) continue;
          penWorld(o).forEach((p, k) => {
            const ok = canPut(s, ui.drag!, o.id, k).ok;
            const [sx, sy] = toScreen(p.x, p.y);
            const strong = at?.enc === o.id && at.pen === k;
            ctx.fillStyle = ok ? (strong ? '#8bb04f88' : '#8bb04f33') : (strong ? '#e0735e77' : '#e0735e22');
            ctx.fillRect(sx, sy, p.w * camera.z, p.h * camera.z);
          });
        }
        if (at) {
          const c = canPut(s, ui.drag, at.enc, at.pen);
          tipEl.textContent = c.ok ? `Zagroda ${at.pen + 1}: upuść tutaj` : c.why ?? '';
          tipEl.className = `map-tip ${c.ok ? '' : 'bad'}`;
          tipEl.style.display = 'block'; tipEl.style.left = `${px + 18}px`; tipEl.style.top = `${py + 22}px`;
        } else tipEl.style.display = 'none';
      }
      // ghost of the thing being placed
      if (ghost) {
        const g = ghost;
        const def = PLACE_BY_ID.get(g.defId)!;
        const [sx, sy] = toScreen((isl(g.island).wx + g.x) * TS, (isl(g.island).wy + g.y) * TS);
        ctx.fillStyle = g.ok ? '#8bb04f55' : '#e0735e55';
        ctx.fillRect(sx, sy, g.w * TS * camera.z, g.h * TS * camera.z);
        ctx.globalAlpha = 0.7;
        const lift = liftOf(def);
        ctx.drawImage(objectArt(def, { level: g.level, w: g.w, h: g.h, pens: def.cat === 'enclosure' ? 2 : undefined, seed: 1 }), sx, sy - lift * camera.z, g.w * TS * camera.z, (g.h * TS + lift) * camera.z);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g.ok ? '#b6e07a' : '#ff8a70'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, g.w * TS * camera.z, g.h * TS * camera.z);
      }
      // path brush
      if ((ui.tool?.kind === 'path' || ui.tool?.kind === 'unpath') && hover && mouse.in) {
        const [sx, sy] = toScreen((isl(hover.island).wx + hover.x) * TS, (isl(hover.island).wy + hover.y) * TS);
        const ok = ui.tool.kind === 'unpath' || canPath(s, hover.island, hover.x, hover.y).ok;
        ctx.strokeStyle = ok ? '#f2c14e' : '#e0735e'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, TS * camera.z, TS * camera.z);
      }
      // bubbles, warnings, labels
      if (camera.z >= 0.4) {
        for (const { o } of objs) {
          if (produces(o)) drawBubble(s, o, now);
          if (lacksPath(s, o)) drawNoPath(o);
        }
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const d of ISLANDS) {
        const bought = isBought(s, d.id);
        if (bought && camera.z >= 0.45) continue;
        const [sx, sy] = toScreen((d.wx + d.w / 2) * TS, (d.wy + d.h / 2) * TS);
        if (sx < -200 || sy < -100 || sx > W + 200 || sy > H + 100) continue;
        const pending = bought && objectsOn(s, d.id).some((o) => produces(o) && storeFill(s, o) > 0.25);
        const label = bought ? d.name : `🔒 ${d.name}`;
        const sub = bought ? (pending ? 'jest co zebrać — kliknij, by przybliżyć' : '') : `poz. ${d.level} · 💰 ${fmt(d.cost)}`;
        ctx.font = '900 15px Nunito, sans-serif';
        const tw = Math.max(ctx.measureText(label).width, sub ? ctx.measureText(sub).width * 0.85 : 0) + 24;
        ctx.fillStyle = '#14130ee6'; ctx.beginPath(); ctx.roundRect(sx - tw / 2, sy - 16, tw, sub ? 40 : 28, 9); ctx.fill();
        ctx.strokeStyle = pending ? '#f2c14e' : '#4d4634'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = bought ? '#efe7d3' : '#ada189'; ctx.fillText(label, sx, sy - 2);
        if (sub) { ctx.font = '800 12px Nunito, sans-serif'; ctx.fillStyle = pending ? '#f2c14e' : '#ada189'; ctx.fillText(sub, sx, sy + 15); }
      }
      // floating texts
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        const t = (now - f.t0) / 1200;
        if (t >= 1) { floaters.splice(i, 1); continue; }
        const [sx, sy] = toScreen(f.x, f.y);
        ctx.globalAlpha = 1 - t * t;
        ctx.font = '900 16px Nunito, sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = '#14130e'; ctx.strokeText(f.text, sx, sy - t * 40);
        ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy - t * 40);
        ctx.globalAlpha = 1;
      }
    }
    raf = requestAnimationFrame(frame);

    // ------------------------------------------------------------ input

    const keys = new Set<string>();
    const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    const onKey = (e: KeyboardEvent) => { if (!typing()) keys.add(e.code); };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    const onBlur = () => keys.clear();
    window.addEventListener('blur', onBlur);

    let down: { x: number; y: number; button: number; panning: boolean; cam: [number, number]; animal: number | null; painted: Set<string> } | null = null;
    let lastPaint: Hover | null = null;

    function setHover(sx: number, sy: number) {
      const [wx, wy] = toWorld(sx, sy);
      hover = tileAtWorld(wx, wy);
      updateGhost();
    }

    function paintTo(h: Hover) {
      const ui = usePark.getState();
      const on = ui.tool?.kind === 'path';
      const tiles: [number, number][] = [];
      // straight line from the last painted tile (no gaps when the mouse moves fast)
      const from = lastPaint && lastPaint.island === h.island ? lastPaint : h;
      const n = Math.max(Math.abs(h.x - from.x), Math.abs(h.y - from.y));
      for (let k = 0; k <= n; k++) tiles.push([Math.round(from.x + ((h.x - from.x) * k) / Math.max(1, n)), Math.round(from.y + ((h.y - from.y) * k) / Math.max(1, n))]);
      lastPaint = h;
      const before = S().coins;
      const changed = act((s) => setPaths(s, h.island, tiles, on));
      if (on && changed === 0 && S().coins < 5 && before < 5) toast('Za mało monet na ścieżkę');
    }

    const onDown = (e: PointerEvent) => {
      const [sx, sy] = local(e.clientX, e.clientY);
      canvas.setPointerCapture(e.pointerId);
      const ui = usePark.getState();
      const s = S();
      const animal = e.button === 0 && !ui.build ? animalAt(s, sx, sy) : null;
      down = { x: sx, y: sy, button: e.button, panning: e.button !== 0, cam: [camera.x, camera.y], animal, painted: new Set() };
      camera.tx = camera.ty = camera.tz = NaN;
      if (e.button === 0 && (ui.tool?.kind === 'path' || ui.tool?.kind === 'unpath')) {
        setHover(sx, sy);
        lastPaint = null;
        if (hover) paintTo(hover);
      }
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      const [sx, sy] = local(e.clientX, e.clientY);
      mouse = { x: sx, y: sy, in: true };
      setHover(sx, sy);
      if (!down) return;
      const ui = usePark.getState();
      const moved = Math.hypot(sx - down.x, sy - down.y);
      if (down.button === 0 && (ui.tool?.kind === 'path' || ui.tool?.kind === 'unpath')) { if (hover) paintTo(hover); return; }
      if (down.animal !== null && moved > 6 && ui.drag === null) {
        startAnimalDrag(down.animal);
        down = null;
        return;
      }
      if (!down.panning && moved > 4) down.panning = true;
      if (down.panning) {
        camera.x = down.cam[0] - (sx - down.x) / camera.z;
        camera.y = down.cam[1] - (sy - down.y) / camera.z;
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      lastPaint = null;
      if (!d || d.panning) return;
      const ui = usePark.getState();
      if (d.button === 0 && (ui.tool?.kind === 'path' || ui.tool?.kind === 'unpath')) return;
      const [sx, sy] = local(e.clientX, e.clientY);
      if (d.button === 2 && ui.tool) { usePark.getState().setTool(null); return; }
      if (d.button !== 0) return;
      click(sx, sy, e.clientX, e.clientY);
    };

    function click(sx: number, sy: number, cx: number, cy: number) {
      const s = S();
      const ui = usePark.getState();
      setHover(sx, sy);
      const h = hover;
      // far away: an island label flies there
      if (camera.z < 0.45 && h) { const d = isl(h.island); mapApi.flyTo!((d.wx + d.w / 2) * TS, (d.wy + d.h / 2) * TS, 1.2); if (!isBought(s, h.island)) ui.select({ kind: 'island', id: h.island }); return; }
      const tool = ui.tool;
      if (tool?.kind === 'place' && ghost) {
        if (!ghost.ok) { toast(ghost.why ?? 'Nie można tu postawić'); return; }
        const o = act((st) => place(st, ghost!.defId, ghost!.island, ghost!.x, ghost!.y, tool.rot));
        if (o) {
          sfx.land();
          const def = PLACE_BY_ID.get(tool.defId)!;
          if (def.cat !== 'decor') { ui.setTool(null); ui.select({ kind: 'obj', id: o.id }); }
          mapApi.floatText!(cx, cy, `−${fmt(ghost.cost)}`, '#f2c14e');
        }
        return;
      }
      if (tool?.kind === 'move' && ghost) {
        if (!ghost.ok) { toast(ghost.why ?? 'Nie można tu przenieść'); return; }
        act((st) => moveObject(st, tool.id, ghost!.island, ghost!.x, ghost!.y, tool.rot));
        sfx.land();
        ui.setTool(null);
        ui.select({ kind: 'obj', id: tool.id });
        return;
      }
      if (tool?.kind === 'clear' && h) {
        const t = terrain(h.island);
        const c = canClear(s, h.island, chunkOf(t, h.x, h.y));
        if (!c.ok) { toast(c.why ?? 'Nie można'); return; }
        act((st) => clearChunk(st, h.island, chunkOf(t, h.x, h.y)));
        sfx.crumble(true);
        mapApi.floatText!(cx, cy, `−${fmt(c.cost)}`, '#f2c14e');
        return;
      }
      if (tool?.kind === 'demolish') {
        const o = objectAtTile(s, h);
        if (!o) return;
        const c = canRemove(s, o.id);
        if (!c.ok) { toast(c.why ?? 'Nie można'); return; }
        const n = animalsIn(s, o.id).length;
        if (!confirm(`Rozebrać: ${defOf(o).name}?${n ? ` ${n} zwierząt trafi do Transportera.` : ''} Zwrot: ${fmt(c.refund)} monet.`)) return;
        act((st) => removeObject(st, o.id));
        sfx.boom(false);
        if (ui.sel?.kind === 'obj' && ui.sel.id === o.id) ui.select(null);
        return;
      }
      // collect bubbles first
      for (const b of bubbles) {
        if (Math.hypot(b.x - sx, b.y - sy) <= b.r) {
          const o = objById(s, b.id)!;
          const got = act((st) => collect(st, b.id));
          if (got) {
            if (got.coins) { mapApi.floatText!(cx, cy, `+${fmt(got.coins)}`, '#f2c14e'); sfx.loot(1, 0); }
            if (got.food) for (const [f, n] of Object.entries(got.food)) { mapApi.floatText!(cx, cy - 18, `+${fmt(n!)} ${FOOD_NAMES[f as keyof typeof FOOD_NAMES].toLowerCase()}`, '#9fd47a'); sfx.loot(1, 0); break; }
          }
          if (ui.build && !ui.tool) ui.setTool({ kind: 'move', id: o.id, rot: o.rot });
          return;
        }
      }
      // animals
      const uid = !ui.build ? animalAt(s, sx, sy) : null;
      if (uid !== null) { ui.select({ kind: 'animal', uid }); return; }
      const o = objectAtTile(s, h);
      if (o) {
        if (ui.build && !tool && !defOf(o).fixed) { ui.setTool({ kind: 'move', id: o.id, rot: o.rot }); return; }
        if (!ui.build && produces(o) && worthCollecting(s, o)) {
          const got = act((st) => collect(st, o.id));
          if (got?.coins) { mapApi.floatText!(cx, cy, `+${fmt(got.coins)}`, '#f2c14e'); sfx.loot(1, 0); }
          if (got?.food) for (const [f, n] of Object.entries(got.food)) { mapApi.floatText!(cx, cy, `+${fmt(n!)} ${FOOD_NAMES[f as keyof typeof FOOD_NAMES].toLowerCase()}`, '#9fd47a'); sfx.loot(1, 0); break; }
        }
        ui.select({ kind: 'obj', id: o.id });
        return;
      }
      if (h && !isBought(s, h.island)) { ui.select({ kind: 'island', id: h.island }); return; }
      if (h && isBought(s, h.island)) {
        const t = terrain(h.island);
        if (t.tiles[h.y * t.w + h.x] >= Tile.Sand && !islandCache(s, h.island).cleared.has(chunkOf(t, h.x, h.y))) { ui.select({ kind: 'chunk', island: h.island, chunk: chunkOf(t, h.x, h.y) }); return; }
      }
      ui.select(null);
    }

    const onDbl = (e: MouseEvent) => {
      const [sx, sy] = local(e.clientX, e.clientY);
      setHover(sx, sy);
      const o = objectAtTile(S(), hover);
      if (o && defOf(o).cat === 'enclosure' && !usePark.getState().build) usePark.getState().setInterior(o.id);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.tx = camera.ty = camera.tz = NaN;
      const [sx, sy] = local(e.clientX, e.clientY);
      const [wx, wy] = toWorld(sx, sy);
      const k = Math.pow(1.0015, -e.deltaY);
      camera.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.z * k));
      // keep the point under the cursor in place
      camera.x = wx - (sx - W / 2) / camera.z;
      camera.y = wy - (sy - H / 2) / camera.z;
      clampCam();
    };
    const onLeave = () => { mouse.in = false; hover = null; updateGhost(); };
    const onCtx = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onCtx);
    const unsub = usePark.subscribe(() => updateGhost());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onCtx);
      delete mapApi.flyTo; delete mapApi.penAt; delete mapApi.floatText;
    };
  }, []);

  return (
    <div ref={wrap} className="park-map">
      <canvas ref={cv} className="pixel" />
      <div ref={tip} className="map-tip" style={{ display: 'none' }} />
    </div>
  );
}

// ---------------------------------------------------------------- dragging animals (from the map, the Transporter, lists, pens)

/** start dragging an animal: a ghost follows the cursor; dropping on a pen moves it there */
export function startAnimalDrag(uid: number) {
  const ui = usePark.getState();
  const s = useStore.getState().s;
  const a = s.animals.find((x) => x.uid === uid);
  if (!a) return;
  ui.setDrag(uid);
  const ghost = document.createElement('img');
  ghost.className = 'drag-ghost pixel';
  const sc = spriteCanvas(genusSpec(a.genusId), a.stage, 0);
  ghost.src = sc.toDataURL();
  ghost.width = sc.width * 1.5;
  ghost.height = sc.height * 1.5;
  document.body.appendChild(ghost);
  const place = (x: number, y: number) => { ghost.style.left = `${x - ghost.width / 2}px`; ghost.style.top = `${y - ghost.height + 8}px`; };
  place(pointer.x, pointer.y);
  const move = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; place(e.clientX, e.clientY); };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    ghost.remove();
    usePark.getState().setDrag(null);
    dropAnimal(uid, e.clientX, e.clientY);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function dropAnimal(uid: number, cx: number, cy: number) {
  const st = useStore.getState();
  const el = document.elementFromPoint(cx, cy)?.closest('[data-drop]') as HTMLElement | null;
  let target: { enc: number; pen: number } | null = null;
  if (el?.dataset.drop === 'transport') {
    st.act((s) => { const a = s.animals.find((x) => x.uid === uid); if (a) { a.enc = 0; a.pen = 0; } });
    return;
  }
  if (el?.dataset.drop === 'pen') target = { enc: Number(el.dataset.enc), pen: Number(el.dataset.pen) };
  else target = mapApi.penAt?.(cx, cy) ?? null;
  if (!target) return;
  const c = canPut(st.s, uid, target.enc, target.pen);
  if (!c.ok) { st.toast(c.why ?? 'Nie można', 'bad'); return; }
  st.act((s) => { const a = s.animals.find((x) => x.uid === uid)!; a.enc = target!.enc; a.pen = target!.pen; });
  sfx.land();
}

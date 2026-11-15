import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bone, Check, ChevronDown, ChevronRight, Clock, Coins, Flame, Hammer, Layers, Lock, Map as MapIcon, Maximize2,
  Microscope, Minimize2, Paintbrush, Pickaxe, Radar, Shell, Sparkles, Users, Archive, Volume2, VolumeX, Wrench, Bomb, Hexagon,
} from 'lucide-react';
import { genusSpec, spriteUrl } from '../sprites';
import { Particles } from '../particles';
import { setVolume, sfx } from '../sound';
import { GENERA, SITE_BY_ID } from '../../data/db';
import { B, QUALITY_NAMES, RARITY_COLORS, RARITY_NAMES, fmt } from '../../game/balance';
import {
  CHEST_NAMES, blastCharge, chargeCells, claimGolden, crewMode, depthMeters, fossilRarityOdds, hammerCells, hammerRisk, hitTile, layerReward, layerShards, mineralChanceAt, qualityOddsAt, siteState,
} from '../../game/dig';
import { Workshop } from '../dig/Workshop';
import { ChestArt, ChestModal, TIER_COLOR } from '../dig/Chest';
import { COMMON_MINERALS, MINERALS, MINERAL_BY_ID, type Mineral, siteMinerals, strataFrom, stratumAt } from '../../game/geology';
import { mods, type Mods } from '../../game/mods';
import { bankCap, collectBank, incomePerSec } from '../../game/park';
import type { CrewMode, FindEntry, GameState, ItemKind, LayerItem, PendingChest, SiteState } from '../../game/state';
import { periodLabel } from '../../data/geotime';
import { GLOW_CSS, GW, GH, TS, type LayerArt, artFor, cachedArt, drawFrame, echoNear, iconUrl, itemUrl, radarZones } from '../dig/art';
import { Bar, Btn, SpriteImg } from '../components';
import { useGame, useStore } from '../store';
import { WorldMap } from './WorldMap';

interface Snap { key: string; site: string; hp: number[]; found: boolean[]; items: LayerItem[] }
const snapOf = (key: string, site: string, st: SiteState): Snap => ({ key, site, hp: st.tiles.map((t) => t.hp), found: st.items.map((i) => i.found), items: st.items });

const QUALITY_COLORS = ['#9a8f80', '#c9d3dc', '#f2c14e'];
const KIND_COLOR: Record<ItemKind, string> = { fossil: '#eaa63a', minor: '#8fc7e8', amber: '#ff9d2e', mineral: '#c79bff' };
const DUST = ['#5a4936', '#6d5a44', '#87715a', '#a08a70', '#4a3c2c'];
const COLS = 'ABCDEFGHIJ';
/** rarity names agreeing with „kość” (feminine) */
const RARITY_F = ['Pospolita', 'Rzadka', 'Bardzo rzadka', 'Legendarna'];
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const tileName = (i: number) => `${COLS[i % B.gridW]}${Math.floor(i / B.gridW) + 1}`;
const pct = (x: number) => `${x < 0.01 && x > 0 ? '<1' : Math.round(x * 100)}%`;
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
const hardness = (depth: number) => B.tileHpExp ** depth * (1 + depth * B.tileHpPerDepth);

/** pixel icon of a minor find / amber / mineral */
const smallIcon = (it: { kind: ItemKind; minorName?: string; mineralId?: string }, scale = 2) =>
  it.kind === 'mineral' ? iconUrl('mineral', it.mineralId ?? 'kwarc', scale) : iconUrl(it.kind === 'amber' ? 'amber' : 'minor', it.kind === 'minor' ? (it.minorName?.length ?? 0) % 4 : 0, scale);

/** stash order: the order things were dug out */
type FoundOrder = WeakMap<LayerItem, number>;
const stashList = (items: LayerItem[], ord: FoundOrder) =>
  items.map((it, i) => ({ it, r: ord.get(it) ?? i - 1e6 })).filter((x) => x.it.found).sort((a, b) => a.r - b.r).map((x) => x.it);

// ---------------------------------------------------------------- dig rhythm (upgrade): streak → multiplier → fever
interface Combo { n: number; last: number; feverUntil: number; coolUntil: number; best: number }
const STREAK_WINDOW = 500;
const FEVER_AT = 30;
const FEVER_COOLDOWN = 3000;
const comboMult = (n: number, lvl: number) => (!lvl || n < 10 ? 1 : n < 20 ? 1 + 0.5 * lvl : 1 + lvl);
/** streak after idling: kept for 0.5 s, then fades by a quarter every 0.5 s, gone after 1.5 s */
function streakNow(c: Combo, now: number): number {
  const idle = now - c.last;
  if (idle <= STREAK_WINDOW) return c.n;
  if (idle >= 1500) return 0;
  return Math.floor(c.n * (idle < 1000 ? 0.75 : 0.5));
}

/** re-render every `ms` (small live readouts driven by refs) */
function useTicker(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function ComboPill({ combo, m, openShop }: { combo: React.MutableRefObject<Combo>; m: Mods; openShop: () => void }) {
  useTicker(100);
  if (!m.combo) {
    return (
      <button className="combo locked" onClick={openShop} title="Seria i trafienia krytyczne to ulepszenia pędzla (Warsztat → Pędzel → Precyzyjny ruch, Rytm, Gorączka)">
        <Lock className="ic" /><span className="note">{m.critBrush ? `Krytyk ${pct(m.critBrush)} · seria: odblokuj „Rytm”` : 'Krytyki i serie: odblokuj w Warsztacie'}</span>
      </button>
    );
  }
  const c = combo.current;
  const now = performance.now();
  const fever = now < c.feverUntil;
  const n = streakNow(c, now);
  const mult = comboMult(n, m.combo);
  const lit = fever ? Math.ceil(((c.feverUntil - now) / (m.feverSec * 1000)) * 10) : Math.min(10, Math.floor(n / 3));
  return (
    <div className={`combo ${fever ? 'fever' : ''} ${n >= 20 ? 'm3' : ''}`} title={`Klikaj szybko i równo (co najmniej 2 razy na sekundę): seria mnoży szansę na krytyk.${m.feverSec ? ' Pełna seria (30) włącza Gorączkę.' : ''}`}>
      <span className="muted">{fever ? 'Gorączka' : 'Seria'}</span>
      <span className="mult">{fever ? <Flame className="ic" style={{ width: 20, height: 20 }} /> : `×${mult}`}</span>
      <span className="segs">{Array.from({ length: 10 }, (_, k) => <i key={k} className={k < lit ? 'on' : ''} />)}</span>
      <span className="note">{fever ? `${((c.feverUntil - now) / 1000).toFixed(1)} s · same krytyki` : n > 0 && now - c.last > STREAK_WINDOW ? 'gaśnie…' : `kryt. ${pct(Math.min(1, m.critBrush * mult))}`}</span>
    </div>
  );
}

interface Live { s: GameState; st: SiteState; art: LayerArt; m: Mods }
interface HoverRef { idx: number; px: [number, number] | null }
interface Flight { it: LayerItem; items: LayerItem[] }
interface Glow { shown: number; open: number; flashUntil: number }
interface Golden { idx: number; until: number; next: number; items: LayerItem[] | null }
interface Msg { kind: 'hint' | 'rare1' | 'rare2' | 'rare3' | 'good' | 'fever'; text: string; sub?: string; until: number; icon?: 'bone' | 'sparkles' | 'flame' | 'check' }
interface ChestPop { chest: PendingChest; until: number }
const nextGolden = (now: number, every = 1) => now + (60 + Math.random() * 120) * 1000 * every;

/** tooltip next to the tile under the cursor */
function TileTip({ live, hover, golden, scale }: { live: React.MutableRefObject<Live>; hover: React.MutableRefObject<HoverRef>; golden: React.MutableRefObject<Golden>; scale: number }) {
  useTicker(100);
  const { s, st, art, m } = live.current;
  const i = hover.current.idx;
  if (i < 0 || !st.tiles[i]) return null;
  const t = st.tiles[i];
  const it = t.item >= 0 ? st.items[t.item] : null;
  const lines: React.ReactNode[] = [];
  let title = art.tileRock[i];
  const hammer = s.settings.tool === 'hammer' && m.hammer;
  const power = hammer ? m.hammerPower : m.brushPower;
  if (t.hp > 0) {
    const hits = Math.ceil(t.hp / power);
    lines.push(<span key="h">{tileName(i)} · twardość ×{hardness(st.depth).toFixed(2)} · {hits} {plural(hits, 'uderzenie', 'uderzenia', 'uderzeń')} {hammer ? 'młotem' : 'pędzlem'}</span>);
    if (golden.current.idx === i) lines.push(<span key="g" className="gold">Złoty błysk — kliknij po nagrodę!</span>);
    if (st.burns?.some((b) => b.tile === i)) lines.push(<span key="b" style={{ color: '#ffa860' }}>Tli się — samo słabnie</span>);
    if (it && !it.found && it.cells.some((c) => st.tiles[c].hp <= 0)) lines.push(<span key="p" className="gold">Tu leży dalsza część kości</span>);
    else if (m.scanner >= 3 && it && !it.found && radarZones(st, m.scanner).some((z) => z.item === t.item)) lines.push(<span key="s" style={{ color: KIND_COLOR[it.kind] }}>Georadar: {it.kind === 'fossil' ? 'kość' : it.kind === 'minor' ? 'drobna skamieniałość' : it.kind === 'amber' ? 'bursztyn' : 'minerał'}</span>);
    else if (m.scanner && radarZones(st, m.scanner).some((z) => z.tiles.has(i) && !st.items[z.item].found)) lines.push(<span key="s" className="blue">Georadar: {m.scanner >= 3 ? 'echo tuż obok' : 'coś leży w tej okolicy'}</span>);
    if (hammer && hammerCells(st, i, m.hammerSquare).some((c) => hammerRisk(st, c, i, m))) lines.push(<span key="x" className="warn">Młot może uszkodzić kość ({pct(m.hammerRisk)})</span>);
  } else {
    if (it && !it.found) { title = 'Odsłonięta część znaleziska'; lines.push(<span key="p">Odkop pola ze złotymi narożnikami obok.</span>); }
    else if (echoNear(st, i, m.sonar ? 1 : undefined)) { title = 'Echo'; lines.push(<span key="e" className="blue">Tuż obok coś jeszcze leży.</span>); }
    else return null;
  }
  const segs = Math.min(8, Math.max(1, Math.ceil(t.max / power)));
  const on = Math.ceil((t.hp / t.max) * segs);
  const x = (i % B.gridW) * TS * scale, y = Math.floor(i / B.gridW) * TS * scale;
  const right = (i % B.gridW) < B.gridW - 3;
  return (
    <div className="tile-tip" style={{ left: 8 + (right ? x + TS * scale + 10 : x - 270), top: 8 + y - 4 }}>
      <b>{title}</b>
      {lines}
      {t.hp > 0 && <div className="hp">{Array.from({ length: segs }, (_, k) => <i key={k} className={k < on ? 'on' : ''} />)}</div>}
    </div>
  );
}

/** "Bone! 1/4" labels above partially uncovered finds */
function FindLabels({ st, glow, scale }: { st: SiteState; glow: React.MutableRefObject<WeakMap<LayerItem, Glow>>; scale: number }) {
  return (
    <>
      {st.items.map((it, k) => {
        if (it.found || it.kind !== 'fossil') return null;
        const open = it.cells.filter((c) => st.tiles[c].hp <= 0);
        if (!open.length) return null;
        const lvl = glow.current.get(it)?.shown ?? 0;
        const xs = it.cells.map((c) => (c % B.gridW) + 0.5), ys = it.cells.map((c) => Math.floor(c / B.gridW));
        const cx = (xs.reduce((a, b) => a + b, 0) / xs.length) * TS * scale + 8, top = Math.min(...ys) * TS * scale + 8 - 4;
        return <span key={k} className={`find-label r${lvl}`} style={{ left: cx, top }}><Bone className="ic" style={{ width: 13, height: 13 }} />{lvl ? `${RARITY_F[lvl]} kość` : 'Kość'}! {open.length}/{it.cells.length} pola</span>;
      })}
    </>
  );
}

function FieldMsg({ msg }: { msg: React.MutableRefObject<Msg | null> }) {
  useTicker(150);
  const m = msg.current;
  if (!m || m.until < performance.now()) return null;
  const I = m.icon === 'flame' ? Flame : m.icon === 'check' ? Check : m.icon === 'bone' ? Bone : Sparkles;
  return (
    <div className={`field-msg ${m.kind}`}>
      <I className="ic" style={{ width: 20, height: 20 }} />
      <div>{m.text}{m.sub && <small>{m.sub}</small>}</div>
    </div>
  );
}

/** "you unlocked a chest!" — click it to open */
function ChestCard({ pop, s, onOpen }: { pop: React.MutableRefObject<ChestPop | null>; s: GameState; onOpen: (c: PendingChest) => void }) {
  useTicker(150);
  const c = pop.current;
  if (!c || c.until < performance.now() || !(s.chests ?? []).some((x) => x.id === c.chest.id)) return null;
  return (
    <button className="chest-pop" style={{ ['--c' as string]: TIER_COLOR[c.chest.tier] }} onClick={() => { pop.current = null; onOpen(c.chest); }}>
      <ChestArt tier={c.chest.tier} open={false} size={96} />
      <b>Zdobyto: {CHEST_NAMES[c.chest.tier].toLowerCase()}!</b>
      <span className="muted">Granica epok na −{depthMeters(c.chest.depth)} m</span>
      <span className="chest-cta">Kliknij, żeby otworzyć</span>
    </button>
  );
}

/** chests waiting to be opened (stay until you open them) */
function ChestWaiting({ s, onOpen }: { s: GameState; onOpen: (c: PendingChest) => void }) {
  const list = s.chests ?? [];
  if (!list.length) return null;
  const best = [...list].sort((a, b) => b.tier - a.tier)[0];
  return (
    <button className="chest-waiting" style={{ ['--c' as string]: TIER_COLOR[best.tier] }} onClick={() => onOpen(best)} title="Skrzynie epok do otwarcia">
      <ChestArt tier={best.tier} open={false} size={44} />
      <span><b>{list.length > 1 ? `${list.length} skrzynie` : 'Skrzynia'}</b><small>do otwarcia</small></span>
    </button>
  );
}

// ---------------------------------------------------------------- the dig board (field + everything that talks to it)

function DigBoard({ s, focus, setFocus, openShop }: { s: GameState; focus: boolean; setFocus: (f: boolean) => void; openShop: () => void }) {
  const act = useStore((x) => x.act);
  const st = siteState(s, s.activeSite);
  const m = mods(s);
  const art = artFor(s.activeSite, st);
  const key = `${s.activeSite}:${st.depth}:${st.layersDone}`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const fx = useMemo(() => new Particles(), []);
  const [scale, setScale] = useState(4);
  const snap = useRef<Snap | null>(null);
  const playerHits = useRef(new Set<number>());
  const flights = useRef<Flight[]>([]);
  const doneTimer = useRef<number>();
  const order = useRef<FoundOrder>(new WeakMap());
  const orderSeq = useRef(0);
  const [arriving, setArriving] = useState<Set<LayerItem>>(() => new Set());
  const [doneLayer, setDoneLayer] = useState<LayerItem[] | null>(null);
  const live = useRef<Live>({ s, st, art, m });
  live.current = { s, st, art, m };
  const hover = useRef<HoverRef>({ idx: -1, px: null });
  const press = useRef(new Map<number, number>());
  const combo = useRef<Combo>({ n: 0, last: 0, feverUntil: 0, coolUntil: 0, best: 0 });
  const golden = useRef<Golden>({ idx: -1, until: 0, next: nextGolden(performance.now(), m.goldenEvery), items: null });
  const glow = useRef(new WeakMap<LayerItem, Glow>());
  const msg = useRef<Msg | null>(null);
  const chest = useRef<ChestPop | null>(null);
  const [chestOpen, setChestOpen] = useState<PendingChest | null>(null);
  const fuse = useRef(false);
  const hintShown = useRef(false);
  const say = (m2: Omit<Msg, 'until'>, ms = 3000) => { msg.current = { ...m2, until: performance.now() + ms }; };

  useEffect(() => { setVolume(s.settings.sound ?? 0.6); }, [s.settings.sound]);
  useEffect(() => {
    fx.attach(fxRef.current);
    return () => { fx.dispose(); clearTimeout(doneTimer.current); };
  }, [fx]);

  // integer pixel scale that fits the available space (width, and height in focus mode)
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.floor((el.clientWidth - 24) / GW);
      const h = focus ? Math.floor((el.clientHeight - 24) / GH) : 99;
      setScale(Math.max(2, Math.min(6, w, h)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [focus]);

  /** centre of a tile in particle-canvas coordinates (+ screen coordinates) */
  const center = (idx: number) => {
    const c = canvasRef.current, f = fxRef.current;
    if (!c || !f) return { x: 0, y: 0, sx: 0, sy: 0 };
    const r = c.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const sz = r.width / B.gridW;
    const sx = r.left + ((idx % B.gridW) + 0.5) * sz, sy = r.top + (Math.floor(idx / B.gridW) + 0.5) * sz;
    return { x: sx - fr.left, y: sy - fr.top, sx, sy };
  };
  const centerOf = (cells: number[]) => {
    const ps = cells.map(center);
    const avg = (k: 'x' | 'y' | 'sx' | 'sy') => ps.reduce((a, p) => a + p[k], 0) / ps.length;
    return { x: avg('x'), y: avg('y'), sx: avg('sx'), sy: avg('sy') };
  };
  const shake = (strong = false) => {
    if (reducedMotion()) return;
    const el = stageRef.current;
    if (!el) return;
    el.classList.remove('shake', 'shake-s');
    void el.offsetWidth;
    el.classList.add(strong ? 'shake' : 'shake-s');
  };

  // ---- render loop: pixel field + lighting + overlays
  useEffect(() => {
    const c = canvasRef.current!;
    c.width = GW;
    c.height = GH;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(GW, GH);
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const { st, art, m, s } = live.current;
      const gd = golden.current;
      if (gd.idx >= 0 && (now > gd.until || gd.items !== st.items || st.tiles[gd.idx].hp <= 0)) gd.idx = -1;
      if (gd.idx < 0 && now > gd.next) {
        const cand = st.tiles.map((t, i) => (t.hp > 0 && t.item < 0 ? i : -1)).filter((i) => i >= 0);
        if (cand.length) { gd.idx = cand[Math.floor(Math.random() * cand.length)]; gd.until = now + 6000; gd.items = st.items; }
        gd.next = nextGolden(now, m.goldenEvery);
      }
      // rarity glow ladder: the first glimpse may undersell the bone; each newly uncovered cell can raise it
      st.items.forEach((it) => {
        if (it.kind !== 'fossil' || it.found) return;
        const open = it.cells.filter((ci) => st.tiles[ci].hp <= 0).length;
        if (!open) return;
        const rar = GENERA.get(it.genusId!)?.rarity ?? 0;
        const g = glow.current.get(it);
        const left = it.cells.length - open;
        if (!g) {
          const shown = rar > 0 && Math.random() < 0.4 ? rar - 1 : rar;
          glow.current.set(it, { shown, open, flashUntil: 0 });
          if (left > 0) sfx.reveal(shown);
          if (shown > 0) say({ kind: `rare${shown}` as Msg['kind'], icon: 'bone', text: `${RARITY_F[shown]} kość!`, sub: `Odsłoń jeszcze ${left} ${plural(left, 'pole', 'pola', 'pól')}, żeby ją wydobyć` });
          else if (!hintShown.current) { hintShown.current = true; say({ kind: 'hint', icon: 'sparkles', text: 'Złote narożniki pokazują, gdzie dalej kopać' }); }
        } else if (open > g.open) {
          g.open = open;
          if (g.shown < rar && Math.random() < 0.5) {
            g.shown++;
            g.flashUntil = now + 300;
            const p = centerOf(it.cells.filter((ci) => st.tiles[ci].hp <= 0));
            fx.sparks(p.x, p.y, 10, GLOW_CSS[g.shown]);
            sfx.reveal(g.shown);
            say({ kind: `rare${g.shown}` as Msg['kind'], icon: 'bone', text: `Blask rośnie: ${RARITY_F[g.shown].toLowerCase()} kość!`, sub: left ? `Zostało ${left} ${plural(left, 'pole', 'pola', 'pól')}` : undefined });
          }
        }
      });
      const h = hover.current;
      const charge = s.settings.tool === 'charge' && m.charge;
      const hammer = (s.settings.tool === 'hammer' && m.hammer) || charge;
      const area = h.idx < 0 ? [] : charge ? chargeCells(h.idx, m.chargeSize).filter((ci) => st.tiles[ci].hp > 0) : hammer ? hammerCells(st, h.idx, m.hammerSquare) : [];
      const risk = new Set(charge ? [] : area.filter((ci) => (!m.hammerCenterRisk || ci === h.idx) && hammerRisk(st, ci, h.idx, m)));
      drawFrame(img, {
        st, art, t: now, hover: h.idx, hoverPx: h.px, hammer, area, risk,
        scanner: m.scanner, fever: now < combo.current.feverUntil, golden: gd.idx, press: press.current,
        glow: (k) => glow.current.get(st.items[k])?.shown ?? -1,
        glowFlash: (k) => Math.max(0, ((glow.current.get(st.items[k])?.flashUntil ?? 0) - now) / 300),
        sonar: m.sonar, glintAll: m.radarGlint,
      });
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  /** burst + label + sound where the item was dug out */
  const celebrate = (g: GameState, it: LayerItem) => {
    const { x, y } = centerOf(it.cells);
    const f = (g.finds ?? []).slice(0, 12).find((e) => e.kind === it.kind && e.genusId === it.genusId && (it.kind === 'mineral' ? e.mineral === it.mineralId : e.name === it.minorName));
    const byCrew = f?.byCrew ?? false;
    if (it.kind === 'fossil') {
      const gen = GENERA.get(it.genusId!)!;
      fx.sparks(x, y, byCrew ? 10 : 24, GLOW_CSS[gen.rarity]);
      if (!byCrew) sfx.find('fossil', gen.rarity);
      if (f?.isNew) {
        fx.sparks(x, y, 30, '#ffe08a');
        fx.text(x, y - 22, '✨ NOWY GATUNEK!', '#ffe27a', 16);
        if (!byCrew) shake(true);
      }
      if (!byCrew || f?.isNew) fx.text(x, y - 4, f?.pb ? `${gen.name} → +${fmt(f.pb)} 🔬` : gen.name, gen.rarity ? GLOW_CSS[gen.rarity] : '#f6e7c1', 14);
    } else if (it.kind === 'minor') {
      fx.sparks(x, y, byCrew ? 4 : 8, '#8fc7e8');
      if (!byCrew) { sfx.find('minor'); fx.text(x, y - 4, `+${fmt(f?.pb ?? B.minorPB)} 🔬  +${fmt(f?.coins ?? B.minorCoins)} 💰`, '#bfe3f5', 13); }
    } else if (it.kind === 'mineral') {
      const mn = MINERAL_BY_ID.get(it.mineralId ?? '');
      fx.sparks(x, y, byCrew ? 10 : 20 + (mn?.rarity ?? 0) * 8, mn?.color ?? '#c79bff');
      sfx.find('mineral', mn?.rarity ?? 0);
      fx.text(x, y - 4, `${f?.isNew ? 'Nowy minerał: ' : ''}${mn?.name ?? 'Minerał'} +${fmt(f?.coins ?? 0)} 💰`, '#e3cbff', 14);
    } else {
      fx.sparks(x, y, byCrew ? 10 : 22, '#ff9d2e');
      sfx.find('amber', 1);
      fx.text(x, y - 4, '+1 🧪 mutagen', '#ffc47a', 14);
    }
  };

  /** the find lifts off the dig field and flies into the stash */
  const launch = (fl: Flight) => {
    const n = stashList(fl.items, order.current).indexOf(fl.it);
    const slot = trayRef.current?.querySelector<HTMLElement>(`[data-slot="${n}"]`);
    const land = () => {
      setArriving((prev) => { const nx = new Set(prev); nx.delete(fl.it); return nx; });
      if (slot) {
        slot.classList.remove('pop'); void slot.offsetWidth; slot.classList.add('pop');
        const c = fxRef.current?.getBoundingClientRect(), r = slot.getBoundingClientRect();
        if (c) fx.sparks(r.left + r.width / 2 - c.left, r.top + r.height / 2 - c.top, 10, KIND_COLOR[fl.it.kind]);
        sfx.land();
      }
    };
    if (!slot || document.hidden) { land(); return; }
    const from = centerOf(fl.it.cells);
    const to = slot.getBoundingClientRect();
    const dx = to.left + to.width / 2 - from.sx, dy = to.top + to.height / 2 - from.sy;
    const el = document.createElement('div');
    el.className = 'flyer';
    el.style.left = `${from.sx}px`;
    el.style.top = `${from.sy}px`;
    const img = document.createElement('img');
    img.className = 'pixel';
    const a = cachedArt(fl.items);
    const k = Math.max(2, Math.round((canvasRef.current?.getBoundingClientRect().width ?? GW * 3) / GW));
    img.src = (a && itemUrl(a, fl.items.indexOf(fl.it), k)) || (fl.it.kind === 'fossil' ? spriteUrl(genusSpec(fl.it.genusId!), 1, 0, !s.hatched[fl.it.genusId!]).url : smallIcon(fl.it, 3));
    el.appendChild(img);
    document.body.appendChild(el);
    const base = 'translate(-50%, -50%)';
    const anim = el.animate([
      { transform: `${base} translate(0, 0) scale(1)`, opacity: 1 },
      { transform: `${base} translate(0, -22px) scale(1.15)`, opacity: 1, offset: 0.25 },
      { transform: `${base} translate(${dx * 0.55}px, ${dy * 0.55 - 60}px) scale(0.85)`, offset: 0.6 },
      { transform: `${base} translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.9 },
    ], { duration: fl.it.kind === 'fossil' ? 900 : 650, easing: 'ease-in-out', delay: 120, fill: 'both' });
    anim.onfinish = () => { el.remove(); land(); };
  };

  // every render: diff against the last snapshot → dust where crews/embers dig, celebrate + fly every new find
  useLayoutEffect(() => {
    const cur = snapOf(key, s.activeSite, st);
    const prev = snap.current;
    snap.current = cur;
    const hits = playerHits.current;
    playerHits.current = new Set();
    if (!prev || prev.site !== s.activeSite || document.hidden) return;
    const newLayer = prev.items !== st.items;
    if (!newLayer) {
      let budget = 6;
      for (let i = 0; i < cur.hp.length; i++) {
        if (cur.hp[i] < prev.hp[i] && !hits.has(i) && budget-- > 0) {
          const p = center(i);
          fx.dust(p.x, p.y, 3);
          fx.chips(p.x, p.y, [art.tileCss[i], ...DUST], 2, 0.5);
        }
      }
    }
    const fresh = prev.items.filter((it, j) => it.found && !prev.found[j]);
    for (const it of fresh) {
      order.current.set(it, ++orderSeq.current);
      celebrate(s, it);
      flights.current.push({ it, items: prev.items });
    }
    if (newLayer) {
      const el = stageRef.current;
      if (el && !reducedMotion()) { el.classList.remove('descend'); void el.offsetWidth; el.classList.add('descend'); }
      for (let c = 0; c < st.tiles.length; c += 3) { const p = center(c); fx.dust(p.x, p.y, 2, '#bba98a'); }
      const out = st.lastDone;
      if (out?.n === st.layersDone && out.chest && 'tier' in out.chest) {
        chest.current = { chest: out.chest, until: performance.now() + 9000 };
        const mid = center(Math.floor(B.gridH / 2) * B.gridW + Math.floor(B.gridW / 2));
        fx.sparks(mid.x, mid.y, 50, '#ffcf4a');
        sfx.chest();
      } else sfx.layer();
      const at = stratumAt(s.activeSite, st.depth), was = stratumAt(s.activeSite, st.depth - 1);
      say(at.s.name !== was.s.name
        ? { kind: 'good', icon: 'check', text: `Nowa skała: ${at.s.name}`, sub: `Warstwa ${st.depth + 1} · −${depthMeters(st.depth)} m` }
        : { kind: 'good', icon: 'check', text: `Warstwa ${st.depth} wykopana!`, sub: out?.bonus ? `+${fmt(out.bonus.coins)} monet · +${out.bonus.pb} badań · +${layerShards(st.depth)} odłamków` : undefined }, 2600);
      clearTimeout(doneTimer.current);
      setDoneLayer(prev.items);
      doneTimer.current = window.setTimeout(() => setDoneLayer(null), 2200);
    }
    if (fresh.length) setArriving((a) => { const nx = new Set(a); fresh.forEach((it) => nx.add(it)); return nx; });
  });

  // launch queued flights once their stash slots are on screen
  useLayoutEffect(() => {
    if (!flights.current.length) return;
    const shown = doneLayer ?? st.items;
    const ready = flights.current.filter((f) => f.items === shown);
    flights.current = flights.current.filter((f) => f.items !== shown);
    ready.forEach(launch);
  });

  const startFever = (now: number) => {
    const { m } = live.current;
    if (!m.feverSec) return;
    const c = combo.current;
    c.feverUntil = now + m.feverSec * 1000;
    c.coolUntil = c.feverUntil + FEVER_COOLDOWN;
    c.n = 0;
    const mid = center(Math.floor(B.gridH / 2) * B.gridW + Math.floor(B.gridW / 2));
    fx.sparks(mid.x, mid.y, 36, '#ff9a3c');
    say({ kind: 'fever', icon: 'flame', text: 'Gorączka!', sub: `Przez ${m.feverSec} s każde trafienie jest krytyczne` }, m.feverSec * 1000);
    shake(false);
  };

  const claimGoldenFlash = (i: number) => {
    golden.current.idx = -1;
    const r = act((g) => claimGolden(g, g.activeSite));
    const p = center(i);
    fx.sparks(p.x, p.y, 30, '#ffd75a');
    sfx.golden();
    const label = r.kind === 'coins' ? `+${fmt(r.amount)} 💰` : r.kind === 'pb' ? `+${fmt(r.amount)} 🔬` : r.kind === 'mutagen' ? '+1 🧪 mutagen' : r.kind === 'fever' ? 'Gorączka!' : 'Pewna kość';
    fx.text(p.x, p.y - 8, `✦ ${label}`, '#ffe27a', 16);
    if (r.kind === 'fever') startFever(performance.now());
    if (r.kind === 'reveal' && r.cell !== undefined) { const q = center(r.cell); fx.dust(q.x, q.y, 6, '#d8c49a'); fx.sparks(q.x, q.y, 12, '#ffd75a'); }
  };

  /** light the fuse: a short hiss, then the blast */
  const placeCharge = (i: number) => {
    if (fuse.current) return;
    if ((s.charges?.n ?? 0) < 1) { say({ kind: 'hint', icon: 'sparkles', text: 'Ładunek jeszcze się przygotowuje', sub: `następny za ${Math.ceil(m.chargeCd - (s.charges?.acc ?? 0))} s` }, 1800); return; }
    fuse.current = true;
    sfx.fuse();
    const p = center(i);
    let k = 0;
    const spark = window.setInterval(() => { fx.sparks(p.x, p.y - 4, 4, k++ % 2 ? '#ffd27a' : '#ff8a3c'); }, 90);
    press.current.set(i, performance.now() + 700);
    window.setTimeout(() => {
      clearInterval(spark);
      fuse.current = false;
      const { art } = live.current;
      const res = act((g) => blastCharge(g, g.activeSite, i));
      if (!res) return;
      sfx.boom(res.blasts.length > 1);
      shake(true);
      for (const b of res.blasts) {
        const c = center(b.center);
        fx.sparks(c.x, c.y, 40, '#ffb347');
        fx.sparks(c.x, c.y, 20, '#fff1b8');
        for (const ci of b.cells) { const q = center(ci); fx.chips(q.x, q.y, [art.tileCss[ci], ...DUST], 8, 1.6); fx.dust(q.x, q.y, 4, '#a8977a'); playerHits.current.add(ci); }
      }
      if (res.shards) fx.text(p.x, p.y - 14, `+${fmt(res.shards)} odłamków`, '#e8dcb8', 14);
      if (res.blasts.length > 1) { const c = center(res.blasts[1].center); fx.text(c.x, c.y - 10, 'REAKCJA ŁAŃCUCHOWA!', '#ffb347', 14); }
    }, 700);
  };

  const onHit = (i: number) => {
    const now = performance.now();
    if (golden.current.idx === i) { claimGoldenFlash(i); return; }
    if (s.settings.tool === 'charge' && m.charge) { placeCharge(i); return; }
    const c = combo.current;
    const fever = now < c.feverUntil;
    if (!fever && m.combo) {
      c.n = Math.min(FEVER_AT, streakNow(c, now) + 1);
      c.best = Math.max(c.best, c.n);
      if (c.n >= FEVER_AT && now > c.coolUntil && m.feverSec) startFever(now);
    }
    c.last = now;
    const tool = s.settings.tool === 'hammer' && m.hammer ? 'hammer' : 'brush';
    const base = tool === 'hammer' ? m.critHammer : m.critBrush;
    const critChance = fever || now < c.feverUntil ? 1 : Math.min(1, base * comboMult(c.n, m.combo));
    const cells = tool === 'hammer' ? hammerCells(st, i, m.hammerSquare) : [i];
    const colors = cells.map((ci) => art.tileCss[ci]);
    cells.forEach((ci) => { playerHits.current.add(ci); press.current.set(ci, now + 80); });
    const before = cells.map((ci) => st.tiles[ci].hp);
    const res = act((g) => hitTile(g, g.activeSite, i, g.settings.tool, undefined, { critChance }));
    sfx.hit(tool, m.combo ? c.n : 0, res.crit);
    const broke = res.layerDone || cells.some((ci, k) => before[k] > 0 && st.tiles[ci]?.hp <= 0);
    if (broke) sfx.crumble(tool === 'hammer');
    cells.forEach((ci, k) => {
      const p = center(ci);
      const big = ci === i;
      fx.chips(p.x, p.y, [colors[k], colors[k], ...DUST], (big ? 9 : 5) * (res.crit && big ? 2 : 1), (tool === 'hammer' ? 1.3 : 1) * (res.crit && big ? 1.3 : 1));
      fx.dust(p.x, p.y, big ? 3 : 2, '#a8977a');
    });
    if (res.crit && !fever) { const p = center(i); fx.text(p.x, p.y - 12, 'KRYT!', '#ffc45a', 13); shake(false); }
    if (res.damaged) { const p = center(i); fx.text(p.x, p.y - 10, '💥 kość uszkodzona', '#ff8a7a', 14); }
    for (const ci of res.extra ?? []) { const p = center(ci); fx.chips(p.x, p.y, [art.tileCss[ci], ...DUST], 6, 1); playerHits.current.add(ci); }
  };

  // keyboard: 1 brush · 2 hammer · F focus mode · Esc leave it · U workshop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const { m } = live.current;
      if (e.key === '1') act((g) => { g.settings.tool = 'brush'; });
      else if (e.key === '2' && m.hammer) act((g) => { g.settings.tool = 'hammer'; });
      else if (e.key === '3' && m.charge) act((g) => { g.settings.tool = 'charge'; });
      else if (e.key === 'f' || e.key === 'F') setFocus(!focus);
      else if (e.key === 'u' || e.key === 'U') openShop();
      else if (e.key === 'Escape' && focus) setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  const toTile = (e: React.PointerEvent<HTMLCanvasElement>): HoverRef => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * GW, y = ((e.clientY - r.top) / r.height) * GH;
    const inside = x >= 0 && y >= 0 && x < GW && y < GH;
    return { idx: inside ? Math.floor(y / TS) * B.gridW + Math.floor(x / TS) : -1, px: inside ? [x, y] : null };
  };

  const field = (
    <div ref={fieldRef} className="dig-main" style={focus ? { height: '100%', justifyContent: 'center' } : undefined}>
      <div ref={stageRef} className="dig-stage">
        <canvas
          ref={canvasRef}
          className="dig-canvas pixel"
          style={{ width: GW * scale, height: GH * scale, cursor: (s.settings.tool === 'hammer' && m.hammer) || (s.settings.tool === 'charge' && m.charge) ? 'crosshair' : 'pointer' }}
          onPointerMove={(e) => { hover.current = toTile(e); }}
          onPointerLeave={() => { hover.current = { idx: -1, px: null }; }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const t = toTile(e);
            hover.current = t;
            if (t.idx >= 0 && st.tiles[t.idx].hp > 0) onHit(t.idx);
          }}
        />
        <FieldMsg msg={msg} />
        <FindLabels st={st} glow={glow} scale={scale} />
        <TileTip live={live} hover={hover} golden={golden} scale={scale} />
        <ChestCard pop={chest} s={s} onOpen={setChestOpen} />
        <ChestWaiting s={s} onOpen={setChestOpen} />
      </div>
      {chestOpen && <ChestModal s={s} chest={chestOpen} onClose={() => setChestOpen(null)} />}
    </div>
  );
  const toolbar = (
    <div className="toolbar">
      <button className={`tool ${s.settings.tool === 'brush' || (s.settings.tool === 'hammer' && !m.hammer) || (s.settings.tool === 'charge' && !m.charge) ? 'on' : ''}`} onClick={() => act((g) => { g.settings.tool = 'brush'; })} title="Jedno pole, bez ryzyka dla kości">
        <kbd className="key">1</kbd><Paintbrush className="ic" style={{ width: 22, height: 22 }} />Pędzel<small>moc {m.brushPower.toFixed(2)}</small>
      </button>
      <button className={`tool ${s.settings.tool === 'hammer' && m.hammer ? 'on' : ''}`} onClick={() => (m.hammer ? act((g) => { g.settings.tool = 'hammer'; }) : openShop())}
        title={m.hammer ? `${m.hammerSquare ? 'Kwadrat 3×3' : 'Plus z 5 pól'}. ${pct(m.hammerRisk)} ryzyka, gdy przebija się do kości (pola świecą na czerwono).` : 'Odblokuj w Warsztacie: Młot pneumatyczny'}>
        <kbd className="key">2</kbd>{!m.hammer && <Lock className="lock" />}<Hammer className="ic" style={{ width: 22, height: 22 }} />Młot<small>{m.hammer ? `moc ${m.hammerPower.toFixed(2)}` : 'Warsztat'}</small>
      </button>
      <button className={`tool ${s.settings.tool === 'charge' && m.charge ? 'on' : ''}`} onClick={() => (m.charge ? act((g) => { g.settings.tool = 'charge'; }) : openShop())}
        title={m.charge ? 'Kliknij pole: po krótkim loncie wybuch kruszy skałę dookoła. Pola ze znaleziskami tylko pękają — dokopujesz je sam.' : 'Odblokuj w Warsztacie: Ładunek prochowy'}>
        <kbd className="key">3</kbd>{!m.charge && <Lock className="lock" />}<Bomb className="ic" style={{ width: 22, height: 22 }} />Ładunek
        <small>{m.charge ? <ChargeMeter s={s} m={m} /> : 'Warsztat'}</small>
        {m.charge && (s.charges?.n ?? 0) < m.chargeMax && <span className="tool-cd" style={{ width: `${((s.charges?.acc ?? 0) / m.chargeCd) * 100}%` }} />}
      </button>
      <button className={`tool passive ${m.scanner ? 'on' : ''}`} onClick={openShop} title={m.scanner ? `Georadar poziom ${m.scanner}: działa sam. Ulepszaj w Warsztacie.` : 'Odblokuj w Warsztacie: Georadar'}>
        {!m.scanner && <Lock className="lock" />}<Radar className="ic" style={{ width: 22, height: 22 }} />Georadar<small>{m.scanner ? `poziom ${['', 'I', 'II', 'III', 'IV'][m.scanner]}` : 'Warsztat'}</small>
      </button>
      <button className="tool shop" onClick={openShop} title="Drzewko ulepszeń narzędzi i ekip (klawisz U)">
        <kbd className="key">U</kbd><Wrench className="ic" style={{ width: 22, height: 22 }} />Warsztat<small><Hexagon className="ic" style={{ width: 11, height: 11, verticalAlign: -1 }} /> {fmt(s.shards ?? 0)}</small>
      </button>
    </div>
  );
  const stash = <StashPanel s={s} items={doneLayer ?? st.items} st={st} arriving={arriving} done={!!doneLayer} trayRef={trayRef} ord={order.current} compact={focus} />;
  const at = stratumAt(s.activeSite, st.depth);
  const reward = layerReward(st.depth + 1);

  if (focus) {
    const site = SITE_BY_ID.get(s.activeSite)!;
    return (
      <div className="focus-mode">
        <div className="f-top">
          <button className="iconbtn" aria-label="Wróć" onClick={() => setFocus(false)}><ArrowLeft className="ic" /></button>
          <b style={{ fontSize: 17 }}>{site.name}</b><ChevronRight className="ic muted" /><span className="muted" style={{ fontWeight: 800 }}>{at.s.name}</span>
          <span className="spacer" />
          <FocusCash />
          <span className="spacer" />
          <button className="btn small" onClick={() => setFocus(false)}><Minimize2 className="ic" />Wyjdź z trybu skupienia <kbd>F</kbd></button>
        </div>
        <div className="f-left">
          <div className="hud">
            <span className="lbl">Głębokość</span>
            <div className="big">−{depthMeters(st.depth)} m</div>
            <div className="muted small" style={{ marginTop: 6 }}>warstwa {st.depth + 1} · {at.s.name}</div>
            <EpochDots depth={st.depth} />
          </div>
          <div className="hud col" style={{ gap: 10 }}><span className="lbl">Seria</span><ComboPill combo={combo} m={m} openShop={openShop} /></div>
        </div>
        <div className="f-mid" style={{ position: 'relative' }}>{field}<canvas ref={fxRef} className="dig-fx" /></div>
        <div className="f-right">
          {stash}
          <OddsPanel s={s} compact />
        </div>
        <div className="f-bottom">
          <div className="hud" style={{ padding: '8px 10px', width: 330 }}><CrewSwitch s={s} short /></div>
          {toolbar}
          <div style={{ width: 330 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dig-layout">
      <StrataColumn s={s} st={st} />
      <div className="panel dig-center">
        <div className="dig-center-head">
          <div className="title"><span className="lbl">Warstwa {st.depth + 1}</span><b>{at.s.name}</b></div>
          <ComboPill combo={combo} m={m} openShop={openShop} />
          <span className="reward" title="Nagroda po wykopaniu całej warstwy (każdego pola)">Za warstwę <b>+{fmt(reward.coins)}</b><Coins className="ic" style={{ color: 'var(--accent)' }} /><b className="blue">+{reward.pb}</b><Microscope className="ic" style={{ color: 'var(--blue)' }} /></span>
        </div>
        <div className="dig-wrap">{field}<canvas ref={fxRef} className="dig-fx" /></div>
        {toolbar}
      </div>
      <div className="dig-right">
        {stash}
        <OddsPanel s={s} />
        <div className="panel"><CrewSwitch s={s} /></div>
      </div>
    </div>
  );
}

function FocusCash() {
  const s = useGame();
  const act = useStore((x) => x.act);
  const m = mods(s);
  const cap = bankCap(s, m, incomePerSec(s, m));
  return (
    <span className="row" style={{ gap: 10 }}>
      <span className="res"><Coins className="ic" style={{ color: 'var(--accent)' }} />{fmt(s.coins)}</span>
      {!m.autoCollect && <button className={`collect ${s.bank >= cap * 0.99 ? 'full' : ''}`} onClick={() => act(collectBank)} disabled={s.bank < 1}>Zbierz {fmt(s.bank)}</button>}
    </span>
  );
}

function EpochDots({ depth }: { depth: number }) {
  const into = depth % B.chestEvery;
  const toChest = B.chestEvery - into;
  return (
    <div className="col" style={{ gap: 6, marginTop: 12 }}>
      <div className="row" style={{ gap: 5 }}>
        {Array.from({ length: B.chestEvery }, (_, k) => <i key={k} style={{ width: 28, height: 7, borderRadius: 99, background: k < into ? 'var(--accent)' : k === into ? '#eaa63a55' : '#3b3527' }} />)}
        <Archive className="ic" style={{ color: 'var(--accent)' }} />
      </div>
      <span className="small" style={{ color: 'var(--accent)', fontWeight: 800 }}>Skrzynia epoki za {toChest} {plural(toChest, 'warstwę', 'warstwy', 'warstw')}</span>
    </div>
  );
}

// ---------------------------------------------------------------- left: the site's section — where you are, chests, what's below

const SECTION_ROWS = 18; // layers shown at once
const ROW_H = 26;

function StrataColumn({ s, st }: { s: GameState; st: SiteState }) {
  const from = Math.max(0, st.depth - 4);
  const rocks = strataFrom(s.activeSite, from, SECTION_ROWS);
  const y = (layer: number) => (layer - from) * ROW_H;
  const chests: number[] = [];
  for (let d = Math.ceil((from + 1) / B.chestEvery) * B.chestEvery; d <= from + SECTION_ROWS; d += B.chestEvery) chests.push(d);
  const toChest = B.chestEvery - (st.depth % B.chestEvery);
  return (
    <div className="panel strata-col">
      <div className="panel-head" style={{ marginBottom: 6 }}><span className="lbl">Przekrój stanowiska</span><Layers className="ic muted" /></div>
      <div className="section" style={{ height: SECTION_ROWS * ROW_H }}>
        <div className="section-rock">
          {rocks.map((r, k) => (
            <div key={k} className={`seg ${r.to <= st.depth ? 'past' : ''}`} style={{ top: y(r.from), height: (r.to - r.from) * ROW_H, background: r.s.color }} title={`${r.s.name}: ${r.s.desc}`} />
          ))}
          <div className="dug" style={{ height: y(st.depth) }} />
          {Array.from({ length: SECTION_ROWS }, (_, k) => <i key={k} className="tick" style={{ top: k * ROW_H }} />)}
        </div>
        {rocks.map((r, k) => (r.to - r.from >= 2 || k === 0) && (
          <span key={`n${k}`} className={`seg-name ${r.to <= st.depth ? 'past' : ''}`} style={{ top: y(r.from) + 3 + (Math.abs(y(r.from) - y(st.depth)) < ROW_H ? ROW_H : 0) }}>{r.s.name}</span>
        ))}
        {chests.map((d) => {
          const opened = d <= st.depth;
          return (
            <span key={d} className={`sec-chest ${opened ? 'opened' : d === st.depth + toChest ? 'next' : ''}`} style={{ top: y(d) - 13 }}
              title={opened ? `Skrzynia na −${depthMeters(d)} m — zdobyta` : `Skrzynia epoki na −${depthMeters(d)} m: zdobędziesz ją po wykopaniu całej ${d}. warstwy. Brązowa, srebrna albo złota — w środku losowe nagrody: monety, odłamki, badania, pożywienie, a czasem mutagen, minerał lub kość.`}>
              {opened ? <Check className="ic" /> : <Archive className="ic" />}
              <b>−{depthMeters(d)} m</b>
            </span>
          );
        })}
        <div className="you" style={{ top: y(st.depth), height: ROW_H }}>
          <span className="you-tag">TY · −{depthMeters(st.depth)} m</span>
        </div>
      </div>
      <div className="section-foot">
        <span><Archive className="ic" style={{ color: 'var(--accent)', verticalAlign: -3, marginRight: 4 }} />Skrzynia za <b>{toChest}</b> {plural(toChest, 'warstwę', 'warstwy', 'warstw')}: losowe nagrody</span>
        <span className="muted">Przekrój nie ma dna: głębiej skały się powtarzają (ławice II, III…), a skrzynia czeka co {depthMeters(B.chestEvery)} m.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- right: stash, odds, crews

/** what you have dug out of this layer — never how much is still hidden */
function StashPanel({ s, items, st, arriving, done, trayRef, ord, compact }: { s: GameState; items: LayerItem[]; st: SiteState; arriving: Set<LayerItem>; done: boolean; trayRef: React.RefObject<HTMLDivElement>; ord: FoundOrder; compact?: boolean }) {
  const openGenus = useStore((x) => x.openGenus);
  const list = stashList(items, ord);
  const dug = items === st.items ? st.tiles.filter((t) => t.hp <= 0).length : st.tiles.length;
  const total = st.tiles.length;
  return (
    <div ref={trayRef} className={`panel stash ${done ? 'done' : ''}`}>
      <div className="panel-head"><span className="lbl">{done ? 'Warstwa wykopana!' : 'Schowek warstwy'}</span><span className="small muted">{list.length ? `${list.length} ${plural(list.length, 'znalezisko', 'znaleziska', 'znalezisk')}` : ''}</span></div>
      <div className="stash-grid">
        {list.length === 0 && <span className="small muted stash-empty">Pusto. Co wykopiesz z tej warstwy, trafi tutaj.</span>}
        {list.map((it, n) => {
          const g = it.genusId !== undefined ? GENERA.get(it.genusId) : undefined;
          const mn = it.kind === 'mineral' ? MINERAL_BY_ID.get(it.mineralId ?? '') : undefined;
          const name = g ? g.name : mn ? mn.name : it.kind === 'amber' ? 'Bursztyn' : (it.minorName ?? 'Drobna').replace(/\s*\(.*\)$/, '');
          const color = g ? RARITY_COLORS[g.rarity] : mn ? RARITY_COLORS[mn.rarity] : KIND_COLOR[it.kind];
          return (
            <span key={n} data-slot={n} className={`stash-item ${it.kind} ${g ? 'clickable' : ''} ${arriving.has(it) ? 'arriving' : ''}`} style={{ borderColor: color }}
              title={g ? `${g.name} · ${QUALITY_NAMES[it.quality].toLowerCase()} · ${RARITY_NAMES[g.rarity].toLowerCase()}` : it.kind === 'minor' ? it.minorName : name}
              onClick={() => g && openGenus(g.id)}>
              <span className="pic">{g ? <SpriteImg genusId={g.id} scale={1} silhouette={!s.hatched[g.id]} /> : <img className="pixel" src={smallIcon(it, 2)} alt="" />}</span>
              {!compact && <span className="nm">{name}</span>}
              {g && !compact && <i className="q" style={{ background: QUALITY_COLORS[it.quality] }} title={QUALITY_NAMES[it.quality]} />}
            </span>
          );
        })}
      </div>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <div className="row small" style={{ justifyContent: 'space-between' }}><span className="muted">Wykopane pola</span><b>{dug} / {total}</b></div>
        <div className="bar gold"><div style={{ width: `${(dug / total) * 100}%` }} /></div>
        {!compact && <span className="small muted">Warstwa kończy się, gdy wykopiesz każdy kamień — dopiero wtedy schodzisz niżej.</span>}
      </div>
    </div>
  );
}

function OddsBar({ parts }: { parts: [string, number, string][] }) {
  return (
    <div>
      <div className="odds-bar">{parts.map(([n, v, c]) => v > 0 && <i key={n} style={{ width: `${v * 100}%`, background: c }} title={`${n}: ${pct(v)}`} />)}</div>
      <div className="odds-legend">{parts.map(([n, v, c]) => <span key={n}><i style={{ background: c }} />{n} <b>{pct(v)}</b></span>)}</div>
    </div>
  );
}

function OddsPanel({ s, compact }: { s: GameState; compact?: boolean }) {
  const [open, setOpen] = useState(true);
  const st = siteState(s, s.activeSite);
  const m = mods(s);
  const rar = fossilRarityOdds(s.activeSite, st.depth, m);
  const q = qualityOddsAt(st.depth, m);
  return (
    <div className="panel">
      <div className="panel-head" style={open ? undefined : { marginBottom: 0 }}>
        <span className="lbl">Szanse na −{depthMeters(st.depth)} m</span>
        <button className="collapse-btn" aria-label={open ? 'Zwiń' : 'Rozwiń'} onClick={() => setOpen(!open)}><ChevronDown className="ic" style={{ transform: open ? undefined : 'rotate(-90deg)' }} /></button>
      </div>
      {open && (compact ? (
        <div className="kv small">
          {RARITY_NAMES.slice(1).map((n, i) => <Fragment key={n}><span style={{ color: RARITY_COLORS[i + 1] }}>{RARITY_F[i + 1]} kość</span><b>{pct(rar[i + 1])}</b></Fragment>)}
          <span>Kompletna</span><b>{pct(q[2])}</b>
          <span>Bursztyn</span><b>{pct(m.amberChance)}</b>
          <span>Minerał</span><b>{pct(mineralChanceAt(st.depth))}</b>
          <span>Twardość skały</span><b>×{hardness(st.depth).toFixed(2)}</b>
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          <div className="col" style={{ gap: 6 }}><b className="small">Rzadkość kości</b><OddsBar parts={RARITY_F.map((n, i) => [n, rar[i], RARITY_COLORS[i]] as [string, number, string])} /></div>
          <div className="col" style={{ gap: 6 }}><b className="small">Jakość kości</b><OddsBar parts={QUALITY_NAMES.map((n, i) => [n, q[i], QUALITY_COLORS[i]] as [string, number, string])} /></div>
          <div className="tiles3">
            <div title="Szansa, że w warstwie jest bursztyn"><b style={{ color: '#ff9d2e' }}>{pct(m.amberChance)}</b><span>bursztyn</span></div>
            <div title="Szansa, że w warstwie jest minerał"><b style={{ color: '#c79bff' }}>{pct(mineralChanceAt(st.depth))}</b><span>minerał</span></div>
            <div title="Im głębiej, tym twardsza skała"><b>×{hardness(st.depth).toFixed(2)}</b><span>twardość</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

const CREW_MODES: [CrewMode, string, string][] = [
  ['off', 'Wyłączone', 'Ekipy nie kopią — wszystko odkrywasz sam.'],
  ['helpers', 'Pomocnicy', 'Kruszą zwykłą skałę. Pola, pod którymi coś leży, tylko osłabiają — ostatnie uderzenie i odkrycie zostawiają Tobie.'],
  ['full', 'Automat', 'Wykopują wszystko same, także offline. Nowe gatunki trafiają do skrzynki „Nowe odkrycia”.'],
];

function CrewSwitch({ s, short }: { s: GameState; short?: boolean }) {
  const act = useStore((x) => x.act);
  const m = mods(s);
  const mode = crewMode(s);
  const every = B.crewInterval / Math.max(0.0001, m.crews * m.crewSpeed);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <span className="lbl"><Users className="ic" style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 6 }} />Ekipy · {m.crews}</span>
        {mode !== 'off' && <span className="small muted" title="Jedno uderzenie ekip co…"><Clock className="ic" style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 4 }} />co {every < 10 ? every.toFixed(1) : Math.round(every)} s</span>}
      </div>
      <div className="segmented">
        {CREW_MODES.map(([id, label, desc]) => <button key={id} className={mode === id ? 'on' : ''} title={desc} onClick={() => act((g) => { g.settings.crewMode = id; })}>{label}</button>)}
      </div>
      {!short && <span className="crew-note">{CREW_MODES.find(([id]) => id === mode)![2]}</span>}
    </div>
  );
}

function ChargeMeter({ s, m }: { s: GameState; m: Mods }) {
  const n = s.charges?.n ?? 0;
  return <>{n}/{m.chargeMax}{n < m.chargeMax ? ` · ${Math.ceil(m.chargeCd - (s.charges?.acc ?? 0))} s` : ' gotowe'}</>;
}

// ---------------------------------------------------------------- lower row: fauna / minerals · dig log

/** how far a species is: discovered → genome → in the park */
const speciesProgress = (s: GameState, id: number) => (s.hatched[id] ? 1 : Math.min(0.95, ((s.genome[id] ?? 0) / 100) * 0.95));

function FaunaTab({ s }: { s: GameState }) {
  const openGenus = useStore((x) => x.openGenus);
  const [filter, setFilter] = useState<'all' | 'known' | 'missing'>('all');
  const site = SITE_BY_ID.get(s.activeSite)!;
  const list = site.fauna.map((f) => GENERA.get(f.genusId)).filter((g): g is NonNullable<typeof g> => !!g);
  const known = (id: number) => !!s.discovered[id] || s.settings.revealAll;
  const shown = list.filter((g) => filter === 'all' || (filter === 'known') === known(g.id));
  const disc = list.filter((g) => s.discovered[g.id]).length;
  const hatched = list.filter((g) => s.hatched[g.id]).length;
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row">
        <div className="segmented" style={{ width: 330 }}>
          {([['all', 'Wszystkie'], ['known', 'Odkryte'], ['missing', 'Brakujące']] as const).map(([id, label]) => <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <span className="spacer" />
        <span style={{ color: 'var(--accent)', fontWeight: 900 }}>{disc} / {list.length} odkryte · {hatched} w parku</span>
      </div>
      <div className="fauna-shelf">
        <div className="shelf">
          {shown.map((g) => {
            const k = known(g.id);
            const p = speciesProgress(s, g.id);
            return (
              <span key={g.id} className={k ? 'known clickable' : 'unknown'} onClick={() => k && openGenus(g.id)}
                title={k ? `${g.name} · ${RARITY_NAMES[g.rarity]} · genom ${Math.floor(s.genome[g.id] ?? 0)}%${s.hatched[g.id] ? ' · w parku' : ''}` : 'Nieodkryty — szukaj jego kości'}>
                <SpriteImg genusId={g.id} scale={2} silhouette={!s.hatched[g.id]} title={k ? g.name : '???'} />
                {k && <i className="prog" style={{ borderColor: RARITY_COLORS[g.rarity] }}><b style={{ width: `${p * 100}%`, background: s.hatched[g.id] ? 'var(--accent2)' : 'var(--blue)' }} /></i>}
              </span>
            );
          })}
        </div>
      </div>
      <div className="row small muted"><span>Pasek pod zwierzęciem: postęp genomu, zielony = już w parku.</span><span className="spacer" /><span>dane: Paleobiology Database</span></div>
      <Bar value={disc + hatched} max={list.length * 2} kind="gold" title="Ukończenie fauny stanowiska (odkrycia + hodowla)" />
    </div>
  );
}

function MineralsTab({ s }: { s: GameState }) {
  const [sel, setSel] = useState<string | null>(null);
  const owned = s.minerals ?? {};
  const mn = sel ? MINERAL_BY_ID.get(sel) : null;
  const st = siteState(s, s.activeSite);
  const own = siteMinerals(s.activeSite);
  const haveSite = own.filter((x) => owned[x.id]).length;
  const haveCommon = COMMON_MINERALS.filter((x) => owned[x.id]).length;
  const haveAll = MINERALS.filter((x) => owned[x.id]).length;
  const card = (x: Mineral) => {
    const n = owned[x.id] ?? 0;
    const deep = x.minDepth !== undefined && st.depth < x.minDepth;
    return (
      <button key={x.id} className={`mineral-card ${sel === x.id ? 'on' : ''} ${deep ? 'deep' : ''}`} style={n ? { borderColor: RARITY_COLORS[x.rarity] } : undefined} onClick={() => setSel(sel === x.id ? null : x.id)}>
        <img className="pixel" src={iconUrl('mineral', x.id, 2)} width={32} height={32} alt="" style={n ? undefined : { filter: 'brightness(0.15)' }} />
        <span>{n ? x.name : deep ? `od −${depthMeters(x.minDepth!)} m` : '???'}</span>
        {n > 0 && <span className="muted">×{n}</span>}
        {!n && deep && <Lock className="lock-mini" />}
        {!x.site && x.sites?.includes(s.activeSite) && <span className="star">★</span>}
      </button>
    );
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row"><span className="muted">Każde stanowisko ma {own.length} własnych minerałów — głębsze odsłaniają się dopiero, gdy zejdziesz niżej.</span><span className="spacer" /><b style={{ color: 'var(--accent)' }} title="Cała kolekcja minerałów">{haveAll} / {MINERALS.length}</b></div>
      <div className="row small" style={{ gap: 8 }}><b>Tego stanowiska</b><span className="muted">{haveSite} / {own.length}</span><span className="spacer" /></div>
      <Bar value={haveSite} max={own.length || 1} kind="purple" title="Minerały tego stanowiska" />
      <div className="mineral-grid">{own.map(card)}</div>
      <div className="row small" style={{ gap: 8, marginTop: 4 }}><b>Wszędzie</b><span className="muted">{haveCommon} / {COMMON_MINERALS.length} · ★ = częściej tutaj</span></div>
      <div className="mineral-grid">{COMMON_MINERALS.map(card)}</div>
      {mn && (
        <div className="hidden-row" style={{ alignItems: 'flex-start' }}>
          <img className="pixel" src={iconUrl('mineral', mn.id, 3)} width={48} height={48} alt="" style={owned[mn.id] ? undefined : { filter: 'brightness(0.15)' }} />
          <div className="body">
            <div className="top"><span>{owned[mn.id] ? mn.name : '???'}</span><span style={{ color: RARITY_COLORS[mn.rarity] }}>{RARITY_NAMES[mn.rarity]}</span></div>
            <span className="small">{owned[mn.id] ? mn.desc : mn.minDepth !== undefined ? `Jeszcze nieznaleziony. Pojawia się od głębokości −${depthMeters(mn.minDepth)} m.` : 'Jeszcze nieznaleziony minerał.'}</span>
            <span className="small muted">ok. {fmt(mn.coins)} monet (więcej z głębszych warstw){mn.site ? ` · tylko: ${SITE_BY_ID.get(mn.site)?.name}` : mn.sites?.length ? ` · częściej: ${mn.sites.map((id) => SITE_BY_ID.get(id)?.name).filter(Boolean).join(', ')}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ago(s: GameState, t: number): string {
  const d = Math.max(0, (s.now - t) / 1000);
  return d < 45 ? 'teraz' : d < 3600 ? `${Math.round(d / 60)} min temu` : d < 86400 ? `${Math.round(d / 3600)} h temu` : `${Math.round(d / 86400)} d temu`;
}

function LogRow({ s, f }: { s: GameState; f: FindEntry }) {
  const openGenus = useStore((x) => x.openGenus);
  const who = f.byCrew ? <span className="who" title="Znalazła ekipa"><Users className="ic" style={{ width: 13, height: 13, color: 'var(--muted)' }} /></span> : null;
  const time = <span className="t">{ago(s, f.t)}</span>;
  if (f.kind === 'fossil') {
    const g = GENERA.get(f.genusId!)!;
    return (
      <div className="log-row clickable" onClick={() => openGenus(g.id)}>
        <Bone className="ic" style={{ color: RARITY_COLORS[g.rarity] }} />
        <span><b>{g.name}</b> <span className="muted">· {QUALITY_NAMES[f.quality].toLowerCase()} · {f.pb ? `bank genów +${fmt(f.pb)} badań` : `do laboratorium (genom ${Math.floor(s.genome[g.id] ?? 0)}%)`}</span></span>
        {f.isNew && <span className="tag" style={{ color: '#ffe27a' }}>NOWY</span>}
        {who}{time}
      </div>
    );
  }
  const icon = <img className="pixel" src={smallIcon({ kind: f.kind, minorName: f.name, mineralId: f.mineral }, 1)} width={16} height={16} alt="" />;
  if (f.kind === 'mineral') {
    const mn = MINERAL_BY_ID.get(f.mineral ?? '');
    return <div className="log-row">{icon}<span><b style={{ color: mn ? RARITY_COLORS[mn.rarity] : undefined }}>{mn?.name ?? 'Minerał'}</b> <span className="muted">· +{fmt(f.coins ?? 0)} monet</span></span>{f.isNew && <span className="tag" style={{ color: '#e3cbff' }}>NOWY</span>}{who}{time}</div>;
  }
  if (f.kind === 'amber') return <div className="log-row">{icon}<span><b style={{ color: '#ffc47a' }}>Bursztyn</b> <span className="muted">· +1 mutagen</span></span>{who}{time}</div>;
  return <div className="log-row">{icon}<span className="muted" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} · +{fmt(f.pb ?? 0)} badań, +{fmt(f.coins ?? 0)} monet</span>{who}{time}</div>;
}

function DigLog({ s }: { s: GameState }) {
  const [minor, setMinor] = useState(false);
  const finds = (s.finds ?? []).filter((f) => minor || f.kind !== 'minor').slice(0, 14);
  return (
    <div className="panel">
      <div className="panel-head"><span className="lbl">Dziennik wykopu</span><Btn small on={minor} onClick={() => setMinor(!minor)} title="Pokaż też drobne skamieniałości"><Shell className="ic" />drobne</Btn></div>
      {finds.length === 0 && <div className="small muted">Jeszcze nic. Kość zalicza się, gdy odsłonisz <b>wszystkie</b> jej pola.</div>}
      <div>{finds.map((f, k) => <LogRow key={k} s={s} f={f} />)}</div>
      <details className="small legend" style={{ marginTop: 8 }}>
        <summary>Jak to działa?</summary>
        <p><b>Warstwa</b> kończy się dopiero, gdy wykopiesz każdy kamień. Ile w niej kości i skarbów — nie wiesz, dopóki ich nie odkopiesz.</p>
        <p><b>Kość</b> zajmuje 2–4 pola i zalicza się po odsłonięciu wszystkich. Obwódka świeci kolorem rzadkości i może urosnąć, gdy odsłaniasz więcej.</p>
        <p><b>Drobne</b> dają punkty badań i monety, <b>bursztyn</b> mutagen, <b>minerał</b> monety i miejsce w kolekcji. Bursztyn i minerały błyskają przez popękaną skałę.</p>
        <p><b>Warsztat</b> (klawisz U): siła, krytyki, seria, Gorączka, rozprysk i tlenie pędzla, młot i georadar. <b>Echo</b>: niebieskie fale = tuż obok coś leży. <b>Złoty błysk</b>: kliknij po nagrodę.</p>
      </details>
    </div>
  );
}

function LowerRow({ s }: { s: GameState }) {
  const [tab, setTab] = useState<'fauna' | 'minerals'>('fauna');
  return (
    <div className="dig-lower">
      <div className="panel">
        <div className="tabs">
          <button className={tab === 'fauna' ? 'on' : ''} onClick={() => setTab('fauna')}>Fauna tego stanowiska</button>
          <button className={tab === 'minerals' ? 'on' : ''} onClick={() => setTab('minerals')}>Minerały</button>
        </div>
        {tab === 'fauna' ? <FaunaTab s={s} /> : <MineralsTab s={s} />}
      </div>
      <DigLog s={s} />
    </div>
  );
}

function Discoveries({ s }: { s: GameState }) {
  const act = useStore((x) => x.act);
  const openGenus = useStore((x) => x.openGenus);
  const unseen = (s.discoveries ?? []).filter((d) => !d.seen);
  if (!unseen.length) return null;
  return (
    <div className="panel col" style={{ borderColor: '#a2762a', boxShadow: '0 0 0 1px #a2762a inset' }}>
      <div className="row">
        <h3 style={{ margin: 0, color: 'var(--accent)' }}><Sparkles className="ic" style={{ verticalAlign: -2, marginRight: 6 }} />Nowe odkrycia ({unseen.length})</h3>
        <span className="spacer" />
        <Btn small onClick={() => act((g) => g.discoveries.forEach((d) => { d.seen = true; }))}>Oznacz wszystkie jako obejrzane</Btn>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {unseen.slice(0, 24).map((d) => {
          const g = GENERA.get(d.genusId)!;
          return (
            <div key={d.genusId} className="item clickable" style={{ flexDirection: 'column', alignItems: 'flex-start' }}
              onClick={() => { act((st) => { const x = st.discoveries.find((y) => y.genusId === d.genusId); if (x) x.seen = true; }); openGenus(d.genusId); }}>
              <div style={{ alignSelf: 'center', minHeight: 50, display: 'flex', alignItems: 'flex-end' }}><SpriteImg genusId={g.id} scale={2} silhouette={!s.hatched[g.id]} /></div>
              <b><i>{g.name}</i></b>
              <span className="small muted">{periodLabel(g.fromMa, g.toMa)} · {Math.round(g.fromMa)}–{Math.round(g.toMa)} mln lat</span>
              <span className="small muted">{SITE_BY_ID.get(d.siteId)?.name}{d.byCrew ? ' · znalazła ekipa' : ' · Twoje znalezisko'}</span>
            </div>
          );
        })}
      </div>
      {unseen.length > 24 && <div className="small muted">…i {unseen.length - 24} więcej</div>}
    </div>
  );
}

// ---------------------------------------------------------------- screen

function SoundControl({ s }: { s: GameState }) {
  const act = useStore((x) => x.act);
  const v = s.settings.sound ?? 0.6;
  const set = (x: number) => { act((g) => { g.settings.sound = x; }); setVolume(x); if (x > 0) sfx.hit('brush'); };
  return (
    <span className="sound-ctl" title="Dźwięki kopania">
      <button className="iconbtn" aria-label={v > 0 ? 'Wycisz' : 'Włącz dźwięk'} onClick={() => set(v > 0 ? 0 : 0.6)}>{v > 0 ? <Volume2 className="ic" /> : <VolumeX className="ic" />}</button>
      <input type="range" min={0} max={1} step={0.05} value={v} aria-label="Głośność" onChange={(e) => set(Number(e.target.value))} />
    </span>
  );
}

function SiteHead({ s, openMap, setFocus }: { s: GameState; openMap: () => void; setFocus: (f: boolean) => void }) {
  const site = SITE_BY_ID.get(s.activeSite)!;
  const st = siteState(s, s.activeSite);
  const disc = site.fauna.filter((f) => s.discovered[f.genusId]).length;
  return (
    <div className="site-head">
      <Btn onClick={openMap}><MapIcon className="ic" />Mapa świata</Btn>
      <h1>{site.name}</h1>
      <span className="sub">{site.country} · {site.period}</span>
      <span className="spacer" />
      <span className="statpill" title="Gatunki z tego stanowiska: odkryte / wszystkie"><Bone className="ic" /><b>{disc}/{site.fauna.length}</b>fauna</span>
      <span className="statpill" title="Ukończone warstwy"><Layers className="ic" /><b>{st.layersDone}</b>warstw</span>
      <span className="statpill" title="Kości wykopane na tym stanowisku"><Pickaxe className="ic" /><b>{st.fossilsFound}</b>kości stąd</span>
      <span className="statpill" title="Odłamki skalne: zdobywasz je kopiąc, wydajesz w Warsztacie"><Hexagon className="ic" /><b>{fmt(s.shards ?? 0)}</b>odłamków</span>
      <SoundControl s={s} />
      <button className="iconbtn framed" onClick={() => setFocus(true)} aria-label="Tryb skupienia" title="Tryb skupienia: duże pole, mniej paneli (klawisz F)"><Maximize2 className="ic" /></button>
    </div>
  );
}

export function DigScreen() {
  const s = useGame();
  const [view, setView] = useState<'dig' | 'map'>('dig');
  const [focus, setFocus] = useState(false);
  const [shop, setShop] = useState(false);
  useEffect(() => { setVolume(s.settings.sound ?? 0.6); }, []);
  if (view === 'map') return <WorldMap s={s} onDig={() => setView('dig')} />;
  return (
    <div className="dig-screen">
      <SiteHead s={s} openMap={() => setView('map')} setFocus={setFocus} />
      <DigBoard key={s.activeSite} s={s} focus={focus} setFocus={setFocus} openShop={() => setShop(true)} />
      {!focus && <LowerRow s={s} />}
      {!focus && <Discoveries s={s} />}
      {shop && <Workshop s={s} onClose={() => setShop(false)} />}
    </div>
  );
}

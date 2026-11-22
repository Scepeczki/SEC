import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bone, BookOpen, Check, ChevronDown, ChevronRight, Clock, Coins, Flame, Layers, Lock, Map as MapIcon, Maximize2,
  Microscope, Minimize2, Paintbrush, Pickaxe, Radar, Shell, Sparkles, Users, Archive, Volume2, VolumeX, Wrench, Bomb, Hexagon, MousePointer2,
  Link2, RotateCw, Move, Copy, Star, Trophy, Hourglass, Skull, Lightbulb, Dna,
  Film,
} from 'lucide-react';
import { genusSpec, spriteUrl } from '../sprites';
import { Particles } from '../particles';
import { setVolume, sfx } from '../sound';
import { GENERA, SITE_BY_ID } from '../../data/db';
import { B, QUALITY_NAMES, RARITY_COLORS, RARITY_NAMES, fmt } from '../../game/balance';
import {
  CHEST_NAMES, DIR_NAMES, brushCells, canUseTool, claimGolden, comboMult, crewMode, depthMeters, dims, fossilRarityOdds, hitTile, layerReward, layerShards, layerStars,
  isTreasure, mineralChanceAt, previewChain, qualityOddsAt, richness, siteState, useTool as applyTool, type ChainStep, type HitResult,
} from '../../game/dig';
import { Workshop } from '../dig/Workshop';
import { ChestArt, ChestModal, TIER_COLOR } from '../dig/Chest';
import { COMMON_MINERALS, MINERALS, MINERAL_BY_ID, type Mineral, siteMinerals, strataFrom, stratumAt } from '../../game/geology';
import { mods, type Mods } from '../../game/mods';
import { incomePerSec } from '../../game/park';
import type { CrewMode, FindEntry, GameState, ItemKind, LayerItem, ModKind, PendingChest, PlayerTool, SiteState } from '../../game/state';
import { EPOCHS, SITE_ORDER, newCladesAt } from '../../data/epochs';
import { GLOW_CSS, MOD_CSS, TS, type LayerArt, artFor, cachedArt, drawFrame, iconUrl, itemUrl, radarZones } from '../dig/art';
import { Bar, Btn, SpriteImg } from '../components';
import { useGame, useStore } from '../store';
import { WorldMap } from './WorldMap';
import { LessonBtn } from '../Lesson';
import { ChapterTree } from '../story/ChapterTree';
import { useBeat } from '../story/Narrator';
import { chapterNo, chapterProgress, rockFound, siteRocks } from '../../game/story';
import { chapterTitle } from '../../data/story';

interface Snap { key: string; site: string; hp: number[]; found: boolean[]; items: LayerItem[] }
const snapOf = (key: string, site: string, st: SiteState): Snap => ({ key, site, hp: st.tiles.map((t) => t.hp), found: st.items.map((i) => i.found), items: st.items });

const QUALITY_COLORS = ['#9a8f80', '#c9d3dc', '#f2c14e'];
const KIND_COLOR: Record<ItemKind, string> = { fossil: '#eaa63a', minor: '#8fc7e8', amber: '#ff9d2e', mineral: '#c79bff' };
const DUST = ['#5a4936', '#6d5a44', '#87715a', '#a08a70', '#4a3c2c'];
const COLS = 'ABCDEFGHIJKLMNOP';
/** rarity names agreeing with „kość” (feminine) */
const RARITY_F = ['Pospolita', 'Rzadka', 'Bardzo rzadka', 'Legendarna'];
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pct = (x: number) => `${x < 0.01 && x > 0 ? '<1' : Math.round(x * 100)}%`;
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
const hardness = (depth: number) => B.tileHpExp ** depth * (1 + depth * B.tileHpPerDepth);
/** ms between two waves of a chain reaction on screen */
const WAVE = 90;

/** pixel icon of a minor find / amber / mineral */
const smallIcon = (it: { kind: ItemKind; minorName?: string; mineralId?: string }, scale = 2) =>
  it.kind === 'mineral' ? iconUrl('mineral', it.mineralId ?? 'kwarc', scale) : iconUrl(it.kind === 'amber' ? 'amber' : 'minor', it.kind === 'minor' ? (it.minorName?.length ?? 0) % 4 : 0, scale);

/** stash order: the order things were dug out */
type FoundOrder = WeakMap<LayerItem, number>;
const stashList = (items: LayerItem[], ord: FoundOrder) =>
  items.map((it, i) => ({ it, r: ord.get(it) ?? i - 1e6 })).filter((x) => x.it.found).sort((a, b) => a.r - b.r).map((x) => x.it);

// ---------------------------------------------------------------- modifiers and own tools: names and help

export const MOD_INFO: Record<ModKind, { name: string; desc: string }> = {
  arrow: { name: 'Iskra', desc: 'Rozbita niszczy pola w kierunku strzałki.' },
  bomb: { name: 'Ładunek', desc: 'Rozbity wybucha i kruszy wszystko dookoła.' },
  vein: { name: 'Żyła', desc: 'Rozsadza każdy kamień, który dotyka pustki połączonej z tym polem.' },
  key: { name: 'Zwornik', desc: 'Rozbity jako ostatni kamień w swoim wierszu zawala całą kolumnę.' },
  echo: { name: 'Rezonans', desc: 'Odpala najbliższe inne kamienie z modyfikatorami.' },
  gem: { name: 'Kryształ', desc: 'Pęknięty w reakcji podwaja jej mnożnik nagród.' },
};
const TOOLS: { id: PlayerTool; key: string; name: string; icon: typeof Bomb; help: string; steps: 1 | 2 }[] = [
  { id: 'bomb', key: '2', name: 'Ładunek', icon: Bomb, help: 'Kliknij kamień bez modyfikatora: dostanie ładunek, który wybuchnie, gdy kamień pęknie.', steps: 1 },
  { id: 'link', key: '3', name: 'Połącz', icon: Link2, help: 'Kliknij dwa kamienie: gdy pęknie jeden, pęknie i drugi.', steps: 2 },
  { id: 'rotate', key: '4', name: 'Obróć', icon: RotateCw, help: 'Kliknij strzałkę, żeby obrócić ją o 90°.', steps: 1 },
  { id: 'move', key: '5', name: 'Przesuń', icon: Move, help: 'Kliknij kamień z modyfikatorem, a potem pusty kamień, na który ma przejść.', steps: 2 },
  { id: 'copy', key: '6', name: 'Kopiuj', icon: Copy, help: 'Kliknij kamień z modyfikatorem, a potem kamień, który dostanie taki sam.', steps: 2 },
];

/** re-render every `ms` (small live readouts driven by refs) */
function useTicker(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

interface Live { s: GameState; st: SiteState; art: LayerArt; m: Mods }
interface HoverRef { idx: number; px: [number, number] | null }
interface Flight { it: LayerItem; items: LayerItem[] }
interface Glow { shown: number; open: number; flashUntil: number }
interface Golden { idx: number; until: number; next: number; items: LayerItem[] | null }
interface Msg { kind: 'hint' | 'rare1' | 'rare2' | 'rare3' | 'good' | 'fever'; text: string; sub?: string; until: number; icon?: 'bone' | 'sparkles' | 'flame' | 'check' | 'trophy' }
interface ChestPop { chest: PendingChest; until: number }
/** the last layer kept on screen while its final chain plays out */
interface Hold { st: SiteState; art: LayerArt; until: number }
interface LastChain { n: number; mult: number; open: boolean; at: number; gems: number }
interface MineralPopT { id: string; isNew: boolean; coins: number; until: number; key: number }
interface ToolState { tool: PlayerTool | null; picked: number }
const nextGolden = (now: number, every = 1) => now + (60 + Math.random() * 120) * 1000 * every;

/** tooltip next to the tile under the cursor */
function TileTip({ live, hover, golden, scale, preview, tool }: { live: React.MutableRefObject<Live>; hover: React.MutableRefObject<HoverRef>; golden: React.MutableRefObject<Golden>; scale: number; preview: React.MutableRefObject<ChainStep[] | null>; tool: ToolState }) {
  useTicker(100);
  const { st, art, m } = live.current;
  const i = hover.current.idx;
  if (i < 0 || !st.tiles[i] || tool.tool) return null;
  const { w } = dims(st);
  const t = st.tiles[i];
  const it = t.item >= 0 ? st.items[t.item] : null;
  const lines: React.ReactNode[] = [];
  let title = art.tileRock[i];
  if (t.hp > 0) {
    const hits = Math.ceil(t.hp / m.brushPower);
    lines.push(<span key="h">{COLS[i % w]}{Math.floor(i / w) + 1} · twardość ×{hardness(st.depth).toFixed(2)} · {hits} {plural(hits, 'pociągnięcie', 'pociągnięcia', 'pociągnięć')}</span>);
    if (t.mod) lines.push(<span key="m" style={{ color: MOD_CSS[t.mod] }}><b style={{ display: 'inline', fontSize: 12 }}>{MOD_INFO[t.mod].name}{t.mod === 'arrow' ? ` (${DIR_NAMES[t.dir ?? 0]})` : ''}:</b> {MOD_INFO[t.mod].desc}</span>);
    if (t.flint) lines.push(<span key="f" style={{ color: '#b9c8e6' }}><b style={{ display: 'inline', fontSize: 12 }}>Krzemień:</b> reakcja go nie skruszy (zatrzymuje łańcuch), tylko wybuch ładunku. Pędzlem rozbijesz go normalnie.</span>);
    if (t.link !== undefined) lines.push(<span key="l" style={{ color: '#ffecbe' }}>Połączony z {COLS[t.link % w]}{Math.floor(t.link / w) + 1}: pękną razem</span>);
    const p = preview.current;
    if (p && p.length > 1) {
      const waves = Math.max(...p.map((x) => x.gen));
      const k = comboMult(p.length, m);
      lines.push(<span key="c" className="gold">Reakcja: {p.length} {plural(p.length, 'pole', 'pola', 'pól')}{waves ? ` w ${waves + 1} falach` : ''}{k > 1 ? ` · mnożnik ×${k.toFixed(2)}` : ''}</span>);
    }
    if (golden.current.idx === i) lines.push(<span key="g" className="gold">Złoty błysk — kliknij po nagrodę!</span>);
    if (it && !it.found && it.cells.some((c) => st.tiles[c].hp <= 0)) lines.push(<span key="p" className="gold">Tu leży dalsza część kości</span>);
    else if (m.scanner >= 3 && it && !it.found && radarZones(st, m.scanner).some((z) => z.item === t.item)) lines.push(<span key="s" style={{ color: KIND_COLOR[it.kind] }}>Georadar: {it.kind === 'fossil' ? 'kość' : it.kind === 'minor' ? 'drobna skamieniałość' : it.kind === 'amber' ? 'bursztyn' : 'minerał'}</span>);
    else if (m.scanner && radarZones(st, m.scanner).some((z) => z.tiles.has(i) && !st.items[z.item].found)) lines.push(<span key="s" className="blue">Georadar: {m.scanner >= 3 ? 'tuż obok coś leży' : 'coś leży w tej okolicy'}</span>);
  } else {
    if (it && !it.found) { title = 'Odsłonięta część znaleziska'; lines.push(<span key="p">Odkop pola ze złotymi narożnikami obok.</span>); }
    else return null;
  }
  const segs = Math.min(8, Math.max(1, Math.ceil(t.max / m.brushPower)));
  const on = Math.ceil((t.hp / t.max) * segs);
  const x = (i % w) * TS * scale, y = Math.floor(i / w) * TS * scale;
  const right = (i % w) < w - 3;
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
  const { w } = dims(st);
  return (
    <>
      {st.items.map((it, k) => {
        if (it.found || it.kind !== 'fossil') return null;
        const open = it.cells.filter((c) => st.tiles[c].hp <= 0);
        if (!open.length) return null;
        const lvl = glow.current.get(it)?.shown ?? 0;
        const xs = it.cells.map((c) => (c % w) + 0.5), ys = it.cells.map((c) => Math.floor(c / w));
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
  const I = m.icon === 'flame' ? Flame : m.icon === 'check' ? Check : m.icon === 'bone' ? Bone : m.icon === 'trophy' ? Trophy : Sparkles;
  return (
    <div className={`field-msg ${m.kind}`}>
      <I className="ic" style={{ width: 20, height: 20 }} />
      <div>{m.text}{m.sub && <small>{m.sub}</small>}</div>
    </div>
  );
}

/** a mineral just came out of the rock: a big glowing card with the crystal */
function MineralPop({ pops }: { pops: React.MutableRefObject<MineralPopT[]> }) {
  useTicker(120);
  const now = performance.now();
  const p = pops.current.find((x) => x.until > now);
  if (!p) return null;
  const mn = MINERAL_BY_ID.get(p.id);
  if (!mn) return null;
  const c = RARITY_COLORS[mn.rarity];
  return (
    <div key={p.key} className="mineral-pop" style={{ ['--c' as string]: c, ['--g' as string]: mn.color }}>
      <span className="mp-gem"><img className="pixel" src={iconUrl('mineral', mn.id, 5)} width={80} height={80} alt="" /></span>
      <span className="mp-body">
        <span className="mp-kicker">{p.isNew ? 'Nowy minerał!' : 'Minerał'}</span>
        <b>{mn.name}</b>
        <span className="mp-rar" style={{ color: c }}>{RARITY_NAMES[mn.rarity]}{p.isNew ? ' · do kolekcji' : ''}</span>
        <span className="mp-coins"><Coins className="ic" />+{fmt(p.coins)}</span>
      </span>
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

/** the last chain, the open combo, manual breaks in this layer and the records */
function ChainPill({ s, st, m, last, openShop }: { s: GameState; st: SiteState; m: Mods; last: React.MutableRefObject<LastChain | null>; openShop: () => void }) {
  useTicker(150);
  const l = last.current;
  const fresh = l && performance.now() - l.at < 4000;
  const manual = st.manual ?? 0;
  const stars = layerStars(Math.max(1, manual), m);
  const rec = s.digRecords ?? { combo: 0, fewest: 0, oneHit: 0, stars3: 0 };
  const noMods = !Object.values(m.modRate).some((x) => x > 0) && !Object.values(m.uses).some((x) => x > 0);
  if (noMods) {
    return (
      <button className="combo locked" onClick={openShop} title="Reakcje łańcuchowe odblokujesz w Warsztacie (gałąź Skała → Iskra)">
        <Lock className="ic" /><span className="note">Reakcje łańcuchowe: odblokuj „Iskrę” w Warsztacie</span>
      </button>
    );
  }
  return (
    <div className={`combo ${fresh && l!.n >= 10 ? 'm3' : ''} ${fresh && l!.n >= 20 ? 'fever' : ''}`}>
      <span className="col" style={{ gap: 0 }}>
        <span className="muted small">{st.combo ? 'Combo trwa' : 'Ostatnia reakcja'}</span>
        <span className="mult">{st.combo ? st.combo.n : fresh ? l!.n : '–'}<small> {plural(st.combo ? st.combo.n : l?.n ?? 0, 'pole', 'pola', 'pól')}</small></span>
      </span>
      <span className="col" style={{ gap: 0 }} title={`Combo liczy się od ${m.comboMin} pól. Każde pole ponad próg: +${Math.round(m.comboStep * 100)}% odłamków i łupów.`}>
        <span className="muted small">mnożnik</span>
        <span className="mult blue">×{(st.combo ? comboMult(st.combo.n, m, st.combo.gems) : fresh ? l!.mult : 1).toFixed(2)}</span>
      </span>
      {st.combo && <span className="note"><Hourglass className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> jeszcze {st.combo.left} {plural(st.combo.left, 'rozbicie', 'rozbicia', 'rozbić')}</span>}
      <span className="sep-v" />
      <span className="col" style={{ gap: 0 }} title={`Ręczne rozbicia w tej warstwie. 3 gwiazdki do ${m.starsAt}, 2 do ${m.starsAt * 2 + 2}: lepsza nagroda za warstwę i większa szansa na lepszą skrzynię.`}>
        <span className="muted small">ruchy w warstwie</span>
        <span className="mult">{manual}<span className="stars">{[1, 2, 3].map((k) => <Star key={k} className={`ic ${k <= stars ? 'on' : ''}`} />)}</span></span>
      </span>
      <span className="col rec" style={{ gap: 0 }} title="Twoje rekordy: najdłuższe combo, najmniej ruchów na całą warstwę, warstwy jednym uderzeniem">
        <span className="muted small"><Trophy className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> rekordy</span>
        <span className="small"><b>{rec.combo}</b> combo · <b>{rec.fewest || '–'}</b> ruch.{rec.oneHit ? <> · <b>{rec.oneHit}</b>× jednym</> : null}</span>
      </span>
    </div>
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
  const pending = useRef(new Map<number, number>());
  const hold = useRef<Hold | null>(null);
  const heat = useRef(0);
  const lastChain = useRef<LastChain | null>(null);
  const minerals = useRef<MineralPopT[]>([]);
  const preview = useRef<ChainStep[] | null>(null);
  const previewKey = useRef('');
  const golden = useRef<Golden>({ idx: -1, until: 0, next: nextGolden(performance.now(), m.goldenEvery), items: null });
  const glow = useRef(new WeakMap<LayerItem, Glow>());
  const msg = useRef<Msg | null>(null);
  const chest = useRef<ChestPop | null>(null);
  const [chestOpen, setChestOpen] = useState<PendingChest | null>(null);
  const [tool, setToolState] = useState<ToolState>({ tool: null, picked: -1 });
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const setTool = (t: PlayerTool | null) => setToolState({ tool: t, picked: -1 });
  const [log, setLog] = useState(false);
  const fit = useFits();
  const hintShown = useRef(false);
  const say = (m2: Omit<Msg, 'until'>, ms = 3000) => { msg.current = { ...m2, until: performance.now() + ms }; };

  useEffect(() => { setVolume(s.settings.sound ?? 0.6); }, [s.settings.sound]);
  useEffect(() => {
    fx.attach(fxRef.current);
    return () => { fx.dispose(); clearTimeout(doneTimer.current); };
  }, [fx]);

  // integer pixel scale that fits the available space (width, and height when the screen fits the window)
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { art } = live.current;
      const w = Math.floor((el.clientWidth - 24) / art.GW);
      const h = focus || fitsWindow() ? Math.floor((el.clientHeight - 24) / art.GH) : 99;
      setScale(Math.max(2, Math.min(7, w, h)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [focus, fit, art.GW, art.GH]);

  /** centre of a tile in particle-canvas coordinates (+ screen coordinates); uses the layer on screen */
  const center = (idx: number) => {
    const c = canvasRef.current, f = fxRef.current;
    if (!c || !f) return { x: 0, y: 0, sx: 0, sy: 0 };
    const view = hold.current && performance.now() < hold.current.until ? hold.current : live.current;
    const W = view.art.w;
    const r = c.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const sz = r.width / W;
    const sx = r.left + ((idx % W) + 0.5) * sz, sy = r.top + (Math.floor(idx / W) + 0.5) * sz;
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
    let ctx = c.getContext('2d')!;
    let img: ImageData | null = null;
    let raf = 0;
    // a frame that throws must never stop the loop (a frozen canvas looks like rock that never breaks)
    const loop = () => {
      try { frame(); } catch (e) { console.error('dig frame', e); }
      raf = requestAnimationFrame(loop);
    };
    const frame = () => {
      const now = performance.now();
      const h0 = hold.current && now < hold.current.until ? hold.current : null;
      if (!h0 && hold.current) hold.current = null;
      const { st: liveSt, art: liveArt, m, s } = live.current;
      const st = h0?.st ?? liveSt, art = h0?.art ?? liveArt;
      if (c.width !== art.GW || c.height !== art.GH || !img) {
        c.width = art.GW; c.height = art.GH;
        ctx = c.getContext('2d')!;
        img = ctx.createImageData(art.GW, art.GH);
      }
      const gd = golden.current;
      if (gd.idx >= 0 && (now > gd.until || gd.items !== liveSt.items || !liveSt.tiles[gd.idx] || liveSt.tiles[gd.idx].hp <= 0)) gd.idx = -1;
      if (gd.idx < 0 && now > gd.next && !h0) {
        const cand = liveSt.tiles.map((t, i) => (t.hp > 0 && t.item < 0 && !t.mod ? i : -1)).filter((i) => i >= 0);
        if (cand.length) { gd.idx = cand[Math.floor(Math.random() * cand.length)]; gd.until = now + 6000; gd.items = liveSt.items; }
        gd.next = nextGolden(now, m.goldenEvery);
      }
      // rarity glow ladder: the first glimpse may undersell the bone; each newly uncovered cell can raise it
      if (!h0) liveSt.items.forEach((it) => {
        if (it.kind !== 'fossil' || it.found) return;
        const open = it.cells.filter((ci) => liveSt.tiles[ci].hp <= 0 && !((pending.current.get(ci) ?? 0) > now)).length;
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
            const p = centerOf(it.cells.filter((ci) => liveSt.tiles[ci].hp <= 0));
            fx.sparks(p.x, p.y, 10, GLOW_CSS[g.shown]);
            sfx.reveal(g.shown);
            say({ kind: `rare${g.shown}` as Msg['kind'], icon: 'bone', text: `Blask rośnie: ${RARITY_F[g.shown].toLowerCase()} kość!`, sub: left ? `Zostało ${left} ${plural(left, 'pole', 'pola', 'pól')}` : undefined });
          }
        }
      });
      // what would break from here (refreshed when the hover or the layer changes)
      const h = hover.current;
      const t = toolRef.current;
      let area: number[] = [];
      let pv: Map<number, number> | null = null;
      if (!h0 && h.idx >= 0 && !t.tool && liveSt.tiles[h.idx]?.hp > 0) {
        area = brushCells(liveSt, h.idx, m.brushArea);
        const k = `${h.idx}:${liveSt.items.length}:${liveSt.tiles.reduce((a, x, i) => a + (x.hp > 0 ? i * 7 + (x.mod ? 3 : 0) + (x.dir ?? 0) + (x.link ?? 0) : 0), 0)}`;
        if (k !== previewKey.current || !preview.current) { previewKey.current = k; preview.current = previewChain(liveSt, area, m); }
        pv = new Map(preview.current.map((x) => [x.idx, x.gen]));
      } else { preview.current = null; previewKey.current = ''; }
      // own-modifier tool targets
      let targets: Set<number> | null = null;
      if (t.tool && !h0) {
        targets = new Set();
        const tl = t.tool;
        liveSt.tiles.forEach((_, i) => { if (t.picked < 0 ? canUseTool(liveSt, tl, i).ok : canUseTool(liveSt, tl, t.picked, i).ok) targets!.add(i); });
      }
      heat.current = Math.max(0, heat.current - 0.012);
      drawFrame(img, {
        st, art, t: now, hover: h0 ? -1 : h.idx, hoverPx: h.px, area, preview: pv,
        scanner: m.scanner, golden: h0 ? -1 : gd.idx, press: press.current, pending: pending.current,
        glow: (k) => glow.current.get(st.items[k])?.shown ?? -1,
        glowFlash: (k) => Math.max(0, ((glow.current.get(st.items[k])?.flashUntil ?? 0) - now) / 300),
        sonar: m.sonar, glintAll: m.radarGlint, targets, picked: t.picked, heat: heat.current,
      });
      ctx.putImageData(img, 0, 0);
      void s;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  /** burst + label + sound where the item was dug out */
  const celebrate = (g: GameState, it: LayerItem) => {
    const { x, y } = centerOf(it.cells);
    const f = (g.finds ?? []).slice(0, 16).find((e) => e.kind === it.kind && e.genusId === it.genusId && (it.kind === 'mineral' ? e.mineral === it.mineralId : e.name === it.minorName));
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
      const col = mn?.color ?? '#c79bff';
      // a mineral is a moment: a ring of crystal sparks, a flash, a chime and a card with the stone
      fx.sparks(x, y, 34 + (mn?.rarity ?? 0) * 10, col);
      fx.sparks(x, y, 18, '#ffffff');
      fx.sparks(x, y, 14, RARITY_COLORS[mn?.rarity ?? 0]);
      sfx.find('mineral', mn?.rarity ?? 0);
      sfx.crystal(mn?.rarity ?? 0);
      if ((mn?.rarity ?? 0) >= 2 || f?.isNew) shake(false);
      fx.text(x, y - 6, `${mn?.name ?? 'Minerał'} +${fmt(f?.coins ?? 0)} 💰`, '#efe0ff', 15);
      if (it.mineralId) minerals.current = [...minerals.current.filter((p) => p.until > performance.now()), { id: it.mineralId, isNew: !!f?.isNew, coins: f?.coins ?? 0, until: performance.now() + 2800, key: Math.random() }];
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
    const k = Math.max(2, Math.round((canvasRef.current?.getBoundingClientRect().width ?? 480) / (a?.GW ?? 160)));
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

  // every render: diff against the last snapshot → dust where crews dig, celebrate + fly every new find (after its rock breaks on screen)
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
          fx.chips(p.x, p.y, [art.tileCss[i] ?? DUST[0], ...DUST], 2, 0.5);
        }
      }
    }
    const now = performance.now();
    const fresh = prev.items.filter((it, j) => it.found && !prev.found[j]);
    for (const it of fresh) {
      order.current.set(it, ++orderSeq.current);
      const at = Math.max(0, ...it.cells.map((c) => pending.current.get(c) ?? 0));
      const go = () => { celebrate(live.current.s, it); flights.current.push({ it, items: prev.items }); launchReady(); };
      if (at > now + 10) window.setTimeout(go, at - now + 60); else go();
    }
    if (newLayer) {
      const wait = Math.max(0, (hold.current?.until ?? 0) - now);
      const out = st.lastDone;
      window.setTimeout(() => {
        const el = stageRef.current;
        if (el && !reducedMotion()) { el.classList.remove('descend'); void el.offsetWidth; el.classList.add('descend'); }
        const { st: cst } = live.current;
        for (let c = 0; c < cst.tiles.length; c += 3) { const p = center(c); fx.dust(p.x, p.y, 2, '#bba98a'); }
        if (out?.n === cst.layersDone && out.chest && 'tier' in out.chest) {
          chest.current = { chest: out.chest, until: performance.now() + 9000 };
          const mid = center(Math.floor(cst.tiles.length / 2));
          fx.sparks(mid.x, mid.y, 50, '#ffcf4a');
          sfx.chest();
        } else sfx.layer();
        const at2 = stratumAt(s.activeSite, cst.depth), was = stratumAt(s.activeSite, cst.depth - 1);
        const stars = out?.stars ? ` · ${'★'.repeat(out.stars)}${'☆'.repeat(3 - out.stars)}` : '';
        const moves = out?.manual ? ` · ${out.manual} ${plural(out.manual, 'ruch', 'ruchy', 'ruchów')}` : '';
        say(out?.manual === 1
          ? { kind: 'fever', icon: 'trophy', text: 'Cała warstwa jednym uderzeniem!', sub: `Warstwa ${cst.depth}${stars}` }
          : at2.s.name !== was.s.name
            ? { kind: 'good', icon: 'check', text: `Nowa skała: ${at2.s.name}`, sub: `Warstwa ${cst.depth + 1} · −${depthMeters(cst.depth)} m${stars}${moves}` }
            : { kind: 'good', icon: 'check', text: `Warstwa ${cst.depth} wykopana!${stars}`, sub: out?.bonus ? `+${fmt(out.bonus.coins)} monet · +${out.bonus.pb} badań · +${layerShards(cst.depth)} odłamków${moves}` : undefined }, 2800);
      }, wait);
      clearTimeout(doneTimer.current);
      setDoneLayer(prev.items);
      doneTimer.current = window.setTimeout(() => setDoneLayer(null), 2200 + wait);
    }
    if (fresh.length) setArriving((a) => { const nx = new Set(a); fresh.forEach((it) => nx.add(it)); return nx; });
  });

  // launch queued flights once their stash slots are on screen
  const launchReady = () => {
    const shown = doneLayerRef.current ?? live.current.st.items;
    const ready = flights.current.filter((f) => f.items === shown);
    flights.current = flights.current.filter((f) => f.items !== shown);
    ready.forEach(launch);
  };
  const doneLayerRef = useRef<LayerItem[] | null>(null);
  doneLayerRef.current = doneLayer;
  useLayoutEffect(() => { if (flights.current.length) launchReady(); });

  const claimGoldenFlash = (i: number) => {
    golden.current.idx = -1;
    const r = act((g) => claimGolden(g, g.activeSite));
    const p = center(i);
    fx.sparks(p.x, p.y, 30, '#ffd75a');
    sfx.golden();
    const label = r.kind === 'coins' ? `+${fmt(r.amount)} 💰` : r.kind === 'pb' ? `+${fmt(r.amount)} 🔬` : r.kind === 'mutagen' ? '+1 🧪 mutagen' : r.kind === 'charge' ? '+1 ładunek do podłożenia' : 'Pewna kość';
    fx.text(p.x, p.y - 8, `✦ ${label}`, '#ffe27a', 16);
    if (r.kind === 'charge') say({ kind: 'hint', icon: 'sparkles', text: 'Złoty błysk: darmowy ładunek!', sub: 'Wybierz „Ładunek” (klawisz 2) i podłóż go pod dowolny kamień' }, 3200);
    if (r.kind === 'reveal' && r.cell !== undefined) { const q = center(r.cell); fx.dust(q.x, q.y, 6, '#d8c49a'); fx.sparks(q.x, q.y, 12, '#ffd75a'); }
  };

  /** play a chain reaction wave by wave, then show the combo */
  const playChain = (res: HitResult, stepsArt: LayerArt) => {
    const t0 = performance.now();
    const byGen = new Map<number, ChainStep[]>();
    for (const x of res.steps) {
      pending.current.set(x.idx, t0 + x.gen * WAVE);
      const arr = byGen.get(x.gen) ?? [];
      arr.push(x);
      byGen.set(x.gen, arr);
    }
    const last = Math.max(0, ...byGen.keys());
    for (const [gen, list] of byGen) {
      const run = () => {
        for (const x of list) {
          const p = center(x.idx);
          const col = stepsArt.tileCss[x.idx] ?? DUST[0];
          fx.chips(p.x, p.y, [col, col, ...DUST], x.cause === 'hit' ? 9 : 6, x.cause === 'bomb' ? 1.5 : 1.1);
          fx.dust(p.x, p.y, 2, '#a8977a');
          if (x.cause !== 'hit' && x.cause !== 'crew') fx.sparks(p.x, p.y, 3, x.cause === 'link' ? '#ffecbe' : MOD_CSS[x.cause as ModKind] ?? '#ffcf6a');
          const t = (stepsArt === live.current.art ? live.current.st : hold.current?.st)?.tiles[x.idx];
          if (t?.mod === 'bomb') { fx.sparks(p.x, p.y, 22, '#ffb347'); fx.sparks(p.x, p.y, 10, '#fff1b8'); }
        }
        if (gen > 0) sfx.chain(gen, list.length);
        if (list.some((x) => x.cause === 'bomb')) { sfx.boom(list.length > 12); shake(true); }
        else if (gen >= 3 && gen % 2) shake(false);
      };
      if (gen === 0) run(); else window.setTimeout(run, gen * WAVE);
    }
    const c = res.combo;
    if (!c) return;
    window.setTimeout(() => {
      lastChain.current = { n: c.n, mult: c.mult, open: c.open, at: performance.now(), gems: c.gems };
      if (c.added < 2 && !c.open) return;
      const tail = res.steps.filter((x) => x.gen === last).map((x) => x.idx);
      const p = centerOf(tail.length ? tail : [res.steps[0].idx]);
      const big = c.n >= 10;
      if (c.mult > 1) {
        fx.text(p.x, p.y - 18, `COMBO ${c.n}! ×${c.mult.toFixed(2)}`, c.n >= 20 ? '#ff9a5a' : '#ffd76a', big ? 20 : 16);
        sfx.combo(c.n);
        if (big) heat.current = Math.min(1, 0.4 + c.n / 40);
      } else if (c.n >= 3) fx.text(p.x, p.y - 14, `${c.n} pól`, '#f3e3bd', 14);
      if (c.gems) fx.text(p.x, p.y + 6, `Kryształ ×${2 ** c.gems}!`, '#8af0b4', 14);
      if (res.shards && c.mult > 1) fx.text(p.x, p.y + 22, `+${fmt(res.shards)} odłamków`, '#e8dcb8', 13);
      c.loot.forEach((l, k) => {
        const txt = l.kind === 'coins' ? `Łup: +${fmt(l.amount)} 💰` : l.kind === 'pb' ? `Łup: +${fmt(l.amount)} 🔬` : l.kind === 'mutagen' ? 'Łup: +1 🧪' : `Łup: ${MINERAL_BY_ID.get(l.mineralId ?? '')?.name ?? 'minerał'}`;
        window.setTimeout(() => fx.text(p.x, p.y - 40, txt, '#ffe27a', 15), 250 * (k + 1));
      });
      if (c.record) say({ kind: 'rare3', icon: 'trophy', text: `Nowy rekord combo: ${c.n}!`, sub: 'Najdłuższa reakcja w całej grze' }, 3200);
      else if (c.quake) say({ kind: 'fever', icon: 'flame', text: 'Wstrząs!', sub: 'Pozostałe kamienie popękały' }, 2200);
      else if (c.refund) say({ kind: 'good', icon: 'sparkles', text: 'Oszczędna ręka', sub: 'Odzyskujesz po jednym użyciu narzędzi' }, 2200);
      else if (c.open) say({ kind: 'hint', icon: 'sparkles', text: `Combo ${c.n} trwa`, sub: 'Następne ręczne rozbicie doliczy się do tej reakcji' }, 2000);
    }, last * WAVE + 60);
  };

  const onHit = (i: number, auto = false) => {
    const now = performance.now();
    if (hold.current && now < hold.current.until) return; // the last chain of the layer is still playing
    if (golden.current.idx === i) { if (!auto) claimGoldenFlash(i); return; }
    const { st: cst, art: cart, m: cm } = live.current;
    const cells = brushCells(cst, i, cm.brushArea);
    if (!cells.length) return;
    const colors = cells.map((ci) => cart.tileCss[ci]);
    cells.forEach((ci) => { playerHits.current.add(ci); press.current.set(ci, now + 80); });
    // keep the old layer for the animation in case this break finishes it
    const before = { tiles: cst.tiles, items: cst.items, st: { ...cst }, art: cart };
    for (const [k, v] of pending.current) if (v < now - 1500) pending.current.delete(k);
    const res = act((g) => hitTile(g, g.activeSite, i));
    sfx.hit('brush', 0, res.crit);
    cells.forEach((ci, k) => {
      const p = center(ci);
      fx.chips(p.x, p.y, [colors[k], colors[k], ...DUST], ci === i ? 6 : 4, 1);
      fx.dust(p.x, p.y, 2, '#a8977a');
    });
    if (res.crit) { const p = center(i); fx.text(p.x, p.y - 12, 'KRYT!', '#ffc45a', 13); }
    if (!res.steps.length) return;
    res.steps.forEach((x) => playerHits.current.add(x.idx));
    sfx.crumble(res.steps.length > 4);
    const lastGen = Math.max(...res.steps.map((x) => x.gen));
    if (res.layerDone) {
      hold.current = { st: { ...before.st, tiles: before.tiles, items: before.items }, art: before.art, until: now + lastGen * WAVE + 450 };
      setTool(null);
    }
    playChain(res, before.art);
  };

  /** click with one of your own modifiers selected */
  const onTool = (i: number) => {
    const t = toolRef.current;
    if (!t.tool) return;
    const { st: cst } = live.current;
    const def = TOOLS.find((x) => x.id === t.tool)!;
    const p = center(i);
    if (def.steps === 2 && t.picked < 0) {
      const c = canUseTool(cst, t.tool, i);
      if (!c.ok) { say({ kind: 'hint', icon: 'sparkles', text: c.why ?? 'Nie tutaj' }, 1600); return; }
      setToolState({ tool: t.tool, picked: i });
      sfx.click();
      return;
    }
    const a = def.steps === 2 ? t.picked : i, b = def.steps === 2 ? i : undefined;
    const c = canUseTool(cst, t.tool, a, b);
    if (!c.ok) { say({ kind: 'hint', icon: 'sparkles', text: c.why ?? 'Nie tutaj' }, 1600); if (def.steps === 2) setToolState({ tool: t.tool, picked: -1 }); return; }
    const tl = t.tool;
    act((g) => applyTool(g, g.activeSite, tl, a, b));
    sfx.tool();
    fx.sparks(p.x, p.y, 12, '#9ff0b8');
    if (b !== undefined) { const q = center(a); fx.sparks(q.x, q.y, 8, '#9ff0b8'); }
    const left = live.current.st.uses?.[tl] ?? 0;
    setToolState({ tool: left > 0 ? tl : null, picked: -1 });
  };

  // automatic digging: the brush keeps hitting the tile under the cursor (workshop upgrade)
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  useEffect(() => {
    let last = performance.now(), acc = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const { s, st, m } = live.current;
      const i = hover.current.idx;
      const rate = s.settings.autoDig === false || toolRef.current.tool ? 0 : m.autoBrush;
      if (!rate || i < 0 || !st.tiles[i] || st.tiles[i].hp <= 0 || document.hidden || !document.hasFocus()) { acc = 0; return; }
      acc += dt * rate;
      if (acc >= 1) { acc -= 1; onHitRef.current(i, true); }
    }, 40);
    return () => clearInterval(id);
  }, []);

  // keyboard: 1 brush · 2–6 own modifiers · A auto-dig · F focus mode · Esc cancel / leave · U workshop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const { m, st } = live.current;
      const tl = TOOLS.find((x) => x.key === e.key);
      if (e.key === '1') setTool(null);
      else if (tl && (st.uses?.[tl.id] ?? 0) > 0) setTool(toolRef.current.tool === tl.id ? null : tl.id);
      else if ((e.key === 'a' || e.key === 'A') && m.autoBrush) act((g) => { g.settings.autoDig = g.settings.autoDig === false; });
      else if (e.key === 'f' || e.key === 'F') setFocus(!focus);
      else if (e.key === 'u' || e.key === 'U') openShop();
      else if (e.key === 'Escape') { if (toolRef.current.tool) setTool(null); else if (focus) setFocus(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  const toTile = (e: React.PointerEvent<HTMLCanvasElement>): HoverRef => {
    const r = e.currentTarget.getBoundingClientRect();
    const { art: a } = live.current;
    const x = ((e.clientX - r.left) / r.width) * a.GW, y = ((e.clientY - r.top) / r.height) * a.GH;
    const inside = x >= 0 && y >= 0 && x < a.GW && y < a.GH;
    return { idx: inside ? Math.floor(y / TS) * a.w + Math.floor(x / TS) : -1, px: inside ? [x, y] : null };
  };

  const toolDef = tool.tool ? TOOLS.find((x) => x.id === tool.tool)! : null;
  const field = (
    <div ref={fieldRef} className="dig-main" style={focus || fit ? { height: '100%', justifyContent: 'center' } : undefined}>
      <div ref={stageRef} className={`dig-stage ${tool.tool ? 'tooling' : ''}`}>
        <canvas
          ref={canvasRef}
          className="dig-canvas pixel"
          style={{ width: art.GW * scale, height: art.GH * scale, cursor: tool.tool ? 'crosshair' : 'pointer' }}
          onPointerMove={(e) => { hover.current = toTile(e); }}
          onPointerLeave={() => { hover.current = { idx: -1, px: null }; }}
          onContextMenu={(e) => { if (toolRef.current.tool) { e.preventDefault(); setTool(null); } }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const t = toTile(e);
            hover.current = t;
            if (t.idx < 0) return;
            if (toolRef.current.tool) { onTool(t.idx); return; }
            if (st.tiles[t.idx]?.hp > 0) onHit(t.idx);
          }}
        />
        <FieldMsg msg={msg} />
        <MineralPop pops={minerals} />
        <FindLabels st={st} glow={glow} scale={scale} />
        <TileTip live={live} hover={hover} golden={golden} scale={scale} preview={preview} tool={tool} />
        <ChestCard pop={chest} s={s} onOpen={setChestOpen} />
        <ChestWaiting s={s} onOpen={setChestOpen} />
        {toolDef && (
          <div className="tool-hint">
            <toolDef.icon className="ic" />
            <span><b>{toolDef.name}</b>{toolDef.steps === 2 && tool.picked >= 0 ? ' — teraz wskaż drugi kamień' : ` — ${toolDef.help}`}</span>
            <button className="btn small" onClick={() => setTool(null)}>Anuluj <kbd>Esc</kbd></button>
          </div>
        )}
      </div>
      {chestOpen && <ChestModal s={s} chest={chestOpen} onClose={() => setChestOpen(null)} />}
    </div>
  );
  const anyTool = TOOLS.some((x) => m.uses[x.id] > 0 || (st.uses?.[x.id] ?? 0) > 0);
  const toolbar = (
    <div className="toolbar">
      <button className={`tool ${!tool.tool ? 'on' : ''}`} onClick={() => setTool(null)} title="Pędzel: kliknij kamień, żeby go rozbić. Najedź, a zobaczysz, jaką reakcję uruchomi.">
        <kbd className="key">1</kbd><Paintbrush className="ic" style={{ width: 22, height: 22 }} />Pędzel<small>moc {m.brushPower.toFixed(2)}{m.brushArea ? ` · ${m.brushArea === 1 ? '2 pola' : '2×2'}` : ''}</small>
      </button>
      {TOOLS.map((x) => {
        const max = m.uses[x.id], left = st.uses?.[x.id] ?? 0;
        const locked = max === 0 && left === 0;
        if (locked && !anyTool && x.id !== 'bomb') return null;
        return (
          <button key={x.id} className={`tool ${tool.tool === x.id ? 'on' : ''} ${locked ? 'locked' : ''}`} disabled={!locked && left <= 0}
            onClick={() => (locked ? openShop() : setTool(tool.tool === x.id ? null : x.id))}
            title={locked ? `Odblokuj w Warsztacie (Ręka geologa): ${x.name}` : `${x.help} Zostało ${left} w tej warstwie.`}>
            <kbd className="key">{x.key}</kbd>{locked && <Lock className="lock" />}<x.icon className="ic" style={{ width: 22, height: 22 }} />{x.name}
            <small>{locked ? 'Warsztat' : `${left}/${Math.max(max, left)}`}</small>
          </button>
        );
      })}
      <button className={`tool passive ${m.scanner ? 'on' : ''}`} onClick={openShop} title={m.scanner ? `Georadar poziom ${m.scanner}: działa sam. Ulepszaj w Warsztacie.` : 'Odblokuj w Warsztacie: Georadar'}>
        {!m.scanner && <Lock className="lock" />}<Radar className="ic" style={{ width: 22, height: 22 }} />Georadar<small>{m.scanner ? `poziom ${['', 'I', 'II', 'III', 'IV'][m.scanner]}` : 'Warsztat'}</small>
      </button>
      {m.autoBrush > 0 && (
        <button className={`tool auto ${s.settings.autoDig !== false ? 'on' : ''}`} onClick={() => act((g) => { g.settings.autoDig = g.settings.autoDig === false; })}
          title="Automatyczne kopanie: pędzel sam uderza w pole pod kursorem — wystarczy wodzić myszką (klawisz A)">
          <kbd className="key">A</kbd><MousePointer2 className="ic" style={{ width: 22, height: 22 }} />Auto<small>{s.settings.autoDig !== false ? `${m.autoBrush}/s` : 'wyłączone'}</small>
        </button>
      )}
      <button className="tool shop" onClick={openShop} title="Drzewko umiejętności: reakcje, modyfikatory, narzędzia i ekipy (klawisz U)">
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
          <div className="hud col" style={{ gap: 10 }}><span className="lbl">Reakcje</span><ChainPill s={s} st={st} m={m} last={lastChain} openShop={openShop} /></div>
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
      <LeftPanel s={s} st={st} />
      <div className="panel dig-center">
        <div className="dig-center-head">
          <div className="title"><span className="lbl">Warstwa {st.depth + 1} · {dims(st).w}×{dims(st).h}</span><b>{at.s.name}</b>
            <span className={`rich ${isTreasure(st.depth) ? 'treasure' : richness(st.depth) < 1 ? 'lean' : richness(st.depth) > 1 ? 'good' : ''}`} title="Rytm epoki (5 warstw): uboga warstwa po skrzyni, zwykłe, bogatsza i warstwa skarbów przed skrzynią — z podwójną liczbą modyfikatorów.">
              {isTreasure(st.depth) ? <><Sparkles className="ic" />Warstwa skarbów · odłamki ×{richness(st.depth)}</> : `odłamki ×${richness(st.depth)}`}
            </span>
          </div>
          <ChainPill s={s} st={st} m={m} last={lastChain} openShop={openShop} />
          <span className="reward" title="Nagroda po wykopaniu całej warstwy (każdego pola). Gwiazdki za mało ruchów ją zwiększają.">Za warstwę <b>+{fmt(reward.coins)}</b><Coins className="ic" style={{ color: 'var(--accent)' }} /><b className="blue">+{reward.pb}</b><Microscope className="ic" style={{ color: 'var(--blue)' }} /></span>
        </div>
        <div className="dig-wrap">{field}<canvas ref={fxRef} className="dig-fx" /></div>
        {toolbar}
      </div>
      <div className="dig-right">
        {stash}
        <OddsPanel s={s} onLog={() => setLog(true)} />
        <div className="panel"><CrewSwitch s={s} /></div>
      </div>
      {log && <LogModal s={s} onClose={() => setLog(false)} />}
    </div>
  );
}

/** the dig screen fills the window (no page scrolling) when the window is big enough — same query as in styles.css */
const FIT_QUERY = '(min-width: 1101px) and (min-height: 641px)';
const fitsWindow = () => typeof window !== 'undefined' && !!window.matchMedia?.(FIT_QUERY).matches;
function useFits(): boolean {
  const [fit, setFit] = useState(fitsWindow);
  useEffect(() => {
    const mq = window.matchMedia?.(FIT_QUERY);
    if (!mq) return;
    const on = () => setFit(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return fit;
}

// ---------------------------------------------------------------- left: what this site holds and how much of it you have

type LeftTab = 'fauna' | 'guests' | 'minerals' | 'rocks';
let leftTabMemo: LeftTab = 'fauna';

function LeftPanel({ s, st }: { s: GameState; st: SiteState }) {
  const [tab, setTab] = useState<LeftTab>(leftTabMemo);
  const openCutscene = useStore((x) => x.openCutscene);
  const site = SITE_BY_ID.get(s.activeSite)!;
  const pr = chapterProgress(s, site.id);
  const own = siteMinerals(s.activeSite);
  const minHave = own.filter((x) => s.minerals?.[x.id]).length;
  const rocks = siteRocks(s.activeSite);
  const rockHave = rocks.filter((r) => rockFound(s, r)).length;
  const no = chapterNo(site.id);
  const pick = (t: LeftTab) => { leftTabMemo = t; setTab(t); };
  const cards: [LeftTab, string, number, number, string][] = [
    ['fauna', 'Zwierzęta', pr.nativeFound, pr.native, 'var(--accent)'],
    ...(pr.guests ? [['guests', 'Goście epoki', pr.guestsFound, pr.guests, '#9fc5e8'] as [LeftTab, string, number, number, string]] : []),
    ['minerals', 'Minerały', minHave, own.length, 'var(--purple)'],
    ['rocks', 'Skały', rockHave, rocks.length, '#c9b98a'],
  ];
  return (
    <div className="panel dig-left">
      <button className="inv-chapter" onClick={() => openCutscene(site.id)} title="Obejrzyj wstęp do rozdziału">
        <span className="inv-no">{no}</span>
        <span className="col" style={{ gap: 0, minWidth: 0 }}><small className="lbl">Rozdział {no} · {site.period}</small><b>{chapterTitle(site.id)}</b></span>
        <Film className="ic" />
      </button>
      <div className="inv-cards" role="tablist" aria-label="Co kryje stanowisko">
        {cards.map(([id, label, have, all, col]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`inv-card ${tab === id ? 'on' : ''}`} onClick={() => pick(id)}>
            <small>{label}</small>
            <b><span style={{ color: col }}>{have}</span>/{all}</b>
            <i><em style={{ width: `${all ? (have / all) * 100 : 0}%`, background: col }} /></i>
          </button>
        ))}
      </div>
      <div className="dig-left-body">
        {tab === 'fauna' && <ChapterTree s={s} siteId={site.id} compact />}
        {tab === 'guests' && <><p className="muted small" style={{ margin: '0 0 8px' }}>Goście epoki żyli w tym czasie i środowisku, ale ich skamieniałości znaleziono gdzie indziej. To dodatkowa kolekcja: rozdział zamyka się bez nich.</p><ChapterTree s={s} siteId={site.id} compact part="guests" /></>}
        {tab === 'minerals' && <MineralsTab s={s} />}
        {tab === 'rocks' && <RocksTab s={s} st={st} />}
      </div>
    </div>
  );
}

function RocksTab({ s, st }: { s: GameState; st: SiteState }) {
  const rocks = siteRocks(s.activeSite);
  return (
    <div className="col" style={{ gap: 10 }}>
      <StrataColumn s={s} st={st} />
      <div className="cx-rocks">
        {rocks.map((r) => {
          const f = rockFound(s, r);
          return (
            <div key={r.index} className={`cx-rock ${f ? 'have' : ''}`}>
              <i style={{ background: f ? r.color : '#2a271e' }} />
              <span className="col" style={{ gap: 0 }}><b>{f ? r.name : '???'}</b><small>{f ? r.desc : `od −${depthMeters(r.startDepth)} m`}</small></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** the evolutionary stage this site stands for: what happened, what is new on the tree of life, a fact */
export function EpochTab({ s, compact }: { s: GameState; compact?: boolean }) {
  const openClade = useStore((x) => x.openClade);
  const setTreeFocus = useStore((x) => x.setTreeFocus);
  const site = SITE_BY_ID.get(s.activeSite)!;
  const ep = EPOCHS[site.id];
  const k = SITE_ORDER.indexOf(site.id);
  const fresh = newCladesAt(site.id).filter((x) => x.clade.leafCount < 1500).slice(0, compact ? 4 : 7);
  if (!ep) return null;
  const prev = SITE_ORDER[k - 1], next = SITE_ORDER[k + 1];
  return (
    <div className="epoch col">
      <div className="epoch-head">
        <span className="lbl">Etap {k + 1} z {SITE_ORDER.length} · {site.period}</span>
        <b>{ep.title}</b>
        <span className="small muted">{Math.round(site.fromMa)}–{Math.round(site.toMa) || '<1'} mln lat temu</span>
      </div>
      <div className="epoch-steps" aria-hidden="true">
        {SITE_ORDER.map((id, i) => <i key={id} className={i < k ? 'past' : i === k ? 'now' : ''} title={`${i + 1}. ${EPOCHS[id]?.title ?? id}`} />)}
      </div>
      <LessonBtn to={{ kind: 'site', id: site.id }}>Pokaz stanowiska: oś czasu, fauna, nowości</LessonBtn>
      <p className="epoch-story">{ep.story}</p>
      <div className="col" style={{ gap: 4 }}>
        <span className="lbl"><Lightbulb className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Nowe w ewolucji</span>
        <ul className="epoch-list">{ep.innovations.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      {fresh.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="lbl"><Dna className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Po raz pierwszy na drzewie życia</span>
          <div className="epoch-clades">
            {fresh.map((x) => (
              <button key={x.clade.id} className="chip" onClick={() => openClade(x.clade.id)} onDoubleClick={() => setTreeFocus(x.clade.id)} title={`${x.clade.name}: ${x.genera} ${plural(x.genera, 'rodzaj', 'rodzaje', 'rodzajów')} na tym stanowisku. Kliknij po więcej.`}>
                {x.clade.namePl}<small>{x.genera}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="epoch-fact"><Sparkles className="ic" /><span><b>Ciekawostka.</b> {ep.fact}</span></div>
      {ep.extinction && <div className="epoch-ext"><Skull className="ic" /><span>{ep.extinction}</span></div>}
      {!compact && (
        <div className="row small muted" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span>{prev ? <>← {EPOCHS[prev]?.title}</> : 'Początek drogi'}</span>
          <span style={{ textAlign: 'right' }}>{next ? <>{EPOCHS[next]?.title} →</> : 'Koniec drogi'}</span>
        </div>
      )}
    </div>
  );
}

function LogModal({ s, onClose }: { s: GameState; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal log-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Dziennik wykopu">
        <button className="btn small close" onClick={onClose} aria-label="Zamknij">✕</button>
        <DigLog s={s} />
      </div>
    </div>
  );
}

function FocusCash() {
  const s = useGame();
  const m = mods(s);
  return (
    <span className="row" style={{ gap: 10 }}>
      <span className="res"><Coins className="ic" style={{ color: 'var(--accent)' }} />{fmt(s.coins)}</span>
      <span className="res muted small">+{fmt(incomePerSec(s, m))}/s</span>
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
    <div className="strata-col">
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

function OddsPanel({ s, compact, onLog }: { s: GameState; compact?: boolean; onLog?: () => void }) {
  const [open, setOpen] = useState(true);
  const st = siteState(s, s.activeSite);
  const m = mods(s);
  const rar = fossilRarityOdds(s, s.activeSite, st.depth, m);
  const q = qualityOddsAt(st.depth, m);
  return (
    <div className="panel">
      <div className="panel-head" style={open ? undefined : { marginBottom: 0 }}>
        <span className="lbl">Szanse na −{depthMeters(st.depth)} m</span>
        <span className="row" style={{ gap: 4 }}>
          {onLog && <button className="btn small" onClick={onLog} title="Dziennik wykopu: ostatnie znaleziska"><BookOpen className="ic" />Dziennik</button>}
          <button className="collapse-btn" aria-label={open ? 'Zwiń' : 'Rozwiń'} onClick={() => setOpen(!open)}><ChevronDown className="ic" style={{ transform: open ? undefined : 'rotate(-90deg)' }} /></button>
        </span>
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
  ['helpers', 'Pomocnicy', 'Kruszą zwykłą skałę. Kamienie ze znaleziskami, modyfikatorami i połączeniami tylko osłabiają do jednego pociągnięcia — rozbicie (i reakcję) zostawiają Tobie.'],
  ['full', 'Automat', 'Wykopują wszystko same, także offline, i odpalają modyfikatory (bez nagród za combo). Nowe gatunki trafiają do skrzynki „Nowe odkrycia”.'],
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


// ---------------------------------------------------------------- lower row: fauna / minerals · dig log

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
        <p><b>Reakcje łańcuchowe</b>: kamień z modyfikatorem po rozbiciu odpala kolejne (strzałka, ładunek, żyła, zwornik, rezonans, kryształ). Wszystko, co pęknie z jednego Twojego rozbicia, to combo: od kilku pól rośnie mnożnik odłamków i łupów. Najedź na kamień, żeby zobaczyć podgląd reakcji.</p>
        <p><b>Warsztat</b> (klawisz U): modyfikatory w skale, własne narzędzia (ładunek, połączenie, obrót, przesunięcie, kopia), zasady combo, pędzel, georadar i ekipy. <b>Gwiazdki</b> za warstwę wykopaną małą liczbą ruchów. <b>Złoty błysk</b>: kliknij po nagrodę.</p>
      </details>
    </div>
  );
}

/** new species found by the crews while you were away or busy */
// ---------------------------------------------------------------- screen

export function SoundControl({ s }: { s: GameState }) {
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
  const owned = !!s.unlockedSites[s.activeSite];
  useBeat('nosite', !owned && view === 'dig');
  useBeat('dig', owned && view === 'dig');
  if (view === 'map') return <WorldMap s={s} onDig={() => setView('dig')} />;
  if (!owned) {
    return (
      <div className="dig-screen nosite">
        <div className="panel nosite-card">
          <MapIcon className="ic" />
          <h2>Nie masz jeszcze wykopaliska</h2>
          <p className="muted">Każde stanowisko to rozdział historii życia. Pierwszy, kambryjskie morze Chengjiang, czeka na mapie świata: kup pozwolenie i zaczynaj kopać.</p>
          <Btn kind="primary" big onClick={() => setView('map')}><MapIcon className="ic" />Otwórz mapę świata</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="dig-screen">
      <SiteHead s={s} openMap={() => setView('map')} setFocus={setFocus} />
      <DigBoard key={s.activeSite} s={s} focus={focus} setFocus={setFocus} openShop={() => setShop(true)} />
      {shop && <Workshop s={s} onClose={() => setShop(false)} />}
    </div>
  );
}

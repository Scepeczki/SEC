// Workshop: one classic upgrade tree — round nodes joined by branches, five branches from a common root.
// Click a node to see it on the right, buy it there. Bought with rock shards (+ research points deeper in).

import { useMemo, useState } from 'react';
import {
  Backpack, Bomb, Brush, Check, Crosshair, Crown, Droplets, Dumbbell, Expand, Feather, Filter, Flame, FlameKindling, Gem, Grid3x3,
  Hammer, HandHeart, HardHat, Hexagon, Link, Lock, Map as MapIcon, Microscope, Mountain, Music, Paintbrush, Pickaxe, Radar, Radio,
  Repeat, ScanSearch, Shield, Sparkles, Tent, Timer, UserPlus, Users, Waves, Wrench, X, Zap,
} from 'lucide-react';
import { fmt } from '../../game/balance';
import { mods } from '../../game/mods';
import type { GameState } from '../../game/state';
import { TOOL_NAMES, TOOL_NODES, TOOL_NODE_BY_ID, TOOL_ORDER, type ToolId, type ToolNode, buyToolNode, canBuyToolNode, missingReq, toolLevel } from '../../game/tools';
import { Btn } from '../components';
import { sfx } from '../sound';
import { useStore } from '../store';

type Icon = typeof Paintbrush;
export const BRANCH_ICON: Record<ToolId, Icon> = { brush: Paintbrush, hammer: Hammer, charge: Bomb, radar: Radar, crew: Users };
const BRANCH_COLOR: Record<ToolId, string> = { brush: '#e0a84a', hammer: '#d07a52', charge: '#e0603f', radar: '#5fa8d8', crew: '#8bb04f' };
const NODE_ICON: Record<string, Icon> = {
  b_power: Brush, b_crit: Crosshair, b_care: HandHeart, b_splash: Droplets, b_combo: Music, b_sweep: Waves, b_ember: FlameKindling, b_fever: Flame, b_wild: Flame, b_master: Crown,
  h_unlock: Hammer, h_power: Dumbbell, h_safe: Shield, h_crit: Zap, h_area: Grid3x3, h_feather: Feather, h_after: Repeat, h_quake: Mountain, h_titan: Crown,
  x_unlock: Bomb, x_fuse: Timer, x_power: Expand, x_bag: Backpack, x_crush: Pickaxe, x_chain: Link, x_mega: Crown,
  r_res: Radar, r_glint: Gem, r_sonar: Radio, r_lucky: Sparkles, r_rare: ScanSearch, r_tomo: Crown,
  k_speed: Pickaxe, k_power: Hammer, k_hire: UserPlus, r_crew: MapIcon, k_sift: Filter, k_boss: HardHat, k_expo: Tent,
};

const CW = 76; // column width
const RH = 128; // row height
const TOP = 150; // first node row (below the root)
const COLS = 15;

const pos = (n: ToolNode) => ({ x: n.x * CW + CW / 2 + 8, y: TOP + n.y * RH });
const ROOT = { x: 7 * CW + CW / 2 + 8, y: 46 };

type NodeState = 'maxed' | 'owned' | 'ready' | 'open' | 'locked';
function nodeState(s: GameState, n: ToolNode): NodeState {
  const lvl = toolLevel(s, n.id);
  if (lvl >= n.max) return 'maxed';
  const c = canBuyToolNode(s, n.id);
  if (lvl > 0) return c.ok ? 'ready' : 'owned';
  if (missingReq(s, n)) return 'locked';
  return c.ok ? 'ready' : 'open';
}

function TreeNode({ s, n, sel, onPick }: { s: GameState; n: ToolNode; sel: boolean; onPick: () => void }) {
  const lvl = toolLevel(s, n.id);
  const st = nodeState(s, n);
  const I = st === 'locked' ? Lock : NODE_ICON[n.id] ?? Wrench;
  const p = pos(n);
  const col = BRANCH_COLOR[n.tool];
  return (
    <button className={`tnode ${st} ${n.cap ? 'cap' : ''} ${sel ? 'sel' : ''} ${lvl > 0 && st !== 'maxed' ? 'lv' : ''}`} style={{ left: p.x, top: p.y, ['--c' as string]: col, ['--p' as string]: `${(lvl / n.max) * 360}deg` }}
      onClick={onPick} aria-label={`${n.name}, poziom ${lvl} z ${n.max}`}>
      <span className="ring"><span className="core"><I className="ic" /></span></span>
      <span className="lvl">{lvl}/{n.max}</span>
      <span className="nm">{n.name}</span>
    </button>
  );
}

function Edges({ s }: { s: GameState }) {
  const paths: { d: string; on: boolean; part: boolean; key: string; c: string }[] = [];
  // from under the parent's name to the top of the child's ring (lines never cross the labels)
  const curve = (a0: { x: number; y: number }, b0: { x: number; y: number }, fromRoot = false) => {
    const a = { x: a0.x, y: a0.y + (fromRoot ? 26 : 52) }, b = { x: b0.x, y: b0.y - 32 };
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  };
  for (const n of TOOL_NODES) {
    const b = pos(n);
    if (!n.req?.length) {
      paths.push({ key: `root-${n.id}`, d: curve(ROOT, b, true), on: toolLevel(s, n.id) > 0, part: true, c: BRANCH_COLOR[n.tool] });
      continue;
    }
    for (const [pid, need] of n.req) {
      const pn = TOOL_NODE_BY_ID.get(pid)!;
      const pl = toolLevel(s, pid);
      paths.push({ key: `${pid}-${n.id}`, d: curve(pos(pn), b), on: pl >= need, part: pl > 0, c: BRANCH_COLOR[pn.tool] });
    }
  }
  return (
    <svg className="tedges" width={COLS * CW + 16} height={TOP + 4 * RH + 90}>
      {paths.map((p) => <path key={p.key + 'b'} d={p.d} className="tedge-bg" />)}
      {paths.map((p) => <path key={p.key} d={p.d} className={`tedge ${p.on ? 'on' : p.part ? 'part' : ''}`} style={{ stroke: p.on ? p.c : undefined }} />)}
    </svg>
  );
}

function Detail({ s, n }: { s: GameState; n: ToolNode }) {
  const act = useStore((x) => x.act);
  const lvl = toolLevel(s, n.id);
  const c = canBuyToolNode(s, n.id);
  const maxed = lvl >= n.max;
  const I = NODE_ICON[n.id] ?? Wrench;
  const B2 = BRANCH_ICON[n.tool];
  return (
    <div className="tdetail" style={{ ['--c' as string]: BRANCH_COLOR[n.tool] }}>
      <div className="row" style={{ gap: 12 }}>
        <span className={`tbig ${n.cap ? 'cap' : ''}`}><I className="ic" /></span>
        <div className="col" style={{ gap: 2 }}>
          <span className="lbl"><B2 className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> {TOOL_NAMES[n.tool]}{n.cap ? ' · zwieńczenie' : ''}</span>
          <b style={{ fontSize: 18 }}>{n.name}</b>
          <span className="pips">{Array.from({ length: n.max }, (_, k) => <i key={k} className={k < lvl ? 'on' : ''} />)}</span>
        </div>
      </div>
      <p className="muted" style={{ margin: '12px 0' }}>{n.desc}</p>
      {lvl > 0 && <div className="tline now"><span className="lbl">Teraz</span>{n.effect(lvl)}</div>}
      {!maxed && <div className="tline next"><span className="lbl">{lvl ? 'Następny poziom' : 'Po odblokowaniu'}</span>{n.effect(lvl + 1)}</div>}
      {!!n.req?.length && (
        <div className="treq">
          <span className="lbl">Wymaga</span>
          {n.req.map(([id, need]) => {
            const pn = TOOL_NODE_BY_ID.get(id)!;
            const ok = toolLevel(s, id) >= need;
            return <span key={id} className={ok ? 'ok' : 'no'}>{ok ? <Check className="ic" /> : <Lock className="ic" />}{pn.name}{pn.max > 1 ? ` — poziom ${need}` : ''}</span>;
          })}
        </div>
      )}
      {maxed ? (
        <div className="tline now" style={{ marginTop: 14 }}><Check className="ic" /> Maksymalny poziom</div>
      ) : (
        <>
          <div className="tcost">
            <span className={(s.shards ?? 0) >= c.shards ? '' : 'short'}><Hexagon className="ic" />{fmt(c.shards)}<small> / masz {fmt(s.shards ?? 0)}</small></span>
            {c.pb > 0 && <span className={s.pb >= c.pb ? '' : 'short'}><Microscope className="ic" />{fmt(c.pb)}<small> / masz {fmt(s.pb)}</small></span>}
          </div>
          <Btn big kind={c.ok ? 'gold' : undefined} disabled={!c.ok} why={c.why} onClick={() => { if (act((g) => buyToolNode(g, n.id))) sfx.chestOpen(n.cap ? 2 : 0); }}>
            {lvl ? 'Ulepsz' : 'Odblokuj'}
          </Btn>
          {!c.ok && c.why && <span className="small muted" style={{ marginTop: 6, display: 'block' }}>{c.why}</span>}
        </>
      )}
    </div>
  );
}

export function Workshop({ s, onClose }: { s: GameState; onClose: () => void }) {
  const firstReady = useMemo(() => TOOL_NODES.find((n) => nodeState(s, n) === 'ready')?.id ?? 'b_power', []);
  const [sel, setSel] = useState(firstReady);
  const m = mods(s);
  const n = TOOL_NODE_BY_ID.get(sel)!;
  const owned = TOOL_NODES.reduce((a, x) => a + toolLevel(s, x.id), 0), total = TOOL_NODES.reduce((a, x) => a + x.max, 0);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal workshop2" onClick={(e) => e.stopPropagation()}>
        <div className="row ws-head">
          <Wrench className="ic" style={{ width: 22, height: 22, color: 'var(--accent)' }} />
          <h2 style={{ margin: 0 }}>Warsztat</h2>
          <span className="muted small">Drzewko rozwoju: {owned}/{total} poziomów. Odłamki zdobywasz tylko kopiąc — każde rozbite pole, głębiej więcej.</span>
          <span className="spacer" />
          <span className="res" title="Odłamki skalne — waluta Warsztatu"><Hexagon className="ic" style={{ color: '#d9c9a3' }} />{fmt(s.shards ?? 0)}</span>
          <span className="res" title="Punkty badań"><Microscope className="ic" style={{ color: 'var(--blue)' }} />{fmt(s.pb)}</span>
          <button className="iconbtn" aria-label="Zamknij" onClick={onClose}><X className="ic" /></button>
        </div>
        <div className="ws-body">
          <div className="ws-scroll">
            <div className="ws-canvas" style={{ width: COLS * CW + 16, height: TOP + 4 * RH + 90 }}>
              <Edges s={s} />
              {TOOL_ORDER.map((t) => {
                const xs = TOOL_NODES.filter((x) => x.tool === t).map((x) => x.x);
                const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * CW + 8;
                const I = BRANCH_ICON[t];
                return <span key={t} className="ws-branch" style={{ left: cx, ['--c' as string]: BRANCH_COLOR[t] }}><I className="ic" />{TOOL_NAMES[t]}</span>;
              })}
              <span className="ws-root" style={{ left: ROOT.x, top: ROOT.y }}><Wrench className="ic" /></span>
              {TOOL_NODES.map((x) => <TreeNode key={x.id} s={s} n={x} sel={x.id === sel} onPick={() => { setSel(x.id); sfx.click(); }} />)}
            </div>
          </div>
          <div className="ws-side">
            <Detail s={s} n={n} />
            <div className="ws-stats">
              <span className="lbl">Twoje narzędzia</span>
              <span>Pędzel: siła {m.brushPower.toFixed(2)}{m.critBrush ? ` · krytyk ${Math.round(m.critBrush * 100)}%` : ''}</span>
              <span>Młot: {m.hammer ? `siła ${m.hammerPower.toFixed(2)} · ryzyko ${Math.round(m.hammerRisk * 100)}%` : 'zablokowany'}</span>
              <span>Ładunki: {m.charge ? `${s.charges?.n ?? 0}/${m.chargeMax} · co ${Math.round(m.chargeCd)} s` : 'zablokowane'}</span>
              <span>Georadar: {m.scanner ? `poziom ${m.scanner}` : 'brak'}</span>
              <span>Ekipy: {m.crews} · tempo ×{m.crewSpeed.toFixed(2)} · siła {m.crewPower.toFixed(2)}</span>
              <span>Odłamki: ×{m.shardMult.toFixed(1)} za pole</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tree of life.
//   „Oś życia” (default) — lineages as lines on the geological time axis, like a metro map: a line is a branch of the tree,
//       a ring is a fork (common ancestor), dots on a line are its genera (white = found). Clicking a line zooms into it
//       (semantic zoom: the branch splits into its sub-branches, down to single genera). The panel on the right explains
//       whatever you picked: what appeared at a fork, how its branches differ, what an animal was like.
//   „Karty” — the older card explorer with the path of ancestors.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ChevronRight, Clock, Lightbulb, MapPin, Microscope, Search, Sparkles, X, Network, TreeDeciduous, GitFork, BookOpen } from 'lucide-react';
import { CLADES, GENERA, SUBTREE_GENERA, TAXA, ancestorIds } from '../../data/db';
import { CLADE_INFO } from '../../data/cladeInfo';
import { cladeLore, genusLore, LORE_GENERA } from '../../data/lore';
import { PERIODS, periodLabel } from '../../data/geotime';
import { EPOCHS } from '../../data/epochs';
import { RARITY_COLORS, RARITY_NAMES, fmt } from '../../game/balance';
import { canResearchClade, cladeCost, researchClade } from '../../game/meta';
import type { GameState } from '../../game/state';
import { Btn, FitSprite } from '../components';
import { genusSpec, spriteUrl } from '../sprites';
import { useGame, useStore } from '../store';
import { LessonBtn } from '../Lesson';
import { ERAS, EXTINCTIONS, LAST, ORIGIN, cladeStats, effChildren, fmtMa, known, label, makeScale, namedPath, nameOf, rankPl, repGenus, sitesFor } from '../treeData';

const info = (id: number) => CLADE_INFO[CLADES.get(id)?.name ?? ''];
const COLORS = ['#7fd0c0', '#6db6e0', '#8bb04f', '#e09b5a', '#eaa63a', '#b98be3', '#e0735e', '#d8c27a'];

type Sel = { kind: 'clade' | 'genus'; id: number } | null;

// ---------------------------------------------------------------- small pieces

function Progress({ v, max, gold }: { v: number; max: number; gold?: boolean }) {
  return <div className={`tprog ${gold ? 'gold' : ''}`}><div style={{ width: `${max ? (v / max) * 100 : 0}%` }} /></div>;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ---------------------------------------------------------------- the metro map

interface VN { id: number; genus: boolean; depth: number; kids?: VN[]; parent?: VN; row: number; color: number }

const leavesOf = (n: { id: number; genus: boolean }) => (n.genus ? 1 : CLADES.get(n.id)?.leafCount ?? 1);

/** which branches to draw: start with the focus' children and keep splitting the biggest line while there is room */
function buildVisible(focus: number, maxLanes: number): VN {
  const mk = (k: { id: number; genus: boolean }, d: number, parent: VN): VN => ({ id: k.id, genus: k.genus, depth: d, parent, row: 0, color: 0 });
  const root: VN = { id: focus, genus: false, depth: 0, row: 0, color: 0 };
  root.kids = effChildren(focus).map((k) => mk(k, 1, root));
  const lanes = (): VN[] => { const out: VN[] = []; const rec = (n: VN) => { if (n.kids) n.kids.forEach(rec); else out.push(n); }; rec(root); return out; };
  for (let guard = 0; guard < 300; guard++) {
    const ls = lanes();
    const cand = ls.filter((l) => !l.genus).map((l) => ({ l, k: effChildren(l.id) }))
      .filter((x) => x.k.length > 0 && ls.length - 1 + x.k.length <= maxLanes)
      .sort((a, b) => leavesOf(b.l) - leavesOf(a.l))[0];
    if (!cand) break;
    cand.l.kids = cand.k.map((x) => mk(x, cand.l.depth + 1, cand.l));
  }
  // rows in tree order; colours by the deepest level that still has at most 8 groups
  const ls = lanes();
  ls.forEach((l, i) => { l.row = i; });
  let colorDepth = 1;
  for (let d = 1; d <= 4; d++) {
    const groups = new Set(ls.map((l) => { let n: VN = l; while (n.depth > d && n.parent) n = n.parent; return n; }));
    if (groups.size <= 8) colorDepth = d;
  }
  const gIdx = new Map<VN, number>();
  ls.forEach((l) => {
    let n: VN = l;
    while (n.depth > colorDepth && n.parent) n = n.parent;
    if (!gIdx.has(n)) gIdx.set(n, gIdx.size);
    l.color = gIdx.get(n)!;
  });
  const paint = (n: VN): number => { if (n.kids) { n.kids.forEach(paint); n.color = n.kids[0].color; } return n.color; };
  paint(root);
  return root;
}

const anchorRow = (n: VN): number => (n.kids ? anchorRow(n.kids[0]) : n.row);
const anchorLeaf = (n: VN): VN => (n.kids ? anchorLeaf(n.kids[0]) : n);

function LifeLines({ s, focus, sel, setSel, epoch }: { s: GameState; focus: number; sel: Sel; setSel: (x: Sel) => void; epoch: boolean }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const [box, W] = useWidth<HTMLDivElement>();
  const root = useMemo(() => buildVisible(focus, 18), [focus]);
  const lanes = useMemo(() => { const out: VN[] = []; const rec = (n: VN) => { if (n.kids) n.kids.forEach(rec); else out.push(n); }; rec(root); return out; }, [root]);

  const origin = ORIGIN.get(focus) ?? 500;
  const lastMin = Math.min(...lanes.map((l) => LAST.get(l.id) ?? 0));
  const span0 = Math.max(4, origin - lastMin);
  const from = origin + Math.max(1, span0 * 0.05);
  const to = lastMin < 0.5 ? 0 : Math.max(0, lastMin - Math.max(1, span0 * 0.05));
  const HDR = 46, ROW = 36, TOP = HDR + 34;
  const x0 = 24, x1 = Math.max(400, W - 64);
  const X = makeScale(from, to, x0, x1, epoch);
  const H = TOP + lanes.length * ROW + 44;
  const Y = (row: number) => TOP + row * ROW;
  const R = 18;

  const els: JSX.Element[] = [];
  const junctions: JSX.Element[] = [];
  const isSel = (kind: 'clade' | 'genus', id: number) => sel?.kind === kind && sel.id === id;

  const drawLane = (n: VN, sx: number) => {
    const y = Y(n.row);
    const col = COLORS[n.color % COLORS.length];
    const last = LAST.get(n.id) ?? 0;
    const alive = last < 0.5;
    const a = sx;
    const b = alive ? x1 + 26 : Math.max(a + 8, X(last));
    if (n.genus) {
      const g = GENERA.get(n.id)!;
      const k = known(s, n.id);
      const hatched = !!s.hatched[n.id];
      const u = spriteUrl(genusSpec(n.id), 1, 0, !hatched && !k);
      const sc = Math.min(1.5, 18 / u.h, 36 / u.w);
      const selected = isSel('genus', n.id);
      els.push(
        <g key={`g${n.id}`} className={`ll-lane genus ${selected ? 'sel' : ''}`} onClick={() => setSel({ kind: 'genus', id: n.id })}>
          <title>{k ? `${g.name}: ${Math.round(g.fromMa)}–${Math.round(g.toMa)} mln lat temu. Kliknij, żeby poczytać.` : `Nieodkryty rodzaj (${periodLabel(g.fromMa, g.toMa)})`}</title>
          <line x1={a} x2={b} y1={y} y2={y} stroke={col} strokeWidth={selected ? 7 : 5} strokeLinecap="round" opacity={k ? 1 : 0.45} />
          <circle cx={a} cy={y} r={5} className={`ll-st ${hatched ? 'hatched' : k ? 'found' : ''}`} />
          {b - a > 14 && <circle cx={b} cy={y} r={4} className={`ll-st ${hatched ? 'hatched' : k ? 'found' : ''}`} />}
          <image href={u.url} x={a + 2} y={y - 8 - u.h * sc} width={u.w * sc} height={u.h * sc} style={{ imageRendering: 'pixelated', opacity: k || hatched ? 1 : 0.4 }} />
          <text x={a + 6 + u.w * sc} y={y - 9} className={`ll-name ${k ? '' : 'dim'}`}>{k ? g.name : '???'}{k && LORE_GENERA.has(n.id) ? ' ·' : ''}{k && LORE_GENERA.has(n.id) && <tspan className="ll-sub"> opis</tspan>}</text>
          {!alive && <text x={b + 6} y={y + 4} className="ll-x">✕</text>}
        </g>,
      );
      return;
    }
    const c = CLADES.get(n.id)!;
    const st = cladeStats(s, n.id);
    const th = Math.max(6, Math.min(16, 4 + Math.log2(1 + st.total) * 1.9));
    // stations: the genera of this branch at the time they first appear, merged when closer than 9 px
    const buckets = new Map<number, { x: number; found: boolean; hatched: boolean; n: number }>();
    for (const gid of SUBTREE_GENERA.get(n.id) ?? []) {
      const gx = Math.max(a + 4, Math.min(b - 2, X(GENERA.get(gid)!.fromMa)));
      const key = Math.round(gx / 9);
      const bk = buckets.get(key) ?? { x: key * 9, found: false, hatched: false, n: 0 };
      bk.n++; bk.found ||= known(s, gid); bk.hatched ||= !!s.hatched[gid];
      buckets.set(key, bk);
    }
    const selected = isSel('clade', n.id) || (sel === null && n.id === focus);
    els.push(
      <g key={`c${n.id}`} className={`ll-lane ${selected ? 'sel' : ''}`} onClick={() => { setFocus(n.id); setSel(null); }}>
        <title>{`${label(c)}: ${st.total} rodzajów, od ${Math.round(ORIGIN.get(n.id) ?? 0)} mln lat. Kliknij, żeby rozwinąć gałąź.`}</title>
        <line x1={a} x2={b} y1={y} y2={y} stroke={col} strokeWidth={th} strokeLinecap="round" opacity={st.discovered ? 0.95 : 0.55} />
        {[...buckets.values()].map((bk, i) => <circle key={i} cx={bk.x} cy={y} r={Math.min(4.2, th / 2 - 0.5)} className={`ll-dot ${bk.hatched ? 'hatched' : bk.found ? 'found' : ''}`}><title>{bk.n} {bk.n === 1 ? 'rodzaj' : 'rodzajów'}</title></circle>)}
        <text x={a + 4} y={y - th / 2 - 5} className="ll-name"><tspan fill={col}>{label(c)}</tspan><tspan className="ll-sub"> {st.total} · {st.discovered} odkr.</tspan><tspan className="ll-zoom"> ▸</tspan></text>
        {!alive && <text x={b + 6} y={y + 4} className="ll-x">✕</text>}
        {alive && <text x={b + 4} y={y + 4} className="ll-today">→</text>}
      </g>,
    );
  };

  const draw = (n: VN, sx: number) => {
    if (!n.kids) { drawLane(n, sx); return; }
    const ay = Y(anchorRow(n));
    const [first, ...rest] = n.kids;
    draw(first, sx);
    const aLeaf = anchorLeaf(n);
    const aEnd = (LAST.get(aLeaf.id) ?? 0) < 0.5 ? x1 + 26 : X(LAST.get(aLeaf.id) ?? 0);
    for (const k of rest) {
      const xo = X(ORIGIN.get(k.id) ?? 0);
      const xs = Math.max(sx, xo - R);
      const ky = Y(anchorRow(k));
      const col = COLORS[k.color % COLORS.length];
      if (xs > aEnd + 2) els.push(<line key={`gh${k.id}`} x1={aEnd} x2={xs} y1={ay} y2={ay} className="ll-ghost" />);
      els.push(<path key={`b${k.id}`} d={`M${xs},${ay} C${xs + R * 0.7},${ay} ${xs + R * 0.3},${ky} ${xs + R},${ky}`} fill="none" stroke={col} strokeWidth={4} strokeLinecap="round" opacity={0.85} />);
      draw(k, xs + R);
    }
    const lore = cladeLore(n.id);
    const selected = isSel('clade', n.id) || (sel === null && n.id === focus);
    junctions.push(
      <g key={`j${n.id}`} className={`ll-junction ${selected ? 'sel' : ''}`} onClick={(e) => { e.stopPropagation(); setSel({ kind: 'clade', id: n.id }); }}>
        <title>{`Rozwidlenie: ${nameOf(n.id)}${lore ? ` — pojawia się: ${lore.appeared}` : ''}. Kliknij, żeby przeczytać.`}</title>
        <circle cx={sx} cy={ay} r={n.depth === 0 ? 8 : 6.5} />
        {n.depth > 0 && <text x={sx} y={ay + 20} textAnchor="middle" className="ll-jname">{nameOf(n.id)}</text>}
      </g>,
    );
  };
  const rootX = X(origin);
  draw(root, rootX);

  return (
    <div className="lifelines" ref={box}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {ERAS.filter((e) => e.end < from && e.start > to).map((e) => {
          const a = X(Math.min(from, e.start)), b = X(Math.max(to, e.end));
          return <g key={e.name}><rect x={a} y={0} width={Math.max(1, b - a - 2)} height={18} rx={4} fill={e.color} />{b - a > 60 && <text x={(a + b) / 2} y={13} textAnchor="middle" className="ll-era">{e.name}</text>}</g>;
        })}
        {PERIODS.filter((p) => p.end < from && p.start > to).map((p) => {
          const a = X(Math.min(from, p.start)), b = X(Math.max(to, p.end));
          return (
            <g key={p.id}>
              <rect x={a} y={22} width={Math.max(1, b - a - 2)} height={20} rx={4} className="ll-per" />
              <rect x={a} y={HDR} width={Math.max(1, b - a - 2)} height={H - HDR - 22} className="ll-col" />
              {b - a > 44 && <text x={(a + b) / 2} y={36} textAnchor="middle" className="ll-pername">{p.namePl}</text>}
            </g>
          );
        })}
        {EXTINCTIONS.filter((e) => e.ma < from && e.ma > to).map((e, i) => (
          <g key={e.ma}>
            <line x1={X(e.ma)} x2={X(e.ma)} y1={HDR} y2={H - (i % 2 ? 30 : 20)} className="ll-ext" />
            <text x={X(e.ma) + 4} y={H - (i % 2 ? 20 : 8)} className="ll-exttext">☄ {e.name}</text>
          </g>
        ))}
        <line x1={4} x2={rootX} y1={Y(anchorRow(root))} y2={Y(anchorRow(root))} className="ll-ghost" />
        <text x={x0} y={H - 8} className="ll-tick">{fmtMa(from)} lat temu</text>
        {to > 0.5 && <text x={x1} y={H - 8} textAnchor="end" className="ll-tick">{fmtMa(to)} lat temu</text>}
        {els}
        {junctions}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- right: what you picked, explained

function CladeInfoPanel({ s, id, focus, setSel }: { s: GameState; id: number; focus: number; setSel: (x: Sel) => void }) {
  const act = useStore((x) => x.act);
  const setFocus = useStore((x) => x.setTreeFocus);
  const c = CLADES.get(id)!;
  const lore = cladeLore(id);
  const st = cladeStats(s, id);
  const from = ORIGIN.get(id) ?? 0, to = LAST.get(id) ?? 0;
  const kids = effChildren(id);
  const where = sitesFor(id);
  const can = canResearchClade(s, id);
  return (
    <>
      <div className="col" style={{ gap: 2 }}>
        <span className="lbl"><GitFork className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Rozwidlenie · {rankPl(c.rank)}</span>
        <h3 style={{ margin: 0 }}>{label(c)}</h3>
        {c.namePl && <span className="muted latin small">{c.name}</span>}
        <span className="small muted">{periodLabel(from, to)} · od {Math.round(from)} mln lat {to > 0.5 ? `do ${Math.round(to)} mln lat temu` : 'do dziś'}</span>
      </div>
      {lore && <div className="ip-appeared"><Lightbulb className="ic" /><span><small>Co się tu pojawiło</small><b>{lore.appeared}</b></span></div>}
      {lore ? <p className="ip-p">{lore.desc}</p> : <p className="ip-p muted">Ta gałąź nie ma jeszcze szczegółowego opisu.</p>}
      {lore?.split && <p className="ip-p"><b>Gałęzie: </b>{lore.split}</p>}
      <div className="row" style={{ gap: 6 }}>
        <LessonBtn to={{ kind: 'clade', id }}>Lekcja o tym rozwidleniu</LessonBtn>
        {id !== focus && <button className="btn" onClick={() => { setFocus(id); setSel(null); }}>Rozwiń <ChevronRight className="ic" /></button>}
      </div>
      <div className="ip-stats"><div><b>{st.total}</b><span>rodzajów</span></div><div><b style={{ color: 'var(--accent)' }}>{st.discovered}</b><span>odkrytych</span></div><div><b style={{ color: 'var(--accent2)' }}>{st.hatched}</b><span>w kolekcji</span></div></div>
      {kids.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="lbl">Na co się dzieli · od najstarszej</span>
          <div className="ip-kids">
            {kids.slice(0, 14).map((k) => {
              if (k.genus) {
                const g = GENERA.get(k.id)!;
                const kn = known(s, k.id);
                return (
                  <button key={k.id} onClick={() => setSel({ kind: 'genus', id: k.id })}>
                    <span className="ip-kpic"><FitSprite genusId={k.id} w={40} h={22} silhouette={!kn && !s.hatched[k.id]} max={2} title={kn ? g.name : 'Nieodkryty'} /></span>
                    <span className="col" style={{ gap: 0, minWidth: 0 }}><b>{kn ? g.name : '???'}</b><small>{kn ? genusLore(g).look.split('. ')[0] : `rodzaj · ${Math.round(g.fromMa)} mln lat`}</small></span>
                  </button>
                );
              }
              const kl = cladeLore(k.id);
              const ks = cladeStats(s, k.id);
              return (
                <button key={k.id} onClick={() => setSel({ kind: 'clade', id: k.id })}>
                  <span className="ip-kn">{ks.total}</span>
                  <span className="col" style={{ gap: 0, minWidth: 0 }}><b>{nameOf(k.id)}</b><small>{kl?.appeared ?? `${Math.round(ORIGIN.get(k.id) ?? 0)}–${Math.round(LAST.get(k.id) ?? 0) || '<1'} mln lat temu`}</small></span>
                </button>
              );
            })}
            {kids.length > 14 && <span className="small muted">+{kids.length - 14} więcej</span>}
          </div>
        </div>
      )}
      <div className="col" style={{ gap: 4 }}>
        <span className="lbl"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Gdzie kopać</span>
        {where.length ? <div className="twhere">{where.slice(0, 6).map((x) => <span key={x.id} className={s.unlockedSites[x.id] ? 'open' : ''} title={EPOCHS[x.id]?.title}>{x.name} <b>{x.n}</b></span>)}{where.length > 6 && <span className="muted">+{where.length - 6}</span>}</div>
          : <span className="small muted">Jeszcze na żadnym stanowisku.</span>}
      </div>
      <div className="col" style={{ gap: 4 }}>
        <span className="lbl"><Microscope className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Badanie gałęzi</span>
        {s.researchedClades[id] ? <span className="small" style={{ color: '#d9a441' }}>Zbadana: możesz sekwencjonować DNA jej przedstawicieli.</span>
          : <><Btn kind="gold" onClick={() => act((g) => researchClade(g, id))} disabled={!can.ok} why={can.why}>Zbadaj ({fmt(cladeCost(id))} PB)</Btn>{!can.ok && <span className="small muted">{can.why}</span>}</>}
      </div>
    </>
  );
}

function GenusInfoPanel({ s, id, setSel }: { s: GameState; id: number; setSel: (x: Sel) => void }) {
  const openGenus = useStore((x) => x.openGenus);
  const g = GENERA.get(id)!;
  const kn = known(s, id);
  const hatched = !!s.hatched[id];
  const lore = genusLore(g);
  const gen = s.genome[id] ?? 0;
  const rel = effChildren(g.parent).filter((k) => k.id !== id).slice(0, 8);
  const where = sitesFor(id);
  const status = hatched ? 'w parku' : gen > 0 ? `genom ${Math.floor(gen)}%` : kn ? 'odkryty' : 'nieodkryty';
  return (
    <>
      <div className="ip-portrait" style={{ ['--rc' as string]: RARITY_COLORS[g.rarity] }}>
        <FitSprite genusId={id} w={280} h={110} silhouette={!kn && !hatched} stage={hatched ? Math.max(1, s.bestStage[id] ?? 1) : 1} max={5} title={kn ? g.name : 'Nieodkryty'} />
      </div>
      <div className="col" style={{ gap: 2 }}>
        <span className="lbl">Rodzaj · {RARITY_NAMES[g.rarity]} · {status}</span>
        <h3 style={{ margin: 0 }}>{kn ? g.name : '???'}</h3>
        <span className="small muted">{periodLabel(g.fromMa, g.toMa)} · {Math.round(g.fromMa)}–{Math.round(g.toMa) || '<1'} mln lat temu{g.family && kn ? ` · ${g.family}` : ''}</span>
      </div>
      {kn ? (
        <>
          <div className="ip-sec"><span className="lbl">Wygląd</span><p className="ip-p">{lore.look}</p></div>
          <div className="ip-sec"><span className="lbl">Życie</span><p className="ip-p">{lore.life}</p></div>
          <div className="ip-sec"><span className="lbl">Na tle krewnych</span><p className="ip-p">{lore.diff}</p></div>
          {lore.fact && <div className="ip-fact"><Sparkles className="ic" /><span>{lore.fact}</span></div>}
          <div className="row" style={{ gap: 6 }}>
            <LessonBtn to={{ kind: 'genus', id }}>Lekcja</LessonBtn>
            <button className="btn" onClick={() => openGenus(id)}><BookOpen className="ic" /> Encyklopedia</button>
          </div>
        </>
      ) : (
        <p className="ip-p muted">Tego zwierzęcia jeszcze nie wykopałeś. Wygląd, opis i lekcję poznasz, gdy je znajdziesz.</p>
      )}
      {rel.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="lbl">Najbliżsi krewni</span>
          <div className="ip-kids">
            {rel.map((k) => {
              if (!k.genus) return <button key={k.id} onClick={() => setSel({ kind: 'clade', id: k.id })}><span className="ip-kn">{cladeStats(s, k.id).total}</span><span className="col" style={{ gap: 0 }}><b>{nameOf(k.id)}</b><small>{cladeLore(k.id)?.appeared ?? 'gałąź'}</small></span></button>;
              const r = GENERA.get(k.id)!;
              const rk = known(s, k.id);
              return (
                <button key={k.id} onClick={() => setSel({ kind: 'genus', id: k.id })}>
                  <span className="ip-kpic"><FitSprite genusId={k.id} w={40} h={22} silhouette={!rk && !s.hatched[k.id]} max={2} title={rk ? r.name : 'Nieodkryty'} /></span>
                  <span className="col" style={{ gap: 0, minWidth: 0 }}><b>{rk ? r.name : '???'}</b><small>{Math.round(r.fromMa)}–{Math.round(r.toMa)} mln lat</small></span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="col" style={{ gap: 4 }}>
        <span className="lbl"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Gdzie kopać</span>
        {where.length ? <div className="twhere">{where.map((x) => <span key={x.id} className={s.unlockedSites[x.id] ? 'open' : ''}>{x.name}</span>)}</div> : <span className="small muted">Jeszcze na żadnym stanowisku.</span>}
      </div>
    </>
  );
}

function LifeView({ s, focus }: { s: GameState; focus: number }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const [sel, setSel] = useState<Sel>(null);
  const [epoch, setEpoch] = useState(true);
  useEffect(() => setSel(null), [focus]);
  const path = namedPath(focus);
  const parent = CLADES.get(focus)?.parent;
  const shown: Sel = sel ?? { kind: 'clade', id: focus };
  return (
    <div className="life-layout">
      <div className="panel life-main">
        <div className="life-bar">
          {parent != null && <button className="iconbtn framed" aria-label="Poziom wyżej" title={`Poziom wyżej: ${nameOf(parent)}`} onClick={() => setFocus(parent)}><ArrowUp className="ic" /></button>}
          <nav className="life-crumbs" aria-label="Ścieżka w drzewie">
            {path.map((id, i) => (
              <span key={id}>
                {i > 0 && <ChevronRight className="ic" />}
                <button className={id === focus ? 'cur' : ''} onClick={() => setFocus(id)}>{nameOf(id)}</button>
              </span>
            ))}
          </nav>
          <div className="segmented small">
            <button className={epoch ? 'on' : ''} onClick={() => setEpoch(true)} title="Każdy okres dostaje czytelną szerokość">Skala epok</button>
            <button className={!epoch ? 'on' : ''} onClick={() => setEpoch(false)} title="Szerokość proporcjonalna do czasu">Skala rzeczywista</button>
          </div>
        </div>
        <LifeLines s={s} focus={focus} sel={sel} setSel={setSel} epoch={epoch} />
        <div className="life-legend small muted">
          <span><i className="lg-line" /> linia = gałąź (grubość: liczba rodzajów)</span>
          <span><i className="lg-ring" /> pierścień = rozwidlenie (wspólny przodek)</span>
          <span><i className="lg-dot found" /> odkryty</span>
          <span><i className="lg-dot hatched" /> w parku</span>
          <span><i className="lg-dot" /> nieodkryty</span>
          <span>✕ wymarła · → żyje do dziś</span>
          <span>klik w linię: rozwiń · klik w pierścień lub rodzaj: wyjaśnienie</span>
        </div>
      </div>
      <aside className="panel life-info" key={`${shown.kind}${shown.id}`}>
        {sel && <button className="btn small" onClick={() => setSel(null)}><ArrowLeft className="ic" /> {nameOf(focus)}</button>}
        {shown.kind === 'clade' ? <CladeInfoPanel s={s} id={shown.id} focus={focus} setSel={setSel} /> : <GenusInfoPanel s={s} id={shown.id} setSel={setSel} />}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- cards view (the older explorer)

function CladeCard({ s, id }: { s: GameState; id: number }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const c = CLADES.get(id)!;
  const st = cladeStats(s, id);
  const rep = repGenus(s, id);
  const lore = cladeLore(id);
  const done = !!s.completedClades[id];
  return (
    <button className={`tcard ${done ? 'done' : ''} ${st.discovered ? '' : 'dim'}`} onClick={() => setFocus(id)} title={lore ? `${label(c)}: ${lore.appeared}` : label(c)}>
      <span className="tcard-pic">{rep !== undefined && <FitSprite genusId={rep} w={110} h={58} silhouette={!s.hatched[rep]} max={4} title={known(s, rep) ? GENERA.get(rep)!.name : 'Nieodkryty'} />}</span>
      <span className="tcard-body">
        <b className={c.namePl ? '' : 'latin'}>{label(c)}</b>
        {c.namePl && <small className="latin">{c.name}</small>}
        {lore && <small className="trait">{lore.appeared}</small>}
        <small className="muted">{Math.round(ORIGIN.get(id) ?? 0)}–{Math.round(LAST.get(id) ?? 0) || '<1'} mln lat temu</small>
        <Progress v={st.hatched} max={st.total} gold={done} />
        <small><b style={{ color: 'var(--accent2)' }}>{st.hatched}</b> / {st.total} w kolekcji · odkryte {st.discovered}{s.researchedClades[id] ? ' · zbadana' : ''}</small>
      </span>
      <ChevronRight className="ic tcard-go" />
    </button>
  );
}

function GenusCard({ s, id }: { s: GameState; id: number }) {
  const openGenus = useStore((x) => x.openGenus);
  const g = GENERA.get(id)!;
  const kn = known(s, id);
  const hatched = !!s.hatched[id];
  const gen = s.genome[id] ?? 0;
  const status = hatched ? `w parku · stadium ${(s.bestStage[id] ?? 0) + 1}` : gen >= 50 ? `genom ${Math.floor(gen)}% · gotowy do wylęgu` : gen > 0 ? `genom ${Math.floor(gen)}%` : kn ? 'odkryty · kości w laboratorium' : 'nieodkryty';
  return (
    <button className={`gcard ${hatched ? 'hatched' : kn ? 'known' : 'unknown'}`} style={{ ['--rc' as string]: RARITY_COLORS[g.rarity] }} onClick={() => kn && openGenus(id)} disabled={!kn}
      title={kn ? `${g.name} · ${RARITY_NAMES[g.rarity]} · ${periodLabel(g.fromMa, g.toMa)}` : `Nieodkryty rodzaj · ${periodLabel(g.fromMa, g.toMa)}. Szukaj go na stanowiskach z tej epoki.`}>
      <span className="gcard-pic"><FitSprite genusId={id} w={96} h={54} silhouette={!hatched} stage={hatched ? Math.max(1, s.bestStage[id] ?? 1) : 1} max={4} title={kn ? g.name : 'Nieodkryty'} /></span>
      <b>{kn ? g.name : '???'}</b>
      <small>{status}</small>
      <small className="muted">{periodLabel(g.fromMa, g.toMa)} · {Math.round(g.fromMa)}–{Math.round(g.toMa)} mln</small>
    </button>
  );
}

const LANDMARKS = ['Trilobita', 'Radiodonta', 'Cephalopoda', 'Placodermi', 'Chondrichthyes', 'Actinopterygii', 'Tetrapoda', 'Temnospondyli', 'Synapsida', 'Mammalia', 'Ichthyosauromorpha', 'Sauropterygia', 'Pseudosuchia', 'Pterosauria', 'Dinosauria', 'Theropoda', 'Sauropodomorpha', 'Ornithischia', 'Aves', 'Squamata'];
const LANDMARK_IDS = LANDMARKS.map((n) => TAXA.clades.find((c) => c.name === n)).filter(Boolean).map((c) => c!.id);

function PathPanel({ s, focus }: { s: GameState; focus: number }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const anc = [...ancestorIds(CLADES.get(focus)?.parent ?? null), focus];
  const steps: { id: number; folded: number }[] = [];
  let folded = 0;
  for (const id of anc) {
    const c = CLADES.get(id)!;
    if (c.namePl || id === focus || id === TAXA.rootId) { steps.push({ id, folded }); folded = 0; } else folded++;
  }
  return (
    <aside className="panel tree-path">
      <span className="lbl"><TreeDeciduous className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Jesteś tutaj</span>
      <div className="tpath">
        {steps.map(({ id, folded: f }, k) => {
          const c = CLADES.get(id)!;
          const lore = cladeLore(id);
          const st = cladeStats(s, id);
          const cur = id === focus;
          return (
            <div key={id} className={`tpath-step ${cur ? 'cur' : ''}`}>
              {f > 0 && <span className="tpath-fold" title={`${f} pośrednich gałęzi bez polskiej nazwy`}>⋮</span>}
              <button onClick={() => setFocus(id)} disabled={cur}>
                <span className="tpath-dot" style={{ background: st.hatched ? 'var(--accent2)' : st.discovered ? 'var(--accent)' : undefined }} />
                <span className="col" style={{ gap: 0, minWidth: 0 }}>
                  <b>{label(c)}</b>
                  {lore && (cur || k > steps.length - 4) && <small>{lore.appeared}</small>}
                </span>
                <small className="tpath-n">{st.hatched}/{st.total}</small>
              </button>
            </div>
          );
        })}
      </div>
      <div className="sep" />
      <span className="lbl">Wielkie gałęzie</span>
      <div className="tjump">
        {LANDMARK_IDS.map((id) => {
          const st = cladeStats(s, id);
          return (
            <button key={id} className={focus === id ? 'on' : ''} onClick={() => setFocus(id)} title={info(id)?.trait}>
              <span>{label(CLADES.get(id)!)}</span>
              <Progress v={st.hatched} max={st.total} />
              <small>{st.hatched}/{st.total}</small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CardsView({ s, focus }: { s: GameState; focus: number }) {
  const kids = effChildren(focus);
  const cladeKids = kids.filter((k) => !k.genus);
  const all = SUBTREE_GENERA.get(focus) ?? [];
  const genera = all.length <= 36 ? [...all].sort((a, b) => GENERA.get(b)!.fromMa - GENERA.get(a)!.fromMa) : kids.filter((k) => k.genus).map((k) => k.id);
  return (
    <div className="tree-layout">
      <PathPanel s={s} focus={focus} />
      <div className="col" style={{ gap: 14, minWidth: 0 }}>
        <div className="panel tfocus"><CladeInfoPanel s={s} id={focus} focus={focus} setSel={() => undefined} /></div>
        {cladeKids.length > 0 && (
          <div className="panel">
            <div className="panel-head"><span className="lbl"><Network className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Gałęzie · {cladeKids.length} · od najstarszej</span><span className="small muted">kliknij, żeby wejść głębiej</span></div>
            <div className="tcards">{cladeKids.map((k) => <CladeCard key={k.id} s={s} id={k.id} />)}</div>
          </div>
        )}
        {genera.length > 0 && (
          <div className="panel">
            <div className="panel-head"><span className="lbl">{all.length <= 36 ? `Rodzaje w tej gałęzi · ${genera.length}` : `Rodzaje bezpośrednio na tej gałęzi · ${genera.length}`}</span><span className="small muted">od najstarszego · kolor ramki = rzadkość</span></div>
            <div className="gcards">{genera.map((id) => <GenusCard key={id} s={s} id={id} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- search

function SearchBox({ s }: { s: GameState }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const openGenus = useStore((x) => x.openGenus);
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const clades = TAXA.clades.filter((c) => (c.namePl?.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)) && c.leafCount > 0)
      .sort((a, b) => Number(!a.namePl) - Number(!b.namePl) || b.leafCount - a.leafCount).slice(0, 8)
      .map((c) => ({ kind: 'clade' as const, id: c.id, name: label(c), sub: `${c.namePl ? c.name + ' · ' : ''}${c.leafCount} rodzajów` }));
    const genera = TAXA.genera.filter((g) => g.name.toLowerCase().includes(t) && known(s, g.id)).slice(0, 8)
      .map((g) => ({ kind: 'genus' as const, id: g.id, name: g.name, sub: `${periodLabel(g.fromMa, g.toMa)} · ${s.hatched[g.id] ? 'w parku' : 'odkryty'}` }));
    return [...clades, ...genera];
  }, [q, s.discovered]);
  return (
    <div className="tsearch">
      <Search className="ic" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj gałęzi lub rodzaju (np. trylobity, Anomalocaris)" aria-label="Szukaj w drzewie życia" />
      {q && <button className="iconbtn" aria-label="Wyczyść" onClick={() => setQ('')}><X className="ic" /></button>}
      {res.length > 0 && (
        <div className="tsearch-res">
          {res.map((r) => (
            <button key={r.kind + r.id} onClick={() => { if (r.kind === 'clade') setFocus(r.id); else { setFocus(GENERA.get(r.id)!.parent); openGenus(r.id); } setQ(''); }}>
              {r.kind === 'genus' ? <FitSprite genusId={r.id} w={40} h={22} silhouette={!s.hatched[r.id]} max={2} /> : <Network className="ic" />}
              <span className="col" style={{ gap: 0 }}><b>{r.name}</b><small className="muted">{r.sub}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- screen

export function TreeScreen() {
  const s = useGame();
  const focusRaw = useStore((x) => x.treeFocus);
  const [view, setView] = useState<'life' | 'cards'>('life');
  const focus = focusRaw ?? TAXA.rootId;
  const total = TAXA.genera.length;
  const hatched = Object.keys(s.hatched).length;
  const disc = Object.keys(s.discovered).length;
  return (
    <div className="col tree-screen">
      <div className="panel tree-head">
        <div className="col" style={{ gap: 4, minWidth: 230 }}>
          <h2 style={{ margin: 0 }}>Drzewo życia</h2>
          <span className="small muted">Kolekcja <b style={{ color: 'var(--accent2)' }}>{hatched}</b> / {total} rodzajów · odkryte <b style={{ color: 'var(--accent)' }}>{disc}</b> · ukończone gałęzie {Object.keys(s.completedClades).length}</span>
          <div className="tprog wide"><div style={{ width: `${(disc / total) * 100}%`, background: '#8a6620' }} /><div style={{ width: `${(hatched / total) * 100}%`, position: 'absolute', left: 0, top: 0, bottom: 0 }} /></div>
        </div>
        <SearchBox s={s} />
        <div className="segmented">
          <button className={view === 'life' ? 'on' : ''} onClick={() => setView('life')}><Clock className="ic" style={{ width: 14, height: 14, verticalAlign: -2 }} /> Oś życia</button>
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}><Network className="ic" style={{ width: 14, height: 14, verticalAlign: -2 }} /> Karty</button>
        </div>
      </div>
      {view === 'life' ? <LifeView s={s} focus={focus} /> : <CardsView s={s} focus={focus} />}
    </div>
  );
}

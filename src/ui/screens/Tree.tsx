import { useMemo, useState } from 'react';
import { cluster, hierarchy } from 'd3-hierarchy';
import { CLADES, GENERA, SUBTREE_GENERA, TAXA, ancestorIds } from '../../data/db';
import { BRANCHES } from '../../data/cladeRules';
import { PERIODS } from '../../data/geotime';
import { fmt } from '../../game/balance';
import { canResearchClade, cladeCost, researchClade } from '../../game/meta';
import type { GameState } from '../../game/state';
import { Bar, Btn } from '../components';
import { genusSpec, spriteUrl } from '../sprites';
import { useGame, useStore } from '../store';

interface DNode {
  id: number;
  kind: 'clade' | 'bundle' | 'genus';
  children?: DNode[];
}

function buildDisplay(focus: number, maxDepth: number): DNode {
  const rec = (id: number, depth: number): DNode => {
    if (GENERA.has(id)) return { id, kind: 'genus' };
    const c = CLADES.get(id)!;
    if (depth >= maxDepth) return { id, kind: 'bundle' };
    return { id, kind: 'clade', children: c.children.map((ch) => rec(ch, depth + 1)) };
  };
  return rec(focus, 0);
}

function countLeaves(n: DNode): number {
  return n.children ? n.children.reduce((a, c) => a + countLeaves(c), 0) : 1;
}

function chooseDepth(focus: number): number {
  let best = 1;
  for (let d = 1; d <= 6; d++) {
    const n = countLeaves(buildDisplay(focus, d));
    if (n > 140) break;
    best = d;
  }
  return best;
}

function cladeStats(s: GameState, id: number) {
  const all = SUBTREE_GENERA.get(id) ?? [];
  return { total: all.length, hatched: all.filter((g) => s.hatched[g]).length, discovered: all.filter((g) => s.discovered[g]).length };
}

// ---------------------------------------------------------------- time-scaled evolutionary tree

/** when a lineage first appears in the fossil record (oldest first appearance in its subtree) */
const ORIGIN = new Map<number, number>();
const LAST = new Map<number, number>();
for (const c of TAXA.clades) {
  const gs = SUBTREE_GENERA.get(c.id) ?? [];
  ORIGIN.set(c.id, Math.max(0, ...gs.map((g) => GENERA.get(g)!.fromMa)));
  LAST.set(c.id, Math.min(...gs.map((g) => GENERA.get(g)!.toMa), 999));
}
for (const g of TAXA.genera) { ORIGIN.set(g.id, g.fromMa); LAST.set(g.id, g.toMa); }

const EXTINCTIONS: [number, string][] = [[445, 'wymieranie ordowickie'], [372, 'wymieranie dewońskie'], [252, 'wielkie wymieranie permskie'], [201, 'wymieranie triasowe'], [66, 'koniec dinozaurów (K-Pg)']];

function sortByOrigin(n: DNode): DNode {
  if (n.children) n.children = n.children.map(sortByOrigin).sort((a, b) => (ORIGIN.get(b.id) ?? 0) - (ORIGIN.get(a.id) ?? 0));
  return n;
}

function TimeTree({ s, focus }: { s: GameState; focus: number }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const openGenus = useStore((x) => x.openGenus);
  const depth = useMemo(() => chooseDepth(focus), [focus]);
  const reveal = s.settings.revealAll;
  const data = useMemo(() => {
    const root = hierarchy<DNode>(sortByOrigin(buildDisplay(focus, depth)));
    const leaves = root.leaves();
    const ROW = 24;
    leaves.forEach((l, i) => { (l as unknown as { yy: number }).yy = 40 + i * ROW; });
    root.eachAfter((n) => {
      if (n.children) {
        const ys = n.children.map((c) => (c as unknown as { yy: number }).yy);
        (n as unknown as { yy: number }).yy = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
    });
    const start = (ORIGIN.get(focus) ?? 100) * 1.06 + 2;
    const end = Math.max(0, Math.min(...leaves.map((l) => LAST.get(l.data.id) ?? 0)) - 2);
    return { root, H: 40 + leaves.length * ROW + 30, start, end };
  }, [focus, depth]);
  const { root, H, start, end } = data;
  const CW = 900, LEFT = 150;
  const x = (ma: number) => LEFT + ((start - Math.min(start, ma)) / Math.max(1, start - end)) * CW;
  const Y = (n: unknown) => (n as { yy: number }).yy;
  const ticks: number[] = [];
  const span = start - end;
  const step = span > 300 ? 50 : span > 120 ? 20 : span > 50 ? 10 : 5;
  for (let t = Math.ceil(end / step) * step; t <= start; t += step) ticks.push(t);
  return (
    <div className="tree-wrap">
      <svg width={LEFT + CW + 230} height={H} style={{ display: 'block' }}>
        {PERIODS.filter((p) => p.end < start && p.start > end).map((p) => {
          const x0 = x(Math.min(p.start, start)), x1 = x(Math.max(p.end, end));
          return (
            <g key={p.id}>
              <rect x={x0} y={0} width={x1 - x0} height={H} fill={p.color} opacity={0.07} />
              <rect x={x0} y={0} width={x1 - x0} height={16} fill={p.color} opacity={0.75} />
              {x1 - x0 > 46 && <text x={(x0 + x1) / 2} y={12} fontSize={10} textAnchor="middle" fill="#1b1f1a">{p.namePl}</text>}
            </g>
          );
        })}
        {ticks.map((t) => <text key={t} x={x(t)} y={H - 8} fontSize={10} fill="#7d8774" textAnchor="middle">{t} mln</text>)}
        {EXTINCTIONS.filter(([ma]) => ma < start && ma > end).map(([ma, label]) => (
          <g key={ma}>
            <line x1={x(ma)} x2={x(ma)} y1={18} y2={H - 20} stroke="#d06a5a" strokeDasharray="4 4" opacity={0.6} />
            <text x={x(ma) + 3} y={28} fontSize={10} fill="#d06a5a">☄ {label}</text>
          </g>
        ))}
        {root.links().map((l, i) => {
          const px = x(ORIGIN.get(l.source.data.id) ?? 0), py = Y(l.source);
          const cx = x(ORIGIN.get(l.target.data.id) ?? 0), cy = Y(l.target);
          const t = l.target.data;
          const lit = t.kind === 'genus' ? !!s.hatched[t.id] : cladeStats(s, t.id).hatched > 0;
          return <path key={i} d={`M${px},${py} V${cy} H${cx}`} fill="none" stroke={lit ? '#7fb069' : '#566050'} strokeWidth={lit ? 1.6 : 1} />;
        })}
        {root.descendants().map((n) => {
          const d = n.data;
          const y = Y(n);
          if (d.kind === 'genus') {
            const g = GENERA.get(d.id)!;
            const known = reveal || !!s.discovered[d.id];
            const hatched = !!s.hatched[d.id];
            const best = s.bestStage[d.id] ?? 0;
            const x0 = x(g.fromMa), x1 = Math.max(x(g.toMa), x0 + 3);
            const u = spriteUrl(genusSpec(d.id), hatched ? Math.max(1, best) : 1, 0, !hatched);
            const k = Math.min(1, 20 / u.h, 40 / u.w);
            const col = hatched ? (best >= 4 ? '#f2c14e' : '#8ccf6e') : known ? '#a3ad96' : '#4a5444';
            return (
              <g key={`g${d.id}`} style={{ cursor: known ? 'pointer' : 'default' }} onClick={() => known && openGenus(d.id)}>
                <title>{known ? `${g.name}: ${Math.round(g.fromMa)}–${Math.round(g.toMa)} mln lat temu` : '???'}</title>
                <rect x={x0} y={y - 4} width={x1 - x0} height={8} rx={3} fill={col} />
                <image href={u.url} x={x1 + 4} y={y - (u.h * k) / 2} width={u.w * k} height={u.h * k} style={{ imageRendering: 'pixelated', opacity: known || hatched ? 1 : 0.35 }} />
                <text x={x1 + 48} y={y + 4} fontSize={12} fill={hatched ? '#e9ecdf' : known ? '#a3ad96' : '#5d6657'}>{known ? g.name : '???'}</text>
              </g>
            );
          }
          const c = CLADES.get(d.id)!;
          const st = cladeStats(s, d.id);
          const ox = x(ORIGIN.get(d.id) ?? 0);
          if (d.kind === 'bundle') {
            const ex = Math.max(x(LAST.get(d.id) ?? 0), ox + 6);
            return (
              <g key={`b${d.id}`} style={{ cursor: 'pointer' }} onClick={() => setFocus(d.id)}>
                <title>{`${c.namePl ?? c.name}: od ${Math.round(ORIGIN.get(d.id) ?? 0)} mln lat — kliknij, by rozwinąć`}</title>
                <rect x={ox} y={y - 5} width={ex - ox} height={10} rx={4} opacity={0.8} fill={s.completedClades[d.id] ? '#8a6620' : st.hatched ? '#4f6f3a' : '#3a4236'} stroke="#6b7863" />
                <text x={ex + 6} y={y + 4} fontSize={12} fill={c.namePl ? '#e9ecdf' : '#a3ad96'} fontStyle={c.namePl ? 'normal' : 'italic'}>{c.namePl ?? c.name} ({st.hatched}/{st.total}) ▸</text>
              </g>
            );
          }
          const showLabel = !!c.namePl || n.depth === 0 || st.total >= 8;
          return (
            <g key={`c${d.id}`} style={{ cursor: 'pointer' }} onClick={() => setFocus(d.id)}>
              <title>{`${c.namePl ?? c.name}: linia znana od ${Math.round(ORIGIN.get(d.id) ?? 0)} mln lat`}</title>
              <circle cx={ox} cy={y} r={n.depth === 0 ? 5 : 3.5} fill={s.completedClades[d.id] ? '#f2c14e' : s.researchedClades[d.id] ? '#d9a441' : st.hatched ? '#7fb069' : '#6b7863'} />
              {showLabel && <text x={ox - 5} y={y - 6} fontSize={11} textAnchor="end" fill={c.namePl ? '#e9ecdf' : '#a3ad96'} fontStyle={c.namePl ? 'normal' : 'italic'}>{c.namePl ?? c.name}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const LANDMARKS = ['Dinosauria', 'Theropoda', 'Sauropodomorpha', 'Ornithischia', 'Pterosauria', 'Ichthyosauromorpha', 'Sauropterygia', 'Mosasauridae', 'Crocodylomorpha', 'Synapsida', 'Mammalia', 'Temnospondyli', 'Placodermi', 'Chondrichthyes', 'Trilobita', 'Ammonoidea', 'Arthropoda', 'Aves'];
const LANDMARK_IDS = LANDMARKS.map((n) => TAXA.clades.find((c) => c.name === n)).filter(Boolean).map((c) => c!.id);

function Dendrogram({ s, focus }: { s: GameState; focus: number }) {
  const setFocus = useStore((x) => x.setTreeFocus);
  const openGenus = useStore((x) => x.openGenus);
  const depth = useMemo(() => chooseDepth(focus), [focus]);
  const layout = useMemo(() => {
    const root = hierarchy<DNode>(buildDisplay(focus, depth));
    const leaves = root.leaves().length;
    const H = Math.max(200, leaves * 26);
    const W = Math.max(420, depth * 115);
    cluster<DNode>().size([H, W])(root);
    return { root, H, W };
  }, [focus, depth]);
  const reveal = s.settings.revealAll;
  const { root, H, W } = layout;
  const nodes = root.descendants();
  return (
    <div className="tree-wrap">
      <svg width={W + 260} height={H + 30} style={{ display: 'block' }}>
        <g transform="translate(20,15)">
          {root.links().map((l, i) => {
            const sx = l.source.y!, sy = l.source.x!, tx = l.target.y!, ty = l.target.x!;
            const mx = (sx + tx) / 2;
            const lit = l.target.data.kind === 'genus' ? !!s.hatched[l.target.data.id] : cladeStats(s, l.target.data.id).hatched > 0;
            return <path key={i} d={`M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`} fill="none" stroke={lit ? '#7fb069' : '#4a5444'} strokeWidth={lit ? 1.6 : 1} />;
          })}
          {nodes.map((n) => {
            const x = n.y!, y = n.x!;
            const d = n.data;
            if (d.kind === 'genus') {
              const g = GENERA.get(d.id)!;
              const known = reveal || !!s.discovered[d.id];
              const hatched = !!s.hatched[d.id];
              const best = s.bestStage[d.id] ?? 0;
              const u = spriteUrl(genusSpec(d.id), hatched ? Math.max(1, best) : 1, 0, !hatched);
              const k = Math.min(1, 22 / u.h, 46 / u.w);
              return (
                <g key={`g${d.id}`} transform={`translate(${x},${y})`} style={{ cursor: known ? 'pointer' : 'default' }} onClick={() => known && openGenus(d.id)}>
                  <image href={u.url} x={4} y={-u.h * k / 2} width={u.w * k} height={u.h * k} style={{ imageRendering: 'pixelated', opacity: known || hatched ? 1 : 0.35 }} />
                  <text x={54} y={4} fontSize={12} fill={hatched ? (best >= 4 ? '#f2c14e' : '#e9ecdf') : known ? '#a3ad96' : '#5d6657'}>
                    {known ? g.name : '???'}{(s.genome[d.id] ?? 0) > 0 && !hatched ? ` · ${Math.floor(s.genome[d.id])}%` : ''}
                  </text>
                </g>
              );
            }
            const c = CLADES.get(d.id)!;
            const st = cladeStats(s, d.id);
            const researched = !!s.researchedClades[d.id];
            const done = !!s.completedClades[d.id];
            const label = c.namePl ? `${c.namePl}` : c.name;
            const isRoot = n.depth === 0;
            return (
              <g key={`c${d.id}`} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={() => setFocus(d.id)}>
                {d.kind === 'bundle' ? (
                  <rect x={-4} y={-9} width={14} height={18} rx={3} fill={done ? '#f2c14e' : st.hatched ? '#7fb069' : '#4a5444'} />
                ) : (
                  <circle r={isRoot ? 6 : 4} fill={done ? '#f2c14e' : researched ? '#d9a441' : st.hatched ? '#7fb069' : '#5d6657'} />
                )}
                {(d.kind === 'bundle' || c.namePl || isRoot || st.total >= 6) && (
                  <text x={d.kind === 'bundle' ? 14 : -8} y={d.kind === 'bundle' ? 4 : -8} textAnchor={d.kind === 'bundle' ? 'start' : 'end'} fontSize={d.kind === 'bundle' ? 12 : 11} fill={c.namePl ? '#e9ecdf' : '#a3ad96'} fontStyle={c.namePl ? 'normal' : 'italic'}>
                    {label} {d.kind === 'bundle' ? `(${st.hatched}/${st.total}) ▸` : ''}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function FocusPanel({ s, focus }: { s: GameState; focus: number }) {
  const act = useStore((x) => x.act);
  const setFocus = useStore((x) => x.setTreeFocus);
  const c = CLADES.get(focus)!;
  const st = cladeStats(s, focus);
  const can = canResearchClade(s, focus);
  const children = c.children.filter((id) => CLADES.has(id));
  return (
    <div className="panel col">
      <h2 style={{ margin: 0 }}>{c.namePl ?? c.name}</h2>
      {c.namePl && <div className="muted"><i>{c.name}</i></div>}
      <div className="small muted">ranga: {c.rank} · {st.total} rodzajów w gałęzi</div>
      <div className="row small"><span>Odkryte {st.discovered}</span><span className="spacer" /><span>W kolekcji {st.hatched}/{st.total}</span></div>
      <Bar value={st.hatched} max={st.total} kind={s.completedClades[focus] ? 'gold' : undefined} />
      {s.completedClades[focus] && <div className="small" style={{ color: '#f2c14e' }}>★ Gałąź ukończona — trwały bonus do dochodu</div>}
      {s.researchedClades[focus] ? (
        <div className="small" style={{ color: '#d9a441' }}>🔬 Gałąź zbadana — możesz sekwencjonować DNA jej przedstawicieli.</div>
      ) : (
        <div className="row">
          <Btn kind="gold" onClick={() => act((g) => researchClade(g, focus))} disabled={!can.ok} why={can.why}>🔬 Zbadaj gałąź ({fmt(cladeCost(focus))} PB)</Btn>
          {!can.ok && <span className="why">{can.why}</span>}
        </div>
      )}
      {children.length > 0 && (
        <>
          <div className="sep" />
          <h3>Podgałęzie</h3>
          <div className="list">
            {children.map((id) => {
              const ch = CLADES.get(id)!;
              const cs = cladeStats(s, id);
              return (
                <div key={id} className="item clickable" onClick={() => setFocus(id)}>
                  <div className="col" style={{ gap: 3, flex: 1 }}>
                    <div className="row small"><b>{ch.namePl ?? <i>{ch.name}</i>}</b><span className="spacer" /><span className="muted">{cs.hatched}/{cs.total}</span></div>
                    <Bar value={cs.hatched} max={cs.total} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Timeline({ s }: { s: GameState }) {
  const openGenus = useStore((x) => x.openGenus);
  const W = 1100, rowH = 64, top = 30, left = 150;
  const maxMa = 560;
  const x = (ma: number) => left + ((maxMa - ma) / maxMa) * (W - left - 10);
  const byBranch = BRANCHES.map((b) => ({ b, gs: TAXA.genera.filter((g) => g.branch === b.id) }));
  const H = top + byBranch.length * rowH + 10;
  return (
    <div className="tree-wrap">
      <svg width={W} height={H} style={{ display: 'block' }}>
        {PERIODS.filter((p) => p.end < maxMa).map((p) => (
          <g key={p.id}>
            <rect x={x(Math.min(p.start, maxMa))} y={0} width={x(p.end) - x(Math.min(p.start, maxMa))} height={H} fill={p.color} opacity={0.08} />
            <rect x={x(Math.min(p.start, maxMa))} y={0} width={x(p.end) - x(Math.min(p.start, maxMa))} height={18} fill={p.color} opacity={0.7} />
            <text x={(x(Math.min(p.start, maxMa)) + x(p.end)) / 2} y={13} fontSize={10} textAnchor="middle" fill="#1b1f1a">{x(p.end) - x(Math.min(p.start, maxMa)) > 40 ? p.namePl : ''}</text>
          </g>
        ))}
        {[500, 400, 300, 200, 100, 0].map((ma) => <text key={ma} x={x(ma)} y={H - 2} fontSize={10} fill="#a3ad96" textAnchor="middle">{ma} mln</text>)}
        {byBranch.map(({ b, gs }, i) => {
          const y0 = top + i * rowH;
          return (
            <g key={b.id}>
              <text x={8} y={y0 + rowH / 2} fontSize={12} fill={b.color}>{b.namePl}</text>
              <text x={8} y={y0 + rowH / 2 + 14} fontSize={10} fill="#a3ad96">{gs.filter((g) => s.hatched[g.id]).length}/{gs.length}</text>
              {gs.map((g, k) => {
                const yy = y0 + 4 + ((k * 7) % (rowH - 8));
                const known = s.settings.revealAll || !!s.discovered[g.id];
                const color = s.hatched[g.id] ? b.color : known ? '#8a9480' : '#3a4236';
                return (
                  <line key={g.id} x1={x(Math.min(g.fromMa, maxMa))} x2={Math.max(x(g.toMa), x(Math.min(g.fromMa, maxMa)) + 2)} y1={yy} y2={yy} stroke={color} strokeWidth={2} style={{ cursor: known ? 'pointer' : 'default' }} onClick={() => known && openGenus(g.id)}>
                    <title>{known ? `${g.name}: ${Math.round(g.fromMa)}–${Math.round(g.toMa)} mln lat` : '???'}</title>
                  </line>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TreeScreen() {
  const s = useGame();
  const focusRaw = useStore((x) => x.treeFocus);
  const setFocus = useStore((x) => x.setTreeFocus);
  const [view, setView] = useState<'evo' | 'tree' | 'time'>('evo');
  const focus = focusRaw ?? TAXA.rootId;
  const crumbs = [...ancestorIds(CLADES.get(focus)?.parent ?? null), focus];
  const total = TAXA.genera.length;
  const hatched = Object.keys(s.hatched).length;
  return (
    <div className="col">
      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>🌳 Drzewo życia</h2>
          <span className="muted">Kolekcja: <b>{hatched}</b>/{total} rodzajów · odkryte {Object.keys(s.discovered).length} · ukończone gałęzie {Object.keys(s.completedClades).length}</span>
          <span className="spacer" />
          <Btn small on={view === 'evo'} onClick={() => setView('evo')}>Ewolucja w czasie</Btn>
          <Btn small on={view === 'tree'} onClick={() => setView('tree')}>Pokrewieństwo</Btn>
          <Btn small on={view === 'time'} onClick={() => setView('time')}>Wszystkie gałęzie</Btn>
        </div>
        <div style={{ marginTop: 6 }}><Bar value={hatched} max={total} kind="gold" /></div>
        {view !== 'time' && (
          <div className="row" style={{ marginTop: 8, gap: 4 }}>
            <span className="small muted">Skocz do:</span>
            {LANDMARK_IDS.map((id) => {
              const c = CLADES.get(id)!;
              return <Btn key={id} small on={focus === id} onClick={() => setFocus(id)}>{c.namePl ?? c.name}</Btn>;
            })}
          </div>
        )}
      </div>
      {view === 'time' ? <Timeline s={s} /> : (
        <>
          <div className="crumbs">
            {crumbs.map((id, i) => (
              <span key={id}>
                {i > 0 && <span>›</span>}
                <button onClick={() => setFocus(id)}>{CLADES.get(id)?.namePl ?? CLADES.get(id)?.name}</button>
              </span>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
            {view === 'evo' ? <TimeTree s={s} focus={focus} /> : <Dendrogram s={s} focus={focus} />}
            <FocusPanel s={s} focus={focus} />
          </div>
        </>
      )}
    </div>
  );
}

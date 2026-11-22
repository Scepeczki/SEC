// Lessons: short illustrated slide shows you open when you want to learn something (never forced).
//   site  — where the site sits on the time axis, the world back then, what is new in evolution, who you dig up there
//   clade — one fork of the tree of life: what appeared there, how its branches differ, who belongs to it
//   genus — one animal: what it looked like, how it lived, how it differs from its closest relatives

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, MapPin, Skull, Sparkles, Lightbulb, X, Undo2 } from 'lucide-react';
import { CLADES, GENERA, SITE_BY_ID, SUBTREE_GENERA } from '../data/db';
import { EPOCHS, SITE_ORDER, newCladesAt } from '../data/epochs';
import { PERIODS, periodAt, periodLabel } from '../data/geotime';
import { cladeLore, genusLore, genusSites } from '../data/lore';
import { CONCEPT_BY_ID, forkWhy } from '../data/story';
import { CLADE_ID_BY_NAME, shortName, spotlightOf, treeNode, type CardKind, type TreeNode } from '../data/story/tree';
import { Rich } from './story/Rich';
import { RARITY_COLORS, RARITY_NAMES } from '../game/balance';
import type { GameState } from '../game/state';
import { FitSprite } from './components';
import { useGame, useStore, type LessonRef } from './store';
import { ERAS, EXTINCTIONS, LAST, ORIGIN, cladeStats, effChildren, fmtMa, known, label, makeScale, namedPath, nameOf, rankPl, repGenus, sitesFor } from './treeData';

// ---------------------------------------------------------------- the time axis picture

interface Mark { ma: number; text?: string; kind: 'now' | 'past' | 'next' }

/** the whole history of animals with a highlighted span and optional markers (e.g. all dig sites) */
export function GeoAxis({ span, marks = [], from = 545, to = 0, tall }: { span?: [number, number]; marks?: Mark[]; from?: number; to?: number; tall?: boolean }) {
  const W = 600, top = 4, H = tall ? 132 : 104;
  const x = makeScale(from, to, 6, W - 6, true);
  const yE = top, yP = top + 18, yL = top + 44;
  return (
    <svg className="geoaxis" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oś czasu geologicznego">
      {ERAS.filter((e) => e.end < from).map((e) => (
        <g key={e.name}>
          <rect x={x(Math.min(from, e.start))} y={yE} width={x(e.end) - x(Math.min(from, e.start)) - 1} height={15} rx={3} fill={e.color} />
          <text x={(x(Math.min(from, e.start)) + x(e.end)) / 2} y={yE + 11} textAnchor="middle" className="ga-era">{e.name}</text>
        </g>
      ))}
      {PERIODS.filter((p) => p.end < from && p.start > to).map((p) => {
        const a = x(Math.min(from, p.start)), b = x(Math.max(to, p.end));
        return (
          <g key={p.id}>
            <rect x={a} y={yP} width={Math.max(1, b - a - 1)} height={20} rx={3} fill={p.color} opacity={0.85} />
            {b - a > 34 && <text x={(a + b) / 2} y={yP + 14} textAnchor="middle" className="ga-per">{p.namePl}</text>}
          </g>
        );
      })}
      <line x1={6} x2={W - 6} y1={yL + 12} y2={yL + 12} className="ga-line" />
      {EXTINCTIONS.filter((e) => e.ma < from && e.ma > to).map((e) => (
        <g key={e.ma}><line x1={x(e.ma)} x2={x(e.ma)} y1={yP} y2={yL + 22} className="ga-ext" /><title>{e.name} ({e.ma} mln lat temu)</title></g>
      ))}
      {span && (
        <rect x={x(span[0])} y={yP - 2} width={Math.max(4, x(span[1]) - x(span[0]))} height={yL + 26 - yP} rx={4} className="ga-span" />
      )}
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={x(m.ma)} cy={yL + 12} r={m.kind === 'now' ? 6 : 3.5} className={`ga-mark ${m.kind}`} />
          {m.text && <text x={Math.min(W - 60, Math.max(60, x(m.ma)))} y={yL + 36 + (m.kind === 'now' ? 0 : 12)} textAnchor="middle" className={`ga-mtext ${m.kind}`}>{m.text}</text>}
        </g>
      ))}
      <text x={6} y={H - 4} className="ga-tick">{Math.round(from)} mln lat temu</text>
      <text x={W - 6} y={H - 4} textAnchor="end" className="ga-tick">dziś</text>
    </svg>
  );
}

// ---------------------------------------------------------------- small pieces

function Pic({ s, id, w = 120, h = 70 }: { s: GameState; id: number; w?: number; h?: number }) {
  const hatched = !!s.hatched[id];
  return <FitSprite genusId={id} w={w} h={h} silhouette={!hatched && !known(s, id)} stage={hatched ? Math.max(1, s.bestStage[id] ?? 1) : 1} max={6} title={known(s, id) ? GENERA.get(id)!.name : 'Nieodkryty'} />;
}

function GenusTile({ s, id, go }: { s: GameState; id: number; go: Go }) {
  const g = GENERA.get(id)!;
  const k = known(s, id);
  return (
    <button className={`ls-tile ${k ? '' : 'unknown'}`} onClick={() => k && go({ kind: 'genus', id })} disabled={!k} title={k ? `${g.name}: lekcja o tym zwierzęciu` : 'Jeszcze nieodkryty: wykop go, żeby poznać szczegóły'}>
      <span className="ls-tile-pic"><Pic s={s} id={id} w={64} h={36} /></span>
      <b>{k ? g.name : '???'}</b>
    </button>
  );
}

function StatGrid({ items }: { items: [string, ReactNode][] }) {
  return <dl className="ls-stats">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function PathSteps({ id, go }: { id: number; go: Go }) {
  const path = namedPath(id).slice(-6);
  return (
    <ol className="ls-path">
      {path.map((cid, i) => {
        const lore = cladeLore(cid);
        const cur = i === path.length - 1;
        return (
          <li key={cid} className={cur ? 'cur' : ''}>
            <button onClick={() => !cur && go({ kind: 'clade', id: cid })} disabled={cur}><b>{nameOf(cid)}</b></button>
            {lore && <small>{lore.appeared}</small>}
          </li>
        );
      })}
    </ol>
  );
}

type Go = (r: LessonRef) => void;
interface Slide { kicker: string; title: string; art?: ReactNode; body: ReactNode }

const HAB: Record<string, string> = { land: 'ląd', freshwater: 'słodka woda', marine: 'morze', air: 'powietrze' };
const FOOD: Record<string, string> = { meat: 'mięsożerca', plants: 'roślinożerca', fish: 'rybożerca', plankton: 'filtrator / plankton' };
const SIZE: Record<string, string> = { XS: 'kilka cm', S: 'do kilkudziesięciu cm', M: 'do ok. 1 m', L: 'kilka metrów', XL: 'olbrzym' };

// ---------------------------------------------------------------- site

function siteSlides(s: GameState, siteId: string, go: Go): Slide[] {
  const site = SITE_BY_ID.get(siteId)!;
  const ep = EPOCHS[siteId];
  const k = SITE_ORDER.indexOf(siteId);
  const mid = (site.fromMa + site.toMa) / 2;
  const marks: Mark[] = SITE_ORDER.map((id, i) => {
    const x = SITE_BY_ID.get(id)!;
    return { ma: (x.fromMa + x.toMa) / 2, kind: i === k ? 'now' : i < k ? 'past' : 'next', text: i === k ? x.name : undefined } as Mark;
  });
  const fauna = [...site.fauna].sort((a, b) => b.occ - a.occ);
  const disc = fauna.filter((f) => s.discovered[f.genusId]).length;
  const firstDino = 233;
  const fresh = newCladesAt(siteId).filter((x) => x.clade.leafCount < 1500).slice(0, 6);
  // group the fauna by its nearest Polish-named ancestor
  const groups = new Map<number, number[]>();
  for (const f of fauna) {
    const path = namedPath(f.genusId);
    const g = path[path.length - 1];
    const arr = groups.get(g) ?? [];
    arr.push(f.genusId);
    groups.set(g, arr);
  }
  const prev = SITE_ORDER[k - 1], next = SITE_ORDER[k + 1];
  const slides: Slide[] = [
    {
      kicker: `Etap ${k + 1} z ${SITE_ORDER.length}`,
      title: `${site.name}: gdzie jesteśmy w czasie`,
      art: <GeoAxis marks={marks} span={[site.fromMa, Math.max(site.toMa, site.fromMa - 6)]} tall />,
      body: (
        <>
          <p><b>{site.name}</b> ({site.country}) to skały sprzed <b>{Math.round(site.fromMa)}–{Math.round(site.toMa) || '<1'} mln lat</b>. To okres: <b>{periodAt(mid).namePl}</b>, era: {periodAt(mid).era}.</p>
          <p>
            {mid > firstDino
              ? <>Do pierwszych dinozaurów zostało jeszcze ok. <b>{Math.round(mid - firstDino)} mln lat</b>.</>
              : mid > 66 ? <>Trwa era dinozaurów: do ich końca zostało ok. <b>{Math.round(mid - 66)} mln lat</b>.</>
                : <>Dinozaury (poza ptakami) wymarły ok. <b>{Math.round(66 - mid)} mln lat</b> wcześniej.</>}
            {' '}Od tego czasu minęło {Math.round(mid)} mln lat. Gdyby cała historia zwierząt trwała jeden dzień, to stanowisko leżałoby o godz. {clock(mid)}.
          </p>
          <p className="muted small">Kropki na osi to wszystkie stanowiska w grze. Otwierasz je po kolei, od najstarszego, czyli idziesz w górę drzewa życia.</p>
        </>
      ),
    },
  ];
  if (ep) {
    slides.push({
      kicker: 'Świat w tamtym czasie',
      title: ep.title,
      art: <div className="ls-collage">{fauna.slice(0, 6).map((f) => <Pic key={f.genusId} s={s} id={f.genusId} w={120} h={64} />)}</div>,
      body: (
        <>
          <p>{ep.story}</p>
          <p className="muted">{site.description}</p>
        </>
      ),
    });
    slides.push({
      kicker: 'Co nowego w ewolucji',
      title: 'Nowości tego etapu',
      art: (
        <ul className="ls-innov">{ep.innovations.map((x) => <li key={x}><Lightbulb className="ic" />{x}</li>)}</ul>
      ),
      body: fresh.length ? (
        <>
          <p>Te gałęzie drzewa życia spotykasz <b>po raz pierwszy</b> właśnie tutaj:</p>
          <div className="ls-forks">
            {fresh.map((x) => (
              <button key={x.clade.id} onClick={() => go({ kind: 'clade', id: x.clade.id })}>
                <b>{label(x.clade)}</b>
                <small>{cladeLore(x.clade.id)?.appeared ?? `${x.genera} rodzajów na tym stanowisku`}</small>
              </button>
            ))}
          </div>
        </>
      ) : <p>To stanowisko rozwija gałęzie, które znasz z wcześniejszych etapów.</p>,
    });
  }
  slides.push({
    kicker: `Kogo tu wykopiesz · odkryte ${disc} z ${fauna.length}`,
    title: 'Fauna stanowiska',
    art: (
      <div className="ls-groups">
        {[...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([gid, ids]) => (
          <div key={gid} className="ls-group">
            <button className="ls-group-h" onClick={() => go({ kind: 'clade', id: gid })}><b>{nameOf(gid)}</b> <small>{ids.length}</small></button>
            <div className="ls-tiles">{ids.map((id) => <GenusTile key={id} s={s} id={id} go={go} />)}</div>
          </div>
        ))}
      </div>
    ),
    body: (
      <>
        <p>Zwierzęta pogrupowane według gałęzi drzewa życia. Kliknij grupę, żeby zobaczyć, czym się wyróżnia, albo odkryte zwierzę, żeby poznać je bliżej.</p>
        <p className="muted small">Szare sylwetki to zwierzęta, których jeszcze nie wykopałeś. Ich nazwy poznasz, gdy je znajdziesz.</p>
      </>
    ),
  });
  if (ep) {
    slides.push({
      kicker: 'Na koniec',
      title: 'Ciekawostka',
      art: ep.extinction ? <div className="ls-ext"><Skull className="ic" /><span>{ep.extinction}</span></div> : <div className="ls-fact-big"><Sparkles className="ic" /></div>,
      body: (
        <>
          <p className="ls-fact"><Sparkles className="ic" /> {ep.fact}</p>
          <div className="ls-nav-sites">
            {prev && <button onClick={() => go({ kind: 'site', id: prev })}>← {SITE_BY_ID.get(prev)!.name}: {EPOCHS[prev]?.title}</button>}
            {next && <button onClick={() => go({ kind: 'site', id: next })}>{SITE_BY_ID.get(next)!.name}: {EPOCHS[next]?.title} →</button>}
          </div>
        </>
      ),
    });
  }
  return slides;
}

/** position on a 24-hour clock where 545 Ma is midnight and today is 24:00 */
function clock(ma: number): string {
  const m = Math.round((1 - ma / 545) * 24 * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- fork (clade)

function cladeSlides(s: GameState, id: number, go: Go): Slide[] {
  const node = treeNode(id);
  if (node) return walkSlides(s, id, go, node);
  const c = CLADES.get(id)!;
  const lore = cladeLore(id);
  const from = ORIGIN.get(id) ?? 0, to = LAST.get(id) ?? 0;
  const st = cladeStats(s, id);
  const kids = effChildren(id);
  const where = sitesFor(id);
  const all = [...(SUBTREE_GENERA.get(id) ?? [])].sort((a, b) => GENERA.get(b)!.fromMa - GENERA.get(a)!.fromMa);
  const rep = repGenus(s, id);
  const slides: Slide[] = [
    {
      kicker: `Rozwidlenie drzewa życia · ${rankPl(c.rank)}`,
      title: label(c),
      art: (
        <div className="col" style={{ gap: 10 }}>
          <GeoAxis span={[from, to]} />
          <PathSteps id={id} go={go} />
        </div>
      ),
      body: (
        <>
          {c.namePl && <p className="muted latin">{c.name}</p>}
          <p>Pierwsze skamieniałości tej gałęzi mają <b>{Math.round(from)} mln lat</b>. {to > 0.5 ? <>Ostatnie znikają ok. <b>{Math.round(to)} mln lat temu</b>.</> : <>Jej przedstawiciele <b>żyją do dziś</b>.</>}</p>
          <p>Po lewej widzisz drogę od pierwszych zwierząt aż tutaj. Każdy krok to rozwidlenie, na którym pojawiło się coś nowego.</p>
          <StatGrid items={[['rodzajów w grze', st.total], ['odkrytych', st.discovered], ['w kolekcji', st.hatched]]} />
        </>
      ),
    },
    {
      kicker: 'Co się tu pojawiło',
      title: lore ? lore.appeared[0].toUpperCase() + lore.appeared.slice(1) : 'Nowa gałąź',
      art: rep !== undefined ? <div className="ls-portrait"><Pic s={s} id={rep} w={260} h={150} /><small>{known(s, rep) ? GENERA.get(rep)!.name : 'nieodkryty przedstawiciel'}</small></div> : undefined,
      body: lore ? <p>{lore.desc}</p> : <p>Ta gałąź nie ma jeszcze szczegółowego opisu. Wiadomo, że obejmuje {st.total} rodzajów żyjących od {Math.round(from)} mln lat temu.</p>,
    },
  ];
  const why = forkWhy(c.name);
  if (why?.length) {
    slides.push({
      kicker: 'Dlaczego to ważne',
      title: 'Skąd się to wzięło i co zmieniło',
      art: <PathSteps id={id} go={go} />,
      body: <>{why.map((p, k) => <p key={k}>{p}</p>)}</>,
    });
  }
  if (kids.length > 1) {
    slides.push({
      kicker: `${kids.length} gałęzi`,
      title: 'Czym różnią się gałęzie',
      art: <ForkPicture s={s} id={id} kids={kids} go={go} />,
      body: (
        <>
          {lore?.split && <p>{lore.split}</p>}
          <p className="muted small">Na rysunku każda linia to jedna gałąź, od jej pierwszej skamieniałości do ostatniej. Kliknij gałąź, żeby przejść do jej lekcji.</p>
        </>
      ),
    });
  }
  slides.push({
    kicker: `Przedstawiciele · ${st.discovered}/${st.total} odkrytych`,
    title: 'Kogo znajdziesz w tej gałęzi',
    art: <div className="ls-tiles big">{all.slice(0, 30).map((g) => <GenusTile key={g} s={s} id={g} go={go} />)}{all.length > 30 && <span className="muted small">+{all.length - 30}</span>}</div>,
    body: (
      <>
        <p>Rodzaje od najstarszego.</p>
        {where.length ? (
          <div className="col" style={{ gap: 6 }}>
            <span className="lbl"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Gdzie kopać</span>
            <div className="ls-forks">
              {where.slice(0, 8).map((w) => (
                <button key={w.id} onClick={() => go({ kind: 'site', id: w.id })}><b>{w.name}</b><small>{w.n} rodzajów · {EPOCHS[w.id]?.title ?? ''}{s.unlockedSites[w.id] ? '' : ' · jeszcze zamknięte'}</small></button>
              ))}
            </div>
          </div>
        ) : <p className="muted">Tej gałęzi nie ma jeszcze na żadnym stanowisku.</p>}
      </>
    ),
  });
  return slides;
}

// ---------------------------------------------------------------- fork told by the Librarian (story/tree)

const CARD_KICKER: Record<CardKind, string> = {
  swiat: 'Świat w tamtym czasie',
  'punkt-wyjscia': 'Punkt wyjścia',
  nowosc: 'Co nowego się pojawiło',
  dlaczego: 'Dlaczego to się opłaciło',
  rozwidlenie: 'Rozwidlenie',
  skutki: 'Co z tego wynikło',
};
const CONFIDENCE: Record<string, string> = { pewne: 'pewne', prawdopodobne: 'prawdopodobne', sporne: 'sporne – badacze się spierają' };

function BranchTable({ node, go }: { node: TreeNode; go: Go }) {
  return (
    <div className="ls-branches">
      {node.branches.map((b) => {
        const cid = CLADE_ID_BY_NAME.get(b.id);
        const dead = /wymar/.test(b.fate);
        return (
          <button key={b.id} className={`ls-branch ${dead ? 'dead' : 'alive'}`} disabled={cid == null} onClick={() => cid != null && go({ kind: 'clade', id: cid })} title={cid != null ? 'Przejdź do tej gałęzi' : undefined}>
            <b>{shortName(b.namePl)}</b>
            <span>{b.trait}</span>
            <small>→ {b.became} · <i>{b.fate}</i></small>
          </button>
        );
      })}
    </div>
  );
}

function walkSlides(s: GameState, id: number, go: Go, node: TreeNode): Slide[] {
  const c = CLADES.get(id)!;
  const from = ORIGIN.get(id) ?? 0, to = LAST.get(id) ?? 0;
  const st = cladeStats(s, id);
  const kids = effChildren(id);
  const where = sitesFor(id);
  const all = [...(SUBTREE_GENERA.get(id) ?? [])].sort((a, b) => GENERA.get(b)!.fromMa - GENERA.get(a)!.fromMa);
  const rep = repGenus(s, id);
  const portrait = rep !== undefined ? <div className="ls-portrait"><Pic s={s} id={rep} w={260} h={150} /><small>{known(s, rep) ? GENERA.get(rep)!.name : 'nieodkryty przedstawiciel'}</small></div> : undefined;
  const collage = all.length ? <div className="ls-collage">{all.slice(0, 6).map((g) => <Pic key={g} s={s} id={g} w={120} h={64} />)}</div> : portrait;
  const artFor = (kind: CardKind): ReactNode => {
    switch (kind) {
      case 'rozwidlenie': return kids.length > 1 ? <ForkPicture s={s} id={id} kids={kids} go={go} /> : node.branches.length ? <BranchTable node={node} go={go} /> : portrait;
      case 'dlaczego': return <PathSteps id={id} go={go} />;
      case 'skutki': case 'swiat': return collage;
      default: return portrait;
    }
  };
  const slides: Slide[] = [
    {
      kicker: `Rozwidlenie drzewa życia · ${rankPl(c.rank)} · ${node.stage ? `etap ${node.stage}` : "pień drzewa"}`,
      title: node.namePl,
      art: (
        <div className="col" style={{ gap: 10 }}>
          <GeoAxis span={[from, to]} />
          <PathSteps id={id} go={go} />
        </div>
      ),
      body: (
        <>
          <p className="muted latin">{c.name}</p>
          <p className="ls-headline">{node.headline}</p>
          <dl className="ls-when">
            {node.when.split && <div><dt>rozdzielenie</dt><dd>{node.when.split}</dd></div>}
            {node.when.firstFossils && <div><dt>pierwsze skamieniałości</dt><dd>{node.when.firstFossils}</dd></div>}
            {node.when.confidence && <div><dt>pewność</dt><dd>{CONFIDENCE[node.when.confidence] ?? node.when.confidence}</dd></div>}
          </dl>
          <StatGrid items={[['rodzajów w grze', st.total], ['odkrytych', st.discovered], ['w kolekcji', st.hatched]]} />
        </>
      ),
    },
    ...node.scene.map((card) => ({ kicker: CARD_KICKER[card.kind] ?? card.kind, title: card.title, art: artFor(card.kind), body: <p><Rich text={card.text} /></p> })),
  ];
  if (node.branches.length) {
    slides.push({
      kicker: `${node.branches.length} ${node.branches.length === 1 ? 'gałąź' : node.branches.length < 5 ? 'gałęzie' : 'gałęzi'}`,
      title: 'Na co się dzieli',
      art: kids.length > 1 ? <ForkPicture s={s} id={id} kids={kids} go={go} /> : portrait,
      body: (
        <>
          <BranchTable node={node} go={go} />
          <p className="muted small">Kliknij gałąź, żeby przejść do jej lekcji. Zielone żyją do dziś, szare wymarły.</p>
        </>
      ),
    });
  }
  const concepts = node.concepts.map((k) => CONCEPT_BY_ID.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
  if (node.misconception || concepts.length || node.sources.length) {
    slides.push({
      kicker: 'Do zapamiętania',
      title: node.misconception ? 'Uwaga na pułapkę' : 'Pojęcia i źródła',
      body: (
        <>
          {node.misconception && <p className="ls-myth"><Lightbulb className="ic" /> {node.misconception}</p>}
          {concepts.length > 0 && (
            <div className="ls-concepts">
              {concepts.map((k) => <div key={k.id}><b>{k.name}</b><small>{k.short}</small></div>)}
            </div>
          )}
          {node.sources.length > 0 && (
            <details className="ls-sources">
              <summary>Źródła ({node.sources.length})</summary>
              <ul>{node.sources.map((x, k) => <li key={k}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}{x.claim && <small> — {x.claim}</small>}</li>)}</ul>
            </details>
          )}
        </>
      ),
    });
  }
  slides.push({
    kicker: `Przedstawiciele · ${st.discovered}/${st.total} odkrytych`,
    title: 'Kogo znajdziesz w tej gałęzi',
    art: <div className="ls-tiles big">{all.slice(0, 30).map((g) => <GenusTile key={g} s={s} id={g} go={go} />)}{all.length > 30 && <span className="muted small">+{all.length - 30}</span>}</div>,
    body: where.length ? (
      <div className="col" style={{ gap: 6 }}>
        <span className="lbl"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Gdzie kopać</span>
        <div className="ls-forks">
          {where.slice(0, 8).map((w) => (
            <button key={w.id} onClick={() => go({ kind: 'site', id: w.id })}><b>{w.name}</b><small>{w.n} rodzajów{s.unlockedSites[w.id] ? '' : ' · jeszcze zamknięte'}</small></button>
          ))}
        </div>
      </div>
    ) : <p className="muted">Tej gałęzi nie ma jeszcze na żadnym stanowisku.</p>,
  });
  return slides;
}

/** a tiny time chart of the branches of one fork */
function ForkPicture({ s, id, kids, go }: { s: GameState; id: number; kids: { id: number; genus: boolean }[]; go: Go }) {
  const shown = kids.slice(0, 9);
  const from = (ORIGIN.get(id) ?? 0), to = Math.min(...shown.map((k) => LAST.get(k.id) ?? 0));
  const pad = Math.max(1, (from - to) * 0.06);
  const W = 600, row = 34, top = 10;
  const x = makeScale(from + pad, Math.max(0, to - pad), 14, W - 14, true);
  const H = top + shown.length * row + 18;
  const y0 = top + 10;
  return (
    <svg className="ls-fork" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gałęzie rozwidlenia na osi czasu">
      <circle cx={x(from)} cy={y0} r={6} className="lf-node" />
      {shown.map((k, i) => {
        const y = y0 + i * row;
        const a = x(ORIGIN.get(k.id) ?? from), b = Math.max(a + 4, x(LAST.get(k.id) ?? 0));
        const lore = k.genus ? undefined : cladeLore(k.id);
        const st = cladeStats(s, k.id);
        const name = k.genus ? (known(s, k.id) ? GENERA.get(k.id)!.name : '???') : nameOf(k.id);
        return (
          <g key={k.id} className="lf-branch" onClick={() => go(k.genus ? { kind: 'genus', id: k.id } : { kind: 'clade', id: k.id })}>
            {i > 0 && <path d={`M${x(from)},${y0} C${x(from) + 10},${y0} ${a - 10},${y} ${a},${y}`} className="lf-curve" />}
            <line x1={a} x2={b} y1={y} y2={y} className={`lf-line c${i % 8}`} strokeWidth={Math.min(12, 3 + Math.log2(1 + st.total) * 1.6)} />
            <text x={a + 4} y={y - 8} className="lf-name">{name}<tspan className="lf-sub">{lore ? ` · ${lore.appeared}` : ` · ${st.total}`}</tspan></text>
          </g>
        );
      })}
      <text x={14} y={H - 3} className="ga-tick">{fmtMa(from + pad)} lat temu</text>
      <text x={W - 14} y={H - 3} textAnchor="end" className="ga-tick">{fmtMa(Math.max(0, to - pad))}{to - pad > 0.5 ? ' lat temu' : ''}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- genus

function genusSlides(s: GameState, id: number, go: Go): Slide[] {
  const g = GENERA.get(id)!;
  const lore = genusLore(g);
  const where = genusSites(id).map((sid) => SITE_BY_ID.get(sid)!).sort((a, b) => SITE_ORDER.indexOf(a.id) - SITE_ORDER.indexOf(b.id));
  const parentKids = effChildren(g.parent).filter((k) => k.id !== id);
  // closest relatives: same parent, else the named group around it
  const relatives = (parentKids.length ? parentKids.map((k) => k.id) : []).slice(0, 8);
  const path = namedPath(id);
  const group = path[path.length - 1];
  const groupMates = (SUBTREE_GENERA.get(group) ?? []).filter((x) => x !== id && !relatives.includes(x)).slice(0, 8 - Math.min(8, relatives.length));
  const slides: Slide[] = [
    {
      kicker: `${RARITY_NAMES[g.rarity]} · ${periodLabel(g.fromMa, g.toMa)}`,
      title: g.name,
      art: (
        <div className="col" style={{ gap: 10 }}>
          <div className="ls-portrait" style={{ ['--rc' as string]: RARITY_COLORS[g.rarity] }}><Pic s={s} id={id} w={300} h={150} /></div>
          <GeoAxis span={[g.fromMa, g.toMa]} />
        </div>
      ),
      body: (
        <>
          <p>{lore.look}</p>
          <StatGrid items={[
            ['żył', `${Math.round(g.fromMa)}–${Math.round(g.toMa) || '<1'} mln lat temu`],
            ['środowisko', HAB[g.habitat]],
            ['dieta', FOOD[g.food]],
            ['wielkość', SIZE[g.size]],
            ...(g.family ? [['rodzina', <i key="f">{g.family}</i>] as [string, ReactNode]] : []),
          ]} />
        </>
      ),
    },
    {
      kicker: 'Jak żył',
      title: 'Życie codzienne',
      art: <div className="ls-portrait"><Pic s={s} id={id} w={300} h={170} /></div>,
      body: <p>{lore.life}</p>,
    },
    {
      kicker: 'Na tle krewnych',
      title: 'Czym się wyróżnia',
      art: (
        <div className="col" style={{ gap: 10 }}>
          <PathSteps id={g.parent} go={go} />
          {(relatives.length > 0 || groupMates.length > 0) && (
            <div className="ls-tiles">
              {relatives.map((r) => GENERA.has(r) ? <GenusTile key={r} s={s} id={r} go={go} /> : (
                <button key={r} className="ls-tile clade" onClick={() => go({ kind: 'clade', id: r })}><b>{nameOf(r)}</b><small>gałąź</small></button>
              ))}
              {groupMates.map((r) => <GenusTile key={r} s={s} id={r} go={go} />)}
            </div>
          )}
        </div>
      ),
      body: (
        <>
          <p>{lore.diff}</p>
          <p className="muted small">Po lewej: kolejne rozwidlenia, które doprowadziły do tego zwierzęcia, i jego najbliżsi krewni w grze.</p>
        </>
      ),
    },
  ];
  // the Librarian's close-up cards (stage spotlights) go right after the portrait
  const spot = spotlightOf(g.name);
  if (spot) slides.splice(1, 0, ...spot.cards.map((card) => ({ kicker: 'Z bliska', title: card.title, art: <div className="ls-portrait"><Pic s={s} id={id} w={300} h={170} /></div>, body: <p><Rich text={card.text} /></p> })));
  slides.push({
    kicker: 'Na koniec',
    title: lore.fact ? 'Ciekawostka' : 'Gdzie go szukać',
    art: lore.fact ? <div className="ls-fact-big"><Sparkles className="ic" /></div> : undefined,
    body: (
      <>
        {lore.fact && <p className="ls-fact"><Sparkles className="ic" /> {lore.fact}</p>}
        {where.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <span className="lbl"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Stanowiska</span>
            <div className="ls-forks">
              {where.map((w) => <button key={w.id} onClick={() => go({ kind: 'site', id: w.id })} title={w.fauna.find((f) => f.genusId === id)?.guest ? 'Gość epoki: żył w tym czasie i środowisku, ale jego skamieniałości znaleziono gdzie indziej. Stanowisko w grze reprezentuje całą epokę.' : undefined}><b>{w.name}</b><small>{EPOCHS[w.id]?.title ?? w.period}{w.fauna.find((f) => f.genusId === id)?.guest ? ' · gość epoki' : ''}</small></button>)}
            </div>
          </div>
        )}
      </>
    ),
  });
  return slides;
}

// ---------------------------------------------------------------- the window

function slidesFor(s: GameState, r: LessonRef, go: Go): Slide[] {
  if (r.kind === 'site') return SITE_BY_ID.has(r.id) ? siteSlides(s, r.id, go) : [];
  if (r.kind === 'clade') return CLADES.has(r.id) ? cladeSlides(s, r.id, go) : [];
  return GENERA.has(r.id) ? genusSlides(s, r.id, go) : [];
}

export function LessonModal() {
  const s = useGame();
  const ref = useStore((x) => x.lesson);
  const open = useStore((x) => x.openLesson);
  const close = useStore((x) => x.closeLesson);
  const [i, setI] = useState(0);
  const [back, setBack] = useState<{ ref: LessonRef; i: number }[]>([]);
  useEffect(() => { if (!ref) setBack([]); }, [ref]);
  const go: Go = (r) => { if (ref) setBack((b) => [...b, { ref, i }]); setI(0); open(r); };
  const goBack = () => { const b = back[back.length - 1]; if (!b) return; setBack(back.slice(0, -1)); setI(b.i); open(b.ref); };
  const slides = ref ? slidesFor(s, ref, go) : [];
  const n = slides.length;
  useEffect(() => {
    if (!ref) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setI((v) => Math.min(n - 1, v + 1));
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [ref, n]);
  if (!ref || !n) return null;
  const cur = slides[Math.min(i, n - 1)];
  const what = ref.kind === 'site' ? 'Pokaz stanowiska' : ref.kind === 'clade' ? 'Lekcja: rozwidlenie' : 'Lekcja: zwierzę';
  return (
    <div className="modal-bg lesson-bg" onClick={close}>
      <div className="modal lesson" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={what}>
        <div className="ls-head">
          {back.length > 0 && <button className="btn small" onClick={goBack} title="Wróć do poprzedniej lekcji"><Undo2 className="ic" /> Wróć</button>}
          <span className="lbl"><GraduationCap className="ic" style={{ width: 14, height: 14, verticalAlign: -3 }} /> {what} · {cur.kicker}</span>
          <div className="ls-dots" role="tablist">
            {slides.map((x, k) => <button key={k} className={k === i ? 'on' : k < i ? 'past' : ''} onClick={() => setI(k)} aria-label={`Slajd ${k + 1}: ${x.title}`} title={x.title} />)}
          </div>
          <button className="iconbtn" onClick={close} aria-label="Zamknij"><X className="ic" /></button>
        </div>
        <div className={`ls-body ${cur.art ? '' : 'noart'}`} key={`${ref.kind}${ref.id}-${i}`}>
          {cur.art && <div className="ls-art">{cur.art}</div>}
          <div className="ls-text">
            <h2>{cur.title}</h2>
            {cur.body}
          </div>
        </div>
        <div className="ls-foot">
          <button className="btn" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><ChevronLeft className="ic" /> Wstecz</button>
          <span className="muted small">{i + 1} / {n} · strzałki ← → przełączają slajdy</span>
          {i < n - 1
            ? <button className="btn primary" onClick={() => setI(i + 1)}>Dalej <ChevronRight className="ic" /></button>
            : <button className="btn primary" onClick={close}>Zakończ</button>}
        </div>
      </div>
    </div>
  );
}

/** a button that opens a lesson */
export function LessonBtn({ to, children, small }: { to: LessonRef; children?: ReactNode; small?: boolean }) {
  const open = useStore((x) => x.openLesson);
  return <button className={`btn lesson-btn ${small ? 'small' : ''}`} onClick={() => open(to)}><GraduationCap className="ic" /> {children ?? 'Lekcja'}</button>;
}


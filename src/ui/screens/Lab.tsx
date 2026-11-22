// Laboratory: two tabs, like a production line.
//   1 · Ekstrakcja DNA — bones → genome. Ready species, species waiting for research (grouped by the branch to research),
//       the extraction stations with their queue on the right.
//   2 · Wylęgarnia — genome ≥ 50% → animal. A list on the left, a big species card in the middle (the species' path from
//       bones to the park, odds, time, where it will live), the incubators with eggs on the right, and the hatching moment.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bone, Check, ChevronRight, Dna, Egg, FlaskConical, Home, Landmark, Microscope, Sparkles, Timer, Users } from 'lucide-react';
import { CLADES, GENERA, SITE_BY_ID } from '../../data/db';
import { SIZE_SLOTS } from '../../data/archetypes';
import { HABITAT_NAMES, QUALITY_NAMES, RARITY_COLORS, RARITY_NAMES, SIZE_NAMES, fmt, fmtTime } from '../../game/balance';
import { BUILDING_BY_ID } from '../../game/content';
import { canExtract, canSynthesize, destinationFor, extractDuration, genomeGain, queueAll, queueExtraction, synthesize } from '../../game/lab';
import { canResearchClade, cladeCost, gateOf, isGateOpen, researchClade } from '../../game/meta';
import { mods, type Mods } from '../../game/mods';
import { donateFossil, donateValue } from '../../game/park';
import { ENCLOSURE_NAMES, enclosureDefId } from '../../game/parkContent';
import type { Animal, GameState, Quality } from '../../game/state';
import { TAXA } from '../../data/db';
import { usePark } from '../park/parkUi';
import { sfx } from '../sound';
import { Btn, Empty, FitSprite } from '../components';
import { useGame, useStore } from '../store';

const QUALITY_COLORS = ['#9a8f80', '#c9d3dc', '#f2c14e'];
const genome = (s: GameState, id: number) => s.genome[id] ?? 0;
const fossilCount = (s: GameState, id: number) => (s.fossils[id] ?? [0, 0, 0]).reduce((a, b) => a + b, 0);
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

/** genome bar with the 50% hatching mark */
function GenomeBar({ value, thin }: { value: number; thin?: boolean }) {
  const col = value >= 100 ? 'var(--accent)' : value >= 50 ? 'var(--accent2)' : 'var(--blue)';
  return (
    <div className={`gbar ${thin ? 'thin' : ''}`} title={`Genom ${Math.floor(value)}% · od 50% można wylęgać, 100% = pewny sukces`}>
      <div style={{ width: `${Math.min(100, value)}%`, background: col }} />
      <i />
    </div>
  );
}

function RarityTag({ r }: { r: number }) {
  return <span className="rtag" style={{ color: RARITY_COLORS[r], borderColor: RARITY_COLORS[r] }}>{RARITY_NAMES[r]}</span>;
}

// ---------------------------------------------------------------- tab 1: extraction

type XFilter = 'all' | 'ready' | 'gated' | 'rare';

function FossilChips({ s, id, m, act }: { s: GameState; id: number; m: Mods; act: ReturnType<typeof useStore.getState>['act'] }) {
  const f = s.fossils[id] ?? [0, 0, 0];
  const full = genome(s, id) >= 100;
  return (
    <div className="row" style={{ gap: 6 }}>
      {([2, 1, 0] as Quality[]).map((q) => f[q] > 0 && (
        full ? (
          <button key={q} className="qchip" disabled={s.buildings.museum < 1} onClick={() => act((st) => donateFossil(st, id, q))}
            title={s.buildings.museum < 1 ? 'Zbuduj Muzeum, żeby przekazywać zbędne kości' : `Przekaż do muzeum: +${donateValue(id, q).coins} monet`}>
            <Landmark className="ic" /><i style={{ background: QUALITY_COLORS[q] }} />{QUALITY_NAMES[q]} ×{f[q]}
          </button>
        ) : (
          <button key={q} className="qchip" disabled={!canExtract(s, id, q).ok} onClick={() => act((st) => queueExtraction(st, id, q))}
            title={canExtract(s, id, q).why ?? `Ekstrahuj: +${genomeGain(id, q, m).map((x) => Math.round(x)).join('–')}% genomu, ${fmtTime(extractDuration(id, q, m))}`}>
            <i style={{ background: QUALITY_COLORS[q] }} />{QUALITY_NAMES[q]} ×{f[q]}<small>+{Math.round(genomeGain(id, q, m)[1])}%</small>
          </button>
        )
      ))}
    </div>
  );
}

function SpeciesRow({ s, id, m, children }: { s: GameState; id: number; m: Mods; children?: React.ReactNode }) {
  const act = useStore((x) => x.act);
  const openGenus = useStore((x) => x.openGenus);
  const g = GENERA.get(id)!;
  return (
    <div className="lab-row">
      <button className="lab-pic" onClick={() => openGenus(id)} title="Karta gatunku"><FitSprite genusId={id} w={70} h={44} silhouette={!s.hatched[id]} /></button>
      <div className="col" style={{ gap: 5, flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}><b className="nm">{g.name}</b><RarityTag r={g.rarity} />{s.hatched[id] ? <span className="small muted">w parku: {s.hatched[id]}</span> : null}<span className="spacer" /><b className="small">{Math.floor(genome(s, id))}%</b></div>
        <GenomeBar value={genome(s, id)} thin />
        <FossilChips s={s} id={id} m={m} act={act} />
      </div>
      {children}
    </div>
  );
}

function Extraction({ s }: { s: GameState }) {
  const act = useStore((x) => x.act);
  const [filter, setFilter] = useState<XFilter>('all');
  const m = mods(s);
  const ids = Object.keys(s.fossils).map(Number).filter((id) => fossilCount(s, id) > 0 && GENERA.has(id));
  const ready = ids.filter((id) => isGateOpen(s, id) && genome(s, id) < 100).sort((a, b) => genome(s, b) - genome(s, a));
  const gated = ids.filter((id) => !isGateOpen(s, id));
  const full = ids.filter((id) => genome(s, id) >= 100);
  const rare = (id: number) => (GENERA.get(id)?.rarity ?? 0) >= 1;
  // species waiting for research, grouped by the branch that unlocks them (cheapest first)
  const groups = useMemo(() => {
    const by = new Map<number, number[]>();
    for (const id of gated) { const k = gateOf(id); by.set(k, [...(by.get(k) ?? []), id]); }
    return [...by.entries()].map(([gate, list]) => ({ gate, list, cost: cladeCost(gate) })).sort((a, b) => a.cost - b.cost);
  }, [gated.join(',')]);
  const show = (id: number) => filter === 'all' || (filter === 'rare' && rare(id));
  const queued = s.labQueue.length;
  return (
    <div className="lab-body">
      <section className="panel lab-main">
        <div className="row" style={{ gap: 6 }}>
          {([['all', 'Wszystkie'], ['ready', `Gotowe · ${ready.length}`], ['gated', `Do badań · ${gated.length}`], ['rare', 'Rzadkie']] as const).map(([id, label]) => (
            <Btn key={id} small on={filter === id} onClick={() => setFilter(id)}>{label}</Btn>
          ))}
          <span className="spacer" />
          <span className="small muted">masz <b style={{ color: 'var(--blue)' }}>{fmt(s.pb)}</b> <Microscope className="ic" style={{ width: 13, height: 13, verticalAlign: -2, color: 'var(--blue)' }} /></span>
        </div>
        {ids.length === 0 && <Empty>Brak kości. Kop na stanowiskach — każda kość to porcja DNA.</Empty>}
        {filter !== 'gated' && ready.filter(show).length > 0 && (
          <>
            <span className="lbl">Gotowe do ekstrakcji · {ready.filter(show).length}</span>
            <div className="col" style={{ gap: 8 }}>
              {ready.filter(show).map((id) => (
                <SpeciesRow key={id} s={s} id={id} m={m}>
                  <Btn kind="primary" onClick={() => { act((st) => queueAll(st, id)); sfx.click(); }}><Dna className="ic" />Ekstrahuj</Btn>
                </SpeciesRow>
              ))}
            </div>
          </>
        )}
        {filter !== 'ready' && groups.some((gr) => gr.list.some(show)) && (
          <>
            <span className="lbl" style={{ marginTop: 6 }}>Czekają na badania · {gated.length} {plural(gated.length, 'gatunek', 'gatunki', 'gatunków')} w {groups.length} {plural(groups.length, 'grupie', 'grupach', 'grupach')}</span>
            {groups.filter((gr) => gr.list.some(show)).map((gr) => {
              const c = CLADES.get(gr.gate)!;
              const can = canResearchClade(s, gr.gate);
              return (
                <div key={gr.gate} className="lab-group">
                  <div className="row lab-group-head">
                    <Microscope className="ic" style={{ color: 'var(--blue)' }} />
                    <span className="col" style={{ gap: 0, flex: 1 }}>
                      <b>Badanie „{c.namePl ?? c.name}”</b>
                      <span className="small muted">odblokuje {gr.list.length} {plural(gr.list.length, 'gatunek', 'gatunki', 'gatunków')} z Twoich kości{c.namePl ? ` · ${c.name}` : ''}</span>
                    </span>
                    <Btn kind="gold" disabled={!can.ok} why={can.why} onClick={() => act((st) => researchClade(st, gr.gate))}>{fmt(gr.cost)} PB</Btn>
                  </div>
                  {gr.list.filter(show).map((id) => <SpeciesRow key={id} s={s} id={id} m={m} />)}
                </div>
              );
            })}
          </>
        )}
        {filter === 'all' && full.length > 0 && (
          <>
            <span className="lbl" style={{ marginTop: 6 }}>Pełny genom · nadmiarowe kości do muzeum</span>
            <div className="col" style={{ gap: 8 }}>{full.map((id) => <SpeciesRow key={id} s={s} id={id} m={m} />)}</div>
          </>
        )}
      </section>
      <aside className="panel lab-side">
        <span className="lbl">Stanowiska ekstrakcji · {m.labSlots}</span>
        {Array.from({ length: m.labSlots }, (_, k) => {
          const j = s.labActive[k];
          if (!j) return <div key={k} className="station empty"><Dna className="ic" /><span><b>Pusto</b><small>kliknij „Ekstrahuj” przy gatunku</small></span></div>;
          const g = GENERA.get(j.genusId)!;
          return (
            <div key={k} className="station">
              <div className="dna-spin"><Dna className="ic" /></div>
              <span className="col" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                <b className="nm">{g.name}</b>
                <small className="muted">{QUALITY_NAMES[j.quality].toLowerCase()} · +{Math.round(genomeGain(j.genusId, j.quality, m)[0])}–{Math.round(genomeGain(j.genusId, j.quality, m)[1])}% genomu</small>
                <div className="gbar thin"><div style={{ width: `${(j.t / j.dur) * 100}%`, background: 'var(--blue)' }} /></div>
              </span>
              <small className="muted">{fmtTime(j.dur - j.t)}</small>
            </div>
          );
        })}
        <span className="small muted">Więcej stanowisk: Sekwenator DNA (co 4 poziomy) w zakładce Stacje{s.tech.gen2 ? '' : ' i badanie „Sekwencjonowanie równoległe”'}.</span>
        <div className="sep" />
        <div className="row"><span className="lbl">Kolejka · {queued}</span><span className="spacer" /></div>
        <div className="col" style={{ gap: 4 }}>
          {s.labQueue.slice(0, 6).map((j, k) => <span key={k} className="small"><Bone className="ic" style={{ width: 12, height: 12, verticalAlign: -2, color: QUALITY_COLORS[j.quality] }} /> {GENERA.get(j.genusId)?.name} <span className="muted">· {QUALITY_NAMES[j.quality].toLowerCase()}</span></span>)}
          {queued > 6 && <span className="small muted">…i {queued - 6} więcej</span>}
          {!queued && <span className="small muted">Pusta.</span>}
        </div>
        <Btn big kind="primary" disabled={!ready.length} why="Brak kości gotowych do ekstrakcji" onClick={() => act((st) => { for (const id of ready) queueAll(st, id); })}><Dna className="ic" />Ekstrahuj wszystko gotowe</Btn>
        <div className="lab-help">
          <b>Jak to działa</b>
          <span>Kość daje porcję genomu: fragment najmniej, częściowa więcej, kompletna najwięcej (rzadsze gatunki mniej). Od <b>50%</b> gatunek trafia do Wylęgarni. Gatunek z nowej gałęzi drzewa trzeba najpierw <b>zbadać</b> za punkty badań.</span>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- tab 2: hatchery

function Egg3({ rarity, progress, size = 64 }: { rarity: number; progress: number; size?: number }) {
  const c = RARITY_COLORS[rarity];
  return (
    <span className={`egg ${progress > 0.85 ? 'wobble' : ''}`} style={{ width: size, height: size * 1.25, ['--c' as string]: c }}>
      <span className="egg-shell" />
      {progress > 0.55 && <span className="egg-crack c1" />}
      {progress > 0.8 && <span className="egg-crack c2" />}
    </span>
  );
}

function SpeciesPath({ s, id, m }: { s: GameState; id: number; m: Mods }) {
  const g = GENERA.get(id)!;
  const f = s.fossils[id] ?? [0, 0, 0];
  const gen = genome(s, id);
  const c = canSynthesize(s, id, m);
  const inPark = s.animals.filter((a) => a.genusId === id).length;
  const sites = g.sites.map((sid) => SITE_BY_ID.get(sid)?.name).filter(Boolean).join(', ');
  const steps = [
    { icon: Bone, title: 'Kości znalezione', text: `${f.map((n, q) => (n ? `${QUALITY_NAMES[q].toLowerCase()} ×${n}` : '')).filter(Boolean).join(', ') || 'zużyte w laboratorium'}${sites ? ` · ${sites}` : ''}`, done: true },
    { icon: Dna, title: 'Ekstrakcja', text: `genom ${Math.floor(gen)}%${gen < 100 ? ' — każda kolejna kość dodaje więcej' : ' — kompletny'}`, done: gen >= 50 },
    { icon: Egg, title: 'Wylęg', text: `możliwy od 50% · szansa ${Math.round(c.chance * 100)}% · ${fmtTime(c.time)} · ${fmt(c.cost)} monet`, done: !!s.hatched[id] },
    { icon: Home, title: 'Park', text: `${SIZE_NAMES[g.size]} · ${SIZE_SLOTS[g.size]} ${plural(SIZE_SLOTS[g.size], 'miejsce', 'miejsca', 'miejsc')} · ${HABITAT_NAMES[g.habitat].toLowerCase()} · w parku: ${inPark}`, done: inPark > 0 },
  ];
  return (
    <div className="species-path">
      <span className="lbl">Droga gatunku</span>
      {steps.map((st, k) => (
        <div key={k} className={`sp-step ${st.done ? 'done' : ''}`}>
          <span className="sp-dot">{st.done ? <Check className="ic" /> : <st.icon className="ic" />}</span>
          <span className="col" style={{ gap: 0 }}><b>{st.title}</b><small>{st.text}</small></span>
        </div>
      ))}
    </div>
  );
}

function HatchCard({ s, id, m }: { s: GameState; id: number; m: Mods }) {
  const act = useStore((x) => x.act);
  const toast = useStore((x) => x.toast);
  const setTab = useStore((x) => x.setTab);
  const g = GENERA.get(id)!;
  const c = canSynthesize(s, id, m);
  const gen = genome(s, id);
  const dest = destinationFor(s, id);
  const inPark = s.animals.filter((a) => a.genusId === id).length;
  const habitatName = ENCLOSURE_NAMES[g.habitat];
  return (
    <div className="hatch-card">
      <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'nowrap' }}>
        <div className="hc-pic"><FitSprite genusId={id} w={176} h={100} silhouette={!s.hatched[id]} animate /></div>
        <div className="col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><span className="hc-name">{g.name}</span><RarityTag r={g.rarity} />{!s.hatched[id] && <span className="tag" style={{ color: '#8ccf6e' }}>NOWY GATUNEK</span>}</div>
          <span className="small muted">{SIZE_NAMES[g.size]} · zajmuje {SIZE_SLOTS[g.size]} {plural(SIZE_SLOTS[g.size], 'miejsce', 'miejsca', 'miejsc')} · w parku: {inPark}</span>
          <GenomeBar value={gen} />
          <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>genom {Math.floor(gen)}%</span><span>50% = można wylęgać · 100% = pewny sukces</span></div>
        </div>
      </div>
      <div className="hc-tiles">
        <div><b style={{ color: 'var(--accent)' }}>{Math.round(c.chance * 100)}%</b><span>szansa udanego wylęgu</span></div>
        <div><b>{fmtTime(c.time)}</b><span>czas inkubacji</span></div>
        <div><b>{SIZE_SLOTS[g.size]}</b><span>miejsca na wybiegu</span></div>
      </div>
      <div className="hc-dest">
        <Home className="ic" />
        {dest ? <span>Trafi do: <b>{dest.label}</b> <span className="muted">· wolne {dest.free} / {dest.slots} miejsc</span></span>
          : <span>Brak wolnej zagrody ({habitatName.toLowerCase()}) — zwierzę poczeka w Transporterze.</span>}
        {!dest && <Btn small onClick={() => { setTab('park'); const p = usePark.getState(); p.setBuild(true); p.setCat('enclosure'); p.setTool({ kind: 'place', defId: enclosureDefId(g.habitat), rot: 0 }); }}>Postaw: {habitatName}</Btn>}
      </div>
      <Btn big kind="primary" disabled={!c.ok} why={c.why} onClick={() => { if (act((st) => synthesize(st, id))) sfx.click(); else toast(c.why ?? 'Nie można', 'bad'); }}>
        <Egg className="ic" />Syntezuj · {fmt(c.cost)} monet
      </Btn>
      {!c.ok && <span className="small muted" style={{ textAlign: 'center' }}>{c.why}</span>}
      <span className="small muted">Nieudany wylęg zwraca połowę kosztu — dlatego wyższy genom się opłaca.</span>
    </div>
  );
}

function Hatchery({ s }: { s: GameState }) {
  const [onlyNew, setOnlyNew] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const m = mods(s);
  let ready = Object.keys(s.genome).map(Number).filter((id) => genome(s, id) >= 50 && GENERA.has(id));
  if (onlyNew) ready = ready.filter((id) => !s.hatched[id]);
  ready.sort((a, b) => Number(!!s.hatched[a]) - Number(!!s.hatched[b]) || genome(s, b) - genome(s, a));
  const almost = Object.keys(s.genome).map(Number).filter((id) => genome(s, id) > 0 && genome(s, id) < 50 && GENERA.has(id)).sort((a, b) => genome(s, b) - genome(s, a)).slice(0, 8);
  const cur = sel !== null && ready.includes(sel) ? sel : ready[0];
  const next = BUILDING_BY_ID.hatchery;
  return (
    <div className="lab-body hatch">
      <section className="panel lab-list">
        <div className="row"><span className="lbl">Gotowe do wylęgu · {ready.length}</span><span className="spacer" /><Btn small on={onlyNew} onClick={() => setOnlyNew(!onlyNew)}>Tylko nowe</Btn></div>
        {ready.length === 0 && <Empty>Zsekwencjonuj co najmniej 50% genomu, by rozpocząć syntezę.</Empty>}
        <div className="col" style={{ gap: 6 }}>
          {ready.map((id) => {
            const g = GENERA.get(id)!;
            return (
              <button key={id} className={`pick ${cur === id ? 'on' : ''}`} onClick={() => setSel(id)}>
                <span className="pick-pic"><FitSprite genusId={id} w={58} h={36} silhouette={!s.hatched[id]} /></span>
                <span className="col" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                  <span className="row" style={{ gap: 6 }}><b className="nm">{g.name}</b>{!s.hatched[id] && <span className="tag" style={{ color: '#8ccf6e' }}>NOWY</span>}</span>
                  <GenomeBar value={genome(s, id)} thin />
                </span>
                <ChevronRight className="ic muted" />
              </button>
            );
          })}
        </div>
        {almost.length > 0 && (
          <>
            <span className="lbl" style={{ marginTop: 8 }}>Prawie gotowe</span>
            {almost.map((id) => (
              <div key={id} className="almost">
                <span className="pick-pic dim"><FitSprite genusId={id} w={58} h={36} silhouette /></span>
                <span className="nm small">{GENERA.get(id)!.name}</span>
                <span style={{ flex: 1 }}><GenomeBar value={genome(s, id)} thin /></span>
                <b className="small">{Math.floor(genome(s, id))}%</b>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="panel lab-detail">
        {cur !== undefined ? <><HatchCard s={s} id={cur} m={m} /><SpeciesPath s={s} id={cur} m={m} /></> : <Empty>Tu pojawi się karta gatunku gotowego do wylęgu.</Empty>}
      </section>
      <aside className="panel lab-side">
        <span className="lbl">Inkubatory · {s.incubating.length} / {m.incubSlots}</span>
        {Array.from({ length: m.incubSlots }, (_, k) => {
          const inc = s.incubating[k];
          if (!inc) return <div key={k} className="incubator empty"><Egg className="ic" /><span><b>Inkubator wolny</b><small>wybierz gatunek po lewej</small></span></div>;
          const g = GENERA.get(inc.genusId)!;
          const p = inc.t / inc.dur;
          return (
            <div key={k} className="incubator">
              <Egg3 rarity={g.rarity} progress={p} size={42} />
              <span className="col" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                <b className="nm">{g.name}</b>
                <small className="muted">{fmtTime(inc.dur - inc.t)} · szansa {Math.round(inc.chance * 100)}%</small>
                <div className="gbar thin"><div style={{ width: `${p * 100}%`, background: 'var(--accent)' }} /></div>
              </span>
            </div>
          );
        })}
        <span className="small muted">Kolejny inkubator co 5 poziomów {next.name} (zakładka Stacje).</span>
        <div className="lab-help">
          <b>Jak to działa</b>
          <span>Synteza kosztuje monety. Szansa udanego wylęgu to w przybliżeniu procent genomu (plus premie Wylęgarni). Pierwsze zwierzę w grze wykluwa się zawsze. Wyklute zwierzę samo idzie na wolny wybieg.</span>
        </div>
      </aside>
    </div>
  );
}

/** the hatching moment: shown when an animal hatches while you look at the lab */
function HatchMoment({ s, a, onClose }: { s: GameState; a: Animal; onClose: () => void }) {
  const setTab = useStore((x) => x.setTab);
  const g = GENERA.get(a.genusId)!;
  const first = s.hatched[a.genusId] === 1;
  const where = a.enc ? s.park.objects.find((o) => o.id === a.enc) : undefined;
  useEffect(() => { sfx.chestOpen(Math.min(2, g.rarity)); }, []);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal hatch-moment" onClick={(e) => e.stopPropagation()} style={{ ['--c' as string]: RARITY_COLORS[g.rarity] }}>
        <span className="lbl" style={{ color: 'var(--accent2)' }}><Sparkles className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Wykluł się!</span>
        <div className="hm-stage"><span className="hm-shell l" /><span className="hm-shell r" /><FitSprite genusId={a.genusId} w={300} h={136} animate max={8} /></div>
        <b className="hm-name">{g.name}</b>
        <span className="row" style={{ gap: 8, justifyContent: 'center' }}><RarityTag r={g.rarity} /><span className="small muted">{SIZE_NAMES[g.size]} · {SIZE_SLOTS[g.size]} {plural(SIZE_SLOTS[g.size], 'miejsce', 'miejsca', 'miejsc')}</span></span>
        <span className="small">{where ? <>Zamieszka: <b>{where ? ENCLOSURE_NAMES[GENERA.get(a.genusId)!.habitat] : ''}</b> · już tam jest</> : 'Czeka w Transporterze — postaw dla niego zagrodę w Parku.'}</span>
        {first && <span className="hm-first"><Check className="ic" /> Pierwszy okaz gatunku · +1 do kolekcji ({Object.keys(s.hatched).length} / {TAXA.genera.length})</span>}
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          <Btn kind="primary" onClick={() => { onClose(); setTab('park'); }}>Do parku <ArrowRight className="ic" /></Btn>
          <Btn onClick={onClose}>Dalej w laboratorium</Btn>
        </div>
      </div>
    </div>
  );
}

export function LabScreen() {
  const s = useGame();
  const [tab, setTab] = useState<'x' | 'h'>(() => (Object.values(s.genome).some((g) => g >= 50) && !Object.keys(s.fossils).some((id) => fossilCount(s, Number(id)) > 0) ? 'h' : 'x'));
  const m = mods(s);
  const ids = Object.keys(s.fossils).map(Number).filter((id) => fossilCount(s, id) > 0 && GENERA.has(id));
  const readyX = ids.filter((id) => isGateOpen(s, id) && genome(s, id) < 100).length;
  const gatedX = ids.filter((id) => !isGateOpen(s, id)).length;
  const readyH = Object.keys(s.genome).filter((id) => genome(s, Number(id)) >= 50).length;
  // hatching moment: a new animal appeared while the lab is open
  const lastUid = useRef(s.nextUid);
  const [born, setBorn] = useState<Animal | null>(null);
  useEffect(() => {
    if (s.nextUid > lastUid.current) {
      const a = s.animals.find((x) => x.uid === s.nextUid - 1);
      if (a && s.now - a.born < 5000) setBorn(a);
    }
    lastUid.current = s.nextUid;
  }, [s.nextUid]);
  return (
    <div className="lab">
      <div className="lab-tabs">
        <button className={tab === 'x' ? 'on' : ''} onClick={() => setTab('x')}>
          <FlaskConical className="ic" />
          <span><b>1 · Ekstrakcja DNA</b><small>kości → genom · {readyX} {plural(readyX, 'gotowa', 'gotowe', 'gotowych')}{gatedX ? `, ${gatedX} czeka na badania` : ''} · stanowiska {s.labActive.length}/{m.labSlots}</small></span>
        </button>
        <ChevronRight className="ic muted" />
        <button className={tab === 'h' ? 'on' : ''} onClick={() => setTab('h')}>
          <Egg className="ic" />
          <span><b>2 · Wylęgarnia</b><small>genom ≥ 50% → zwierzę · {readyH} {plural(readyH, 'gotowe', 'gotowe', 'gotowych')} · inkubatory {s.incubating.length}/{m.incubSlots}</small></span>
        </button>
        <span className="spacer" />
        <span className="small muted lab-flow"><Bone className="ic" /> kości <ArrowRight className="ic" /> <Dna className="ic" /> genom <ArrowRight className="ic" /> <Egg className="ic" /> jajo <ArrowRight className="ic" /> <Users className="ic" /> park · <Timer className="ic" /> działa też offline</span>
      </div>
      {tab === 'x' ? <Extraction s={s} /> : <Hatchery s={s} />}
      {born && <HatchMoment s={s} a={born} onClose={() => setBorn(null)} />}
    </div>
  );
}

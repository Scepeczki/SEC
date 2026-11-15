import { useState } from 'react';
import { CLADES, GENERA } from '../../data/db';
import { HABITAT_ICONS, QUALITY_NAMES, fmt, fmtTime } from '../../game/balance';
import { canExtract, canSynthesize, queueAll, queueExtraction, spaceFor, synthesize } from '../../game/lab';
import { SIZE_SLOTS } from '../../data/archetypes';
import { canResearchClade, cladeCost, gateOf, isGateOpen, researchClade } from '../../game/meta';
import { mods } from '../../game/mods';
import { donateFossil, donateValue } from '../../game/park';
import { SIZE_NAMES } from '../../game/balance';
import { ENCLOSURE_NAMES, enclosureDefId } from '../../game/parkContent';
import { usePark } from '../park/parkUi';
import type { GameState, Quality } from '../../game/state';
import { Bar, Btn, Empty, Rarity, SpriteImg } from '../components';
import { useGame, useStore } from '../store';

function GateButton({ s, genusId }: { s: GameState; genusId: number }) {
  const act = useStore((x) => x.act);
  const gate = gateOf(genusId);
  const c = CLADES.get(gate)!;
  const can = canResearchClade(s, gate);
  return (
    <Btn small kind="gold" onClick={() => act((st) => researchClade(st, gate))} disabled={!can.ok} why={can.why} title="Zbadaj gałąź drzewa życia, by móc sekwencjonować jej DNA">
      🔬 Zbadaj „{c.namePl ?? c.name}” ({fmt(cladeCost(gate))} PB)
    </Btn>
  );
}

function Extraction({ s }: { s: GameState }) {
  const act = useStore((x) => x.act);
  const openGenus = useStore((x) => x.openGenus);
  const m = mods(s);
  const ids = Object.keys(s.fossils).map(Number).filter((id) => s.fossils[id].some((n) => n > 0));
  const full = (id: number) => (s.genome[id] ?? 0) >= 100;
  ids.sort((a, b) => Number(full(a)) - Number(full(b)) || (s.genome[b] ?? 0) - (s.genome[a] ?? 0));
  return (
    <div className="panel col">
      <div className="row">
        <h2 style={{ margin: 0 }}>🧬 Ekstrakcja DNA</h2>
        <span className="muted small">stanowiska {s.labActive.length}/{m.labSlots} · w kolejce {s.labQueue.length}</span>
        <span className="spacer" />
        <Btn small onClick={() => act((st) => { for (const id of ids) if (isGateOpen(st, id)) queueAll(st, id); })} disabled={!ids.some((id) => isGateOpen(s, id))}>Ekstrahuj wszystko</Btn>
      </div>
      {s.labActive.map((j, i) => (
        <div key={i} className="row small">
          <span style={{ width: 160 }}>{GENERA.get(j.genusId)?.name} ({QUALITY_NAMES[j.quality].toLowerCase()})</span>
          <div style={{ flex: 1 }}><Bar value={j.t} max={j.dur} kind="blue" /></div>
          <span className="muted">{fmtTime(j.dur - j.t)}</span>
        </div>
      ))}
      <div className="sep" />
      {ids.length === 0 && <Empty>Brak skamieniałości. Kop na stanowiskach!</Empty>}
      <div className="list">
        {ids.map((id) => {
          const g = GENERA.get(id)!;
          const f = s.fossils[id];
          const gen = s.genome[id] ?? 0;
          const open = isGateOpen(s, id);
          return (
            <div key={id} className="item">
              <div className="sprite-box clickable" onClick={() => openGenus(id)}><SpriteImg genusId={id} scale={1} silhouette={!s.hatched[id]} /></div>
              <div className="col" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}><span className="name">{g.name}</span><Rarity r={g.rarity} /></div>
                <div className="row small" style={{ gap: 8 }}>
                  <span style={{ width: 110 }}>Genom {Math.floor(gen)}%</span>
                  <div style={{ flex: 1, minWidth: 80 }}><Bar value={gen} max={100} kind={gen >= 50 ? 'gold' : undefined} /></div>
                </div>
                <div className="row small" style={{ gap: 6 }}>
                  {full(id) && ([0, 1, 2] as Quality[]).map((q) => f[q] > 0 && (
                    <Btn key={'d' + q} small onClick={() => act((st) => donateFossil(st, id, q))} disabled={s.buildings.museum < 1} why="Zbuduj Muzeum (Stacje)" title={`Przekaż do muzeum: +${donateValue(id, q).coins} monet`}>🏛️ {QUALITY_NAMES[q]} ×{f[q]}</Btn>
                  ))}
                  {!full(id) && ([0, 1, 2] as Quality[]).map((q) => f[q] > 0 && (
                    <Btn key={q} small onClick={() => act((st) => queueExtraction(st, id, q))} disabled={!canExtract(s, id, q).ok} why={canExtract(s, id, q).why}>
                      {QUALITY_NAMES[q]} ×{f[q]}
                    </Btn>
                  ))}
                  {!open && <GateButton s={s} genusId={id} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hatchery({ s }: { s: GameState }) {
  const act = useStore((x) => x.act);
  const toast = useStore((x) => x.toast);
  const openGenus = useStore((x) => x.openGenus);
  const [onlyNew, setOnlyNew] = useState(false);
  const m = mods(s);
  let ids = Object.keys(s.genome).map(Number).filter((id) => (s.genome[id] ?? 0) >= 50);
  if (onlyNew) ids = ids.filter((id) => !s.hatched[id]);
  ids.sort((a, b) => (s.hatched[a] ? 1 : 0) - (s.hatched[b] ? 1 : 0) || GENERA.get(a)!.rarity - GENERA.get(b)!.rarity);
  return (
    <div className="panel col">
      <div className="row">
        <h2 style={{ margin: 0 }}>🥚 Wylęgarnia</h2>
        <span className="muted small">inkubatory {s.incubating.length}/{m.incubSlots}</span>
        <span className="spacer" />
        <Btn small on={onlyNew} onClick={() => setOnlyNew(!onlyNew)}>Tylko nowe</Btn>
      </div>
      {s.incubating.map((inc, i) => (
        <div key={i} className="row small">
          <span style={{ width: 160 }}>🥚 {GENERA.get(inc.genusId)?.name}</span>
          <div style={{ flex: 1 }}><Bar value={inc.t} max={inc.dur} kind="gold" /></div>
          <span className="muted">{Math.round(inc.chance * 100)}% · {fmtTime(inc.dur - inc.t)}</span>
        </div>
      ))}
      <div className="sep" />
      {ids.length === 0 && <Empty>Zsekwencjonuj co najmniej 50% genomu, by rozpocząć syntezę.</Empty>}
      <div className="list">
        {ids.map((id) => {
          const g = GENERA.get(id)!;
          const c = canSynthesize(s, id, m);
          const count = s.animals.filter((a) => a.genusId === id).length;
          return (
            <div key={id} className="item">
              <div className="sprite-box clickable" onClick={() => openGenus(id)}><SpriteImg genusId={id} scale={1} silhouette={!s.hatched[id]} /></div>
              <div className="col" style={{ gap: 3, flex: 1 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="name">{g.name}</span><Rarity r={g.rarity} />
                  {!s.hatched[id] && <span className="tag" style={{ color: '#8ccf6e' }}>NOWY</span>}
                  {count > 0 && <span className="small muted">w parku: {count}</span>}
                </div>
                <div className="small muted">{HABITAT_ICONS[g.habitat]} {SIZE_NAMES[g.size]}, zajmuje {SIZE_SLOTS[g.size]} {SIZE_SLOTS[g.size] === 1 ? 'miejsce' : 'miejsca'} · genom {Math.floor(s.genome[id])}% · szansa {Math.round(c.chance * 100)}% · {fmtTime(c.time)}</div>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <Btn kind="primary" onClick={() => { if (!act((st) => synthesize(st, id))) toast(c.why ?? 'Nie można', 'bad'); }} disabled={!c.ok} why={c.why}>Syntezuj 💰 {fmt(c.cost)}</Btn>
                {!c.ok && <span className="why">{c.why}</span>}
                <SpaceFix s={s} genusId={id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** no free pen right now: the newborn will wait in the Transporter — offer a shortcut to build one */
function SpaceFix({ s, genusId }: { s: GameState; genusId: number }) {
  const setTab = useStore((x) => x.setTab);
  const g = GENERA.get(genusId)!;
  const sp = spaceFor(s, genusId);
  if (sp.ok) return null;
  const name = ENCLOSURE_NAMES[g.habitat];
  return (
    <div className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
      <span className="small muted">{sp.enclosures ? `Brak wolnej zagrody (${name.toLowerCase()})` : `Nie masz jeszcze: ${name.toLowerCase()}`} — zwierzę poczeka w Transporterze.</span>
      <Btn small onClick={() => { setTab('park'); const p = usePark.getState(); p.setBuild(true); p.setCat('enclosure'); p.setTool({ kind: 'place', defId: enclosureDefId(g.habitat), rot: 0 }); }}>Postaw: {name}</Btn>
    </div>
  );
}

export function LabScreen() {
  const s = useGame();
  return (
    <div className="grid two">
      <Extraction s={s} />
      <Hatchery s={s} />
    </div>
  );
}

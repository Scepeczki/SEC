import { CLADES, GENERA, SITE_BY_ID, ancestorIds } from '../../data/db';
import { ARCHETYPE_BY_ID } from '../../data/archetypes';
import { formatMa, periodLabel } from '../../data/geotime';
import { FOOD_ICONS, FOOD_NAMES, HABITAT_ICONS, HABITAT_NAMES, SIZE_NAMES, fmt } from '../../game/balance';
import { gateOf } from '../../game/meta';
import { STAGE_NAMES } from '../../sprites/generator';
import { Bar, Rarity, SpriteImg } from '../components';
import { useGame, useStore } from '../store';

export function GenusModal({ id }: { id: number }) {
  const s = useGame();
  const setFocus = useStore((x) => x.setTreeFocus);
  const close = useStore((x) => x.closeModal);
  const g = GENERA.get(id)!;
  const known = s.settings.revealAll || !!s.discovered[id];
  const hatched = !!s.hatched[id];
  const best = hatched ? (s.bestStage[id] ?? 0) : -1;
  const lineage = ancestorIds(g.parent).map((cid) => CLADES.get(cid)!).filter((c) => c.namePl);
  const gate = CLADES.get(gateOf(id))!;
  if (!known) return <div><h2>???</h2><p className="muted">Nie znaleziono jeszcze żadnej skamieniałości tego zwierzęcia.</p></div>;
  return (
    <div className="col">
      <div className="row">
        <h2 style={{ margin: 0, fontSize: 24 }}><i>{g.name}</i></h2>
        <Rarity r={g.rarity} />
        {g.commonEn && <span className="muted">„{g.commonEn}”</span>}
      </div>
      <div className="stages">
        {STAGE_NAMES.map((name, st) => (
          <div className="stage" key={st}>
            <SpriteImg genusId={id} stage={st} scale={st === 0 ? 2 : 3} silhouette={st > best} animate={st <= best} />
            <span className="small" style={{ color: st <= best ? '#e9ecdf' : '#5d6657' }}>{name}</span>
          </div>
        ))}
      </div>
      <div className="grid two">
        <div className="facts small">
          <div>Okres</div><div>{periodLabel(g.fromMa, g.toMa)} ({formatMa(g.fromMa)} – {formatMa(g.toMa)} temu)</div>
          {g.earlyInterval && <><div>Piętra</div><div>{g.earlyInterval}{g.lateInterval ? ` – ${g.lateInterval}` : ''}</div></>}
          <div>Rodzina / rząd</div><div>{g.family ?? '—'} / {g.order ?? '—'}</div>
          <div>Budowa ciała</div><div>{ARCHETYPE_BY_ID[g.archetype]?.namePl}, {SIZE_NAMES[g.size]}</div>
          <div>Środowisko</div><div>{HABITAT_ICONS[g.habitat]} {HABITAT_NAMES[g.habitat]} {g.envRaw ? <span className="muted">({g.envRaw})</span> : null}</div>
          <div>Dieta</div><div>{FOOD_ICONS[g.food]} {FOOD_NAMES[g.food]} {g.dietRaw ? <span className="muted">({g.dietRaw})</span> : null}</div>
          <div>Znaleziska w PBDB</div><div>{g.occurrences} wystąpień</div>
          <div>Stanowiska w grze</div><div>{g.sites.length ? g.sites.map((sid) => SITE_BY_ID.get(sid)?.name).join(', ') : 'jeszcze niedostępne (przyszłe stanowiska / wyprawy)'}</div>
        </div>
        <div className="col small">
          <div>Genom: <b>{Math.floor(s.genome[id] ?? 0)}%</b></div>
          <Bar value={s.genome[id] ?? 0} max={100} kind="gold" />
          <div>Skamieniałości: {(s.fossils[id] ?? [0, 0, 0]).join(' / ')} (fragm. / częśc. / kompl.)</div>
          <div>W parku: {s.animals.filter((a) => a.genusId === id).length} · wyhodowano łącznie: {s.hatched[id] ?? 0}</div>
          <div>Gałąź badawcza: <b>{gate.namePl ?? gate.name}</b> {s.researchedClades[gate.id] ? '✔' : '— niezbadana'}</div>
          <div>
            <a href={`https://pl.wikipedia.org/wiki/${encodeURIComponent(g.name)}`} target="_blank" rel="noreferrer">Wikipedia (PL)</a>
            {' · '}
            <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(g.name)}`} target="_blank" rel="noreferrer">Wikipedia (EN)</a>
            {' · '}
            <a href={`https://paleobiodb.org/classic/checkTaxonInfo?taxon_no=${g.id}`} target="_blank" rel="noreferrer">PBDB</a>
          </div>
        </div>
      </div>
      <div>
        <div className="small muted">Linia ewolucyjna:</div>
        <div className="crumbs">
          {lineage.map((c, i) => (
            <span key={c.id}>
              {i > 0 && <span>›</span>}
              <button onClick={() => { close(); setFocus(c.id); }}>{c.namePl ?? c.name}</button>
            </span>
          ))}
        </div>
      </div>
      {s.settings.revealAll && <div className="small muted">PBDB id {g.id} · szablon {g.archetype} · {fmt(g.occurrences)} wystąpień</div>}
    </div>
  );
}

export function CladeModal({ id }: { id: number }) {
  const c = CLADES.get(id)!;
  return <div><h2>{c.namePl ?? c.name}</h2><p className="muted">{c.leafCount} rodzajów</p></div>;
}

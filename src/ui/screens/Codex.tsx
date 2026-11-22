// Encyclopedia: everything you have learned and collected, in one place.
//   Rozdziały — the story: prologue + one chapter per site, each with its living tree and replayable cut-scenes
//   Drzewo życia — the whole tree on the time axis
//   Pojęcia — concept cards explained from scratch
//   Minerały, Skały — collections (rock types you have dug into count too)

import { useState } from 'react';
import { BookOpen, Check, Film, Gem, GraduationCap, Layers, Lock, Network, ScrollText } from 'lucide-react';
import { SITE_BY_ID } from '../../data/db';
import { SITE_ORDER } from '../../data/epochs';
import { STORY, chapterTitle } from '../../data/story';
import { stageOfSite } from '../../data/story/tree';
import { SITE_UNLOCK } from '../../game/content';
import { COMMON_MINERALS, MINERALS, siteMinerals } from '../../game/geology';
import { RARITY_COLORS, RARITY_NAMES } from '../../game/balance';
import { chapterNo, chapterProgress, completion, rockFound, siteRocks } from '../../game/story';
import type { GameState } from '../../game/state';
import { iconUrl } from '../dig/art';
import { GeoAxis, LessonBtn } from '../Lesson';
import { ChapterTree } from '../story/ChapterTree';
import { useBeat } from '../story/Narrator';
import { useGame, useStore } from '../store';
import { TreeScreen } from './Tree';

function Chapters({ s }: { s: GameState }) {
  const openCutscene = useStore((x) => x.openCutscene);
  const [sel, setSel] = useState<string>(() => SITE_ORDER.filter((id) => s.unlockedSites[id]).pop() ?? SITE_ORDER[0]);
  const site = SITE_BY_ID.get(sel)!;
  const ch = STORY.chapters[sel];
  const open = !!s.unlockedSites[sel];
  const pr = chapterProgress(s, sel);
  const done = pr.done;
  return (
    <div className="codex-chapters">
      <div className="panel cx-list">
        <button className="cx-ch prologue" onClick={() => openCutscene('prologue')}>
          <span className="cx-no"><Film className="ic" /></span>
          <span className="col" style={{ gap: 0, minWidth: 0 }}><b>Prolog</b><small>Od powstania Ziemi do progu kambru · 4,6 mld – 539 mln lat temu</small></span>
        </button>
        {SITE_ORDER.map((id) => {
          const x = SITE_BY_ID.get(id)!;
          const o = !!s.unlockedSites[id];
          const p = chapterProgress(s, id);
          const full = p.done;
          return (
            <button key={id} className={`cx-ch ${sel === id ? 'sel' : ''} ${o ? '' : 'locked'} ${full ? 'done' : ''}`} onClick={() => setSel(id)}>
              <span className="cx-no">{full ? <Check className="ic" /> : chapterNo(id)}</span>
              <span className="col" style={{ gap: 0, minWidth: 0 }}>
                <b>{chapterTitle(id)}</b>
                <small>{x.name} · {x.period} · {Math.round(x.fromMa)} mln lat</small>
              </span>
              <span className="cx-prog">{o ? `${p.nativeFound}/${p.native}` : <Lock className="ic" />}</span>
            </button>
          );
        })}
      </div>
      <div className="panel cx-detail">
        <div className="col" style={{ gap: 2 }}>
          <span className="lbl">Rozdział {chapterNo(sel)} · {site.period} · {Math.round(site.fromMa)}–{Math.round(site.toMa) || '<1'} mln lat temu</span>
          <h2 style={{ margin: 0 }}>{chapterTitle(sel)}</h2>
          <span className="muted small">{site.name}, {site.country}</span>
        </div>
        <GeoAxis span={[site.fromMa, Math.max(site.toMa, site.fromMa - 6)]} marks={[{ ma: (site.fromMa + site.toMa) / 2, kind: 'now', text: site.name }]} />
        {open ? (
          <>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary" onClick={() => openCutscene(sel)}><Film className="ic" /> Obejrzyj rozdział</button>
              {done && (ch?.outro?.length || stageOfSite(sel)?.outro.length) ? <button className="btn" onClick={() => openCutscene(`${sel}:outro`)}><Film className="ic" /> Zakończenie</button> : null}
              <LessonBtn to={{ kind: 'site', id: sel }}>Pokaz stanowiska</LessonBtn>
            </div>
            <div className="col" style={{ gap: 6 }}>
              <span className="lbl"><Network className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Drzewo rozdziału · zwierzęta stanowiska {pr.nativeFound} z {pr.native}{pr.guests ? ` · goście epoki ${pr.guestsFound} z ${pr.guests}` : ''}</span>
              <ChapterTree s={s} siteId={sel} />
              {pr.guests > 0 && (
                <details className="cx-guests">
                  <summary><b>Goście epoki</b> · {pr.guestsFound} z {pr.guests} · dodatkowa kolekcja, rozdział zamyka się bez nich</summary>
                  <p className="muted small">Żyli w tym samym czasie i środowisku, ale ich skamieniałości pochodzą z innych miejsc. Stanowisko w grze reprezentuje całą epokę.</p>
                  <ChapterTree s={s} siteId={sel} part="guests" compact />
                </details>
              )}
            </div>
          </>
        ) : (
          <p className="muted">Ten rozdział otworzysz na mapie świata, gdy park osiągnie poziom {SITE_UNLOCK[sel]?.level}. Jego drzewo i przerywnik będą wtedy czekać tutaj.</p>
        )}
      </div>
    </div>
  );
}

function Concepts() {
  const [open, setOpen] = useState<string | null>(null);
  if (!STORY.concepts.length) return <div className="panel"><p className="muted">Karty pojęć są w przygotowaniu.</p></div>;
  return (
    <div className="cx-concepts">
      {STORY.concepts.map((c) => (
        <button key={c.id} className={`panel cx-concept ${open === c.id ? 'open' : ''}`} onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
          <b>{c.name}</b>
          <span className="cx-short">{c.short}</span>
          {open === c.id && <div className="cx-text">{c.text.map((p, i) => <p key={i}>{p}</p>)}</div>}
        </button>
      ))}
      {STORY.sources.length > 0 && (
        <details className="panel cx-sources">
          <summary>Źródła tekstów fabularnych ({STORY.sources.length})</summary>
          <ul>{STORY.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.title}</a>{x.used_for ? <small> · {x.used_for}</small> : null}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function Minerals({ s }: { s: GameState }) {
  const owned = s.minerals ?? {};
  const card = (id: string) => {
    const m = MINERALS.find((x) => x.id === id)!;
    const n = owned[id] ?? 0;
    return (
      <div key={id} className={`cx-min ${n ? 'have' : ''}`} style={n ? { borderColor: RARITY_COLORS[m.rarity] } : undefined} title={n ? `${m.name} · ${RARITY_NAMES[m.rarity]}${m.formula ? ` · ${m.formula}` : ''}\n${m.desc}` : 'Jeszcze nieznaleziony'}>
        <img className="pixel" src={iconUrl('mineral', id, 2)} width={32} height={32} alt="" style={n ? undefined : { filter: 'brightness(0.15)' }} />
        <span>{n ? m.name : '???'}</span>
      </div>
    );
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel col" style={{ gap: 8 }}>
        <b>Wszędzie · {COMMON_MINERALS.filter((m) => owned[m.id]).length}/{COMMON_MINERALS.length}</b>
        <div className="cx-mins">{COMMON_MINERALS.map((m) => card(m.id))}</div>
      </div>
      {SITE_ORDER.map((sid) => {
        const own = siteMinerals(sid).filter((m) => m.site === sid);
        if (!own.length) return null;
        return (
          <div key={sid} className={`panel col ${s.unlockedSites[sid] ? '' : 'cx-dim'}`} style={{ gap: 8 }}>
            <b>Rozdział {chapterNo(sid)} · {SITE_BY_ID.get(sid)!.name} · {own.filter((m) => owned[m.id]).length}/{own.length}</b>
            <div className="cx-mins">{own.map((m) => card(m.id))}</div>
          </div>
        );
      })}
    </div>
  );
}

function Rocks({ s }: { s: GameState }) {
  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="small muted" style={{ margin: 0 }}>Każde stanowisko to inny zestaw skał. Skała trafia do kolekcji, gdy dokopiesz się do jej pierwszej warstwy.</p>
      {SITE_ORDER.map((sid) => {
        const list = siteRocks(sid);
        const have = list.filter((r) => rockFound(s, r)).length;
        return (
          <div key={sid} className={`panel col ${s.unlockedSites[sid] ? '' : 'cx-dim'}`} style={{ gap: 8 }}>
            <b>Rozdział {chapterNo(sid)} · {SITE_BY_ID.get(sid)!.name} · {have}/{list.length}</b>
            <div className="cx-rocks">
              {list.map((r) => {
                const f = rockFound(s, r);
                return (
                  <div key={r.index} className={`cx-rock ${f ? 'have' : ''}`}>
                    <i style={{ background: f ? r.color : '#2a271e' }} />
                    <span className="col" style={{ gap: 0 }}><b>{f ? r.name : '???'}</b><small>{f ? r.desc : `od −${r.startDepth} warstwy`}</small></span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CodexScreen() {
  const s = useGame();
  const tab = useStore((x) => x.codexTab);
  const setTab = useStore((x) => x.setCodexTab);
  useBeat('codex');
  const c = completion(s);
  const tabs: [string, string, typeof BookOpen, string?][] = [
    ['chapters', 'Rozdziały', ScrollText],
    ['tree', 'Drzewo życia', Network, `${c.discovered}/${c.genera}`],
    ['concepts', 'Pojęcia', GraduationCap, STORY.concepts.length ? String(STORY.concepts.length) : undefined],
    ['minerals', 'Minerały', Gem, `${c.minerals}/${c.mineralsTotal}`],
    ['rocks', 'Skały', Layers, `${c.rocks}/${c.rocksTotal}`],
  ];
  return (
    <div className="col codex">
      <div className="panel codex-head">
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ margin: 0 }}><BookOpen className="ic" style={{ width: 22, height: 22, verticalAlign: -3 }} /> Encyklopedia</h2>
          <span className="small muted">Cel gry: przynajmniej jeden żywy przedstawiciel każdego rodzaju.</span>
        </div>
        <div className="codex-stats">
          <div title="Rodzaje, które masz w parku"><b style={{ color: 'var(--accent2)' }}>{c.hatched}</b><span>/ {c.genera} w parku</span></div>
          <div title="Rodzaje z pełnym genomem"><b style={{ color: 'var(--accent)' }}>{c.fullGenome}</b><span>pełny genom</span></div>
          <div><b style={{ color: 'var(--purple)' }}>{c.minerals}</b><span>/ {c.mineralsTotal} minerałów</span></div>
          <div><b style={{ color: '#c9b98a' }}>{c.rocks}</b><span>/ {c.rocksTotal} skał</span></div>
        </div>
      </div>
      <div className="seg-tabs codex-tabs" role="tablist">
        {tabs.map(([id, label, Icon, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon className="ic" /> {label}{n && <span className="n">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'chapters' && <Chapters s={s} />}
      {tab === 'tree' && <TreeScreen />}
      {tab === 'concepts' && <Concepts />}
      {tab === 'minerals' && <Minerals s={s} />}
      {tab === 'rocks' && <Rocks s={s} />}
    </div>
  );
}

// Story cut-scenes: full-screen slide shows. The prologue (from the forming Earth to the threshold of the Cambrian),
// a chapter intro for each dig site (time, world map, environment, who lived with whom, the chapter's tree) and its outro.

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Film, X } from 'lucide-react';
import { GENUS_BY_NAME, SITE_BY_ID } from '../../data/db';
import { EPOCHS } from '../../data/epochs';
import { STORY, chapterTitle, type StorySlide } from '../../data/story';
import { INTERLUDES, TRUNK, shortName, stageOfSite, spotlightGenera, type TreeCard, type TreeNode } from '../../data/story/tree';
import { Composition } from './Composition';
import { RichP } from './Rich';
import { chapterNo } from '../../game/story';
import type { GameState } from '../../game/state';
import { FitSprite } from '../components';
import { GeoAxis } from '../Lesson';
import { useGame, useStore } from '../store';
import { ChapterTree } from './ChapterTree';
import { DeepTimeBar, PROLOGUE_AT, Scene } from './Scenes';

interface Shot {
  title: string; text: ReactNode; art: ReactNode; facts?: string[]; top?: ReactNode;
  /** small line above the title (e.g. the trunk node the card belongs to) */
  kicker?: string;
  /** long shows (the prologue) are split into sections you can jump between */
  section?: string;
}

function Paras({ text }: { text: string[] }) {
  return <>{text.map((p, i) => <p key={i}>{p}</p>)}</>;
}

function Biocenosis({ s, siteId }: { s: GameState; siteId: string }) {
  const roles = STORY.chapters[siteId]?.biocenosis ?? [];
  return (
    <div className="bioc">
      {roles.map((r) => (
        <div key={r.role} className="bioc-role">
          <b>{r.role}</b>
          <div className="bioc-an">
            {r.genera.map((n) => GENUS_BY_NAME.get(n)).filter(Boolean).slice(0, 4).map((g) => {
              const k = s.settings.revealAll || !!s.discovered[g!.id];
              return <span key={g!.id} title={k ? g!.name : 'Jeszcze nieodkryte'}><FitSprite genusId={g!.id} w={56} h={30} silhouette={!k} max={3} title={k ? g!.name : 'Nieodkryte'} /><small>{k ? g!.name : '???'}</small></span>;
            })}
          </div>
          <small>{r.text}</small>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the prologue: the Earth, then the trunk of the tree

/** where each trunk node sits in deep time (Ma) and which illustration it borrows */
const TRUNK_AT: Record<string, [number, string]> = {
  LUCA: [3800, 'first-cells'], Archaea: [3500, 'first-cells'], Eukaryota: [1700, 'eukaryote'], Opisthokonta: [1100, 'eukaryote'],
  Choanozoa: [850, 'multicell'], Animalia: [600, 'ediacara'], Planulozoa: [570, 'ediacara'], Bilateria: [560, 'burrows'], Eubilateria: [545, 'burrows'],
};
const INTERLUDE_AT: Record<string, [number, string]> = {
  LUCA: [3480, 'stromatolites'], Archaea: [2400, 'oxygen'], Eukaryota: [1400, 'eukaryote'], Choanozoa: [680, 'snowball'], Animalia: [565, 'ediacara'], Eubilateria: [541, 'eyes'],
};
/** short labels of the prologue sections */
const SECTION: Record<string, string> = {
  LUCA: 'LUCA', Archaea: 'Archeony', Eukaryota: 'Eukarionty', Opisthokonta: 'Tylnowiciowce', Choanozoa: 'Kołnierzykowce',
  Animalia: 'Zwierzęta', Planulozoa: 'Parzydełkowce i reszta', Bilateria: 'Dwubocznie symetryczne', Eubilateria: 'Jelito na przelot',
};
const EARTH_SCENES = new Set(['planet-forming', 'impact', 'hadean', 'ocean']);

function TrunkBranches({ node }: { node: TreeNode }) {
  return (
    <div className="ls-branches cs-branches">
      {node.branches.map((b) => (
        <div key={b.id} className={`ls-branch ${/wymar/.test(b.fate) ? 'dead' : 'alive'}`}>
          <b>{shortName(b.namePl)}</b>
          <span>{b.trait}</span>
          <small>→ {b.became} · <i>{b.fate}</i></small>
        </div>
      ))}
    </div>
  );
}

function prologueShots(): Shot[] {
  // the Earth before life stays from the old prologue; the Librarian's trunk takes over from LUCA
  const shots: Shot[] = STORY.prologue.filter((sl) => EARTH_SCENES.has(sl.scene)).map((sl: StorySlide) => ({
    title: sl.title, text: <Paras text={sl.text} />, facts: sl.facts, section: 'Ziemia',
    art: <Scene id={sl.scene} siteId="chengjiang" />,
    top: <DeepTimeBar at={sl.at ?? PROLOGUE_AT[sl.scene]} />,
  }));
  for (const n of TRUNK) {
    const [at, scene] = TRUNK_AT[n.id] ?? [545, 'burrows'];
    const section = SECTION[n.id] ?? shortName(n.namePl);
    n.scene.forEach((c, k) => {
      shots.push({
        kicker: k === 0 ? `${n.namePl} · ${n.headline}` : n.namePl,
        title: c.title,
        text: <RichP text={c.text} />,
        art: c.kind === 'rozwidlenie' && n.branches.length ? <TrunkBranches node={n} /> : <Scene id={scene} siteId="chengjiang" />,
        top: <DeepTimeBar at={at} />,
        section,
      });
    });
    for (const it of INTERLUDES.filter((x) => x.after === n.id)) {
      const [iat, iscene] = INTERLUDE_AT[n.id] ?? [at, scene];
      shots.push({ kicker: 'Tymczasem na Ziemi', title: it.title, text: <RichP text={it.text} />, art: <Scene id={iscene} siteId="chengjiang" />, top: <DeepTimeBar at={iat} />, section });
    }
  }
  return shots;
}

function shotsFor(s: GameState, id: string): { kind: string; shots: Shot[] } {
  if (id === 'prologue') return { kind: 'Prolog', shots: prologueShots() };
  const [siteId, part] = id.split(':');
  const site = SITE_BY_ID.get(siteId);
  if (!site) return { kind: '', shots: [] };
  const ch = STORY.chapters[siteId];
  const no = chapterNo(siteId);
  const axis = <GeoAxis span={[site.fromMa, Math.max(site.toMa, site.fromMa - 6)]} marks={[{ ma: (site.fromMa + site.toMa) / 2, kind: 'now', text: site.name }]} />;
  const slide = (sl: StorySlide): Shot => ({
    title: sl.title, text: <Paras text={sl.text} />, facts: sl.facts, top: axis,
    art: sl.scene === 'foodweb' && ch?.biocenosis?.length ? <Biocenosis s={s} siteId={siteId} /> : sl.scene === 'tree' ? <div className="cs-tree"><ChapterTree s={s} siteId={siteId} /></div> : <Scene id={sl.scene} siteId={siteId} map={ch?.paleomap} />,
  });
  const stage = stageOfSite(siteId);
  const tree = <div className="cs-tree"><ChapterTree s={s} siteId={siteId} /></div>;
  const collage = (ids: number[]) => (
    <div className="cs-collage">{ids.slice(0, 6).map((gid) => { const k = s.settings.revealAll || !!s.discovered[gid]; return <FitSprite key={gid} genusId={gid} w={150} h={84} silhouette={!k} max={4} title={k ? undefined : 'Nieodkryte'} />; })}</div>
  );
  const fauna = [...site.fauna].sort((a, b) => b.occ - a.occ).map((f) => f.genusId);
  /** a Librarian card as a slide, with a picture that fits what the card talks about */
  const card = (c: TreeCard, k: number, outro = false): Shot => {
    let art: ReactNode;
    if (/czytać/i.test(c.title)) art = tree;
    else if (c.kind === 'rozwidlenie') art = <Composition s={s} siteId={siteId} />;
    else if (c.kind === 'swiat') art = ch?.paleomap ? <Scene id="worldmap" siteId={siteId} map={ch.paleomap} /> : <Scene id="seafloor" siteId={siteId} />;
    else if (c.kind === 'nowosc' && no === 1) art = <Scene id="explosion" siteId={siteId} />;
    else if (outro && c.kind === 'skutki') art = tree;
    else if (outro) art = <Scene id="next" siteId={siteId} />;
    else art = collage(k % 2 && stage?.spotlights.length ? spotlightGenera(stage) : fauna);
    return { title: c.title, text: <RichP text={c.text} />, art, top: axis };
  };
  if (part === 'outro') {
    const shots = stage?.outro.length ? stage.outro.map((c, k) => card(c, k, true)) : (ch?.outro ?? []).map(slide);
    return { kind: `Rozdział ${no} · zakończenie`, shots };
  }
  const ep = EPOCHS[siteId];
  const intro: Shot[] = stage?.intro.length
    ? [...stage.intro.map((c, k) => card(c, k)), ...(ch?.intro ?? []).filter((x) => x.scene === 'foodweb' && ch?.biocenosis?.length).map(slide)]
    : ch?.intro?.length
    ? ch.intro.map(slide)
    : [{ title: ep?.title ?? site.name, text: <><p>{ep?.story}</p><p className="muted">{site.description}</p></>, art: <Scene id="seafloor" siteId={siteId} />, top: axis }];
  // every chapter ends with its tree and the task
  if (!stage?.intro.some((c) => /czytać/i.test(c.title)) && !(!stage && ch?.intro?.some((x) => x.scene === 'tree'))) {
    intro.push({
      title: 'Drzewo tego rozdziału',
      text: <><p>To fragment drzewa życia, który odkryjesz na tym stanowisku. Na razie gałęzie są ciemne. Każde wykopane zwierzę zapala swoje rozwidlenia, a narrator powie, co się na nich pojawiło.</p><p className="muted">Drzewo rozdziału znajdziesz zawsze w Encyklopedii i w spisie przy wykopalisku.</p></>,
      art: <div className="cs-tree"><ChapterTree s={s} siteId={siteId} /></div>, top: axis,
    });
  }
  intro.push({
    title: 'Twoje zadanie',
    text: <><p>Na stanowisku <b>{site.name}</b> czeka {site.fauna.filter((f) => !f.guest).length} rodzajów zwierząt. Wykop je, odczytaj ich DNA i wykluj w parku.</p><p>Gdy znajdziesz wszystkie, rozdział się zamknie, a mapa poprowadzi Cię dalej w czasie.</p>{site.fauna.some((f) => f.guest) && <p className="muted">Do tego {site.fauna.filter((f) => f.guest).length} gości epoki: zwierzęta z tego samego czasu, których skamieniałości pochodzą z innych miejsc. To dodatkowa kolekcja.</p>}</>,
    art: <Scene id="seafloor" siteId={siteId} />, top: axis,
  });
  return { kind: `Rozdział ${no} · ${chapterTitle(siteId)}`, shots: intro };
}

export function CutsceneHost() {
  const s = useGame();
  const id = useStore((x) => x.cutscene);
  const open = useStore((x) => x.openCutscene);
  const act = useStore((x) => x.act);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [id]);
  const data = id ? shotsFor(s, id) : null;
  const n = data?.shots.length ?? 0;
  const close = () => {
    if (!id) return;
    act((g) => { g.story.seen[`cut:${id}`] = g.now; if (id === 'prologue') g.story.seen.prologue = g.now; });
    open(null);
  };
  useEffect(() => {
    if (!id) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(n - 1, v + 1));
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [id, n]);
  if (!id || !data || !n) return null;
  const cur = data.shots[Math.min(i, n - 1)];
  const sections = [...new Set(data.shots.map((x) => x.section).filter((x): x is string => !!x))];
  // with sections, the dots show only the current section's slides
  const inSec = cur.section ? data.shots.map((x, k) => [x, k] as const).filter(([x]) => x.section === cur.section) : data.shots.map((x, k) => [x, k] as const);
  return (
    <div className="cutscene" role="dialog" aria-label={data.kind}>
      <div className="cs-top">
        <span className="lbl"><Film className="ic" style={{ width: 14, height: 14, verticalAlign: -3 }} /> {data.kind}</span>
        <div className="cs-dots">{inSec.map(([x, k]) => <button key={k} className={k === i ? 'on' : k < i ? 'past' : ''} onClick={() => setI(k)} aria-label={`Slajd ${k + 1}: ${x.title}`} title={x.title} />)}</div>
        <button className="btn small" onClick={close}>Pomiń <X className="ic" /></button>
      </div>
      {sections.length > 1 && (
        <div className="cs-sections" role="tablist" aria-label="Części prologu">
          {sections.map((sec) => <button key={sec} role="tab" aria-selected={sec === cur.section} className={sec === cur.section ? 'on' : ''} onClick={() => setI(data.shots.findIndex((x) => x.section === sec))}>{sec}</button>)}
        </div>
      )}
      {cur.top && <div className="cs-time">{cur.top}</div>}
      <div className="cs-main" key={`${id}-${i}`}>
        <div className="cs-art">{cur.art}</div>
        <div className="cs-text">
          {cur.kicker && <span className="cs-kicker">{cur.kicker}</span>}
          <h1>{cur.title}</h1>
          {cur.text}
          {cur.facts?.length ? <ul className="cs-facts">{cur.facts.map((f) => <li key={f}>{f}</li>)}</ul> : null}
        </div>
      </div>
      <div className="cs-foot">
        <button className="btn" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><ChevronLeft className="ic" /> Wstecz</button>
        <span className="muted small">{i + 1} / {n} · strzałki ← → · Esc pomija</span>
        {i < n - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Dalej <ChevronRight className="ic" /></button> : <button className="btn primary" onClick={close}>Zakończ</button>}
      </div>
    </div>
  );
}

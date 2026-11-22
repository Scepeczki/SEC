// The narrator: a voice (not a character) in speech bubbles that leads the player through story mode.
// NarratorHost decides which beat is due (once each, remembered in s.story.seen) and shows the bubble.

import { useEffect, useState } from 'react';
import { ChevronRight, MessageSquareText, X } from 'lucide-react';
import { BEATS, chapterDoneBeat, type Beat } from '../../data/narration';
import { CLADES, SITE_BY_ID } from '../../data/db';
import { cladeLore } from '../../data/lore';
import { STORY } from '../../data/story';
import { stageOfSite, treeNode } from '../../data/story/tree';
import { EPOCHS, SITE_ORDER } from '../../data/epochs';
import { chapterNo, chapterProgress, freshForks } from '../../game/story';
import type { GameState } from '../../game/state';
import { useGame, useStore } from '../store';
import { nameOf } from '../treeData';

type B = Beat & { marks?: string[] };

const beat = (id: string): B => ({ id, ...BEATS[id] });

/** the next beat that is due regardless of the screen, or null */
function dueBeat(s: GameState, tab: string): B | null {
  const seen = s.story.seen;
  if (!seen.prologue) return null;
  if (!seen.welcome) return beat('welcome');
  if (!seen.bought_first && Object.keys(s.unlockedSites).length > 0) return beat('bought_first');
  if (tab === 'lab' && !seen.lab) return beat('lab');
  if (tab === 'tree' && !seen.codex) return beat('codex');
  if (!seen.first_find && Object.keys(s.discovered).length > 0) return beat('first_find');
  if (seen.first_find) {
    const fresh = freshForks(s);
    if (fresh.length) {
      const named = fresh.filter((f) => CLADES.get(f)?.namePl);
      const deep = named[named.length - 1] ?? fresh[fresh.length - 1];
      const name = (id: number) => nameOf(id);
      const lore = cladeLore(deep);
      const lit = treeNode(deep)?.narrator.lit;
      const lines = fresh.length > 2
        ? [`Zapaliło się ${fresh.length} rozwidleń drzewa życia: od „${name(fresh[0])}” aż po „${name(fresh[fresh.length - 1])}”.`, lit ? `Najnowsze z nich: ${lit}` : lore ? `Najnowsze z nich, „${name(deep)}”, wprowadza: ${lore.appeared}.` : 'Zajrzyj do drzewa rozdziału, żeby zobaczyć, co je łączy.']
        : [`Nowe rozwidlenie drzewa życia: „${name(deep)}”.`, lit ?? (lore ? `Co się tu pojawiło: ${lore.appeared}.` : 'Kliknij, żeby dowiedzieć się, co je wyróżnia.')];
      return { id: `forks:${deep}`, lines, marks: fresh.map((f) => `fork:${f}`), action: { kind: 'lesson-clade', id: deep, label: 'Wyjaśnij' } };
    }
  }
  for (const sid of SITE_ORDER) {
    if (!s.unlockedSites[sid] || seen[`done:${sid}`]) continue;
    const site = SITE_BY_ID.get(sid)!;
    if (chapterProgress(s, sid).done) {
      const ch = STORY.chapters[sid];
      const outro = !!ch?.outro?.length || !!stageOfSite(sid)?.outro.length;
      const b = chapterDoneBeat(chapterNo(sid), ch?.title ?? stageOfSite(sid)?.title ?? EPOCHS[sid]?.title ?? site.name, outro);
      return { id: `done:${sid}`, ...b, action: outro ? { kind: 'cutscene', id: `${sid}:outro`, label: 'Co było dalej' } : undefined };
    }
  }
  return null;
}

/** ask for a screen-specific beat (e.g. the first look at the map) */
export function useBeat(id: string, when = true) {
  const s = useGame();
  const cur = useStore((x) => x.beat);
  const show = useStore((x) => x.showBeat);
  useEffect(() => {
    if (!when || !s.story.on || !s.story.seen.prologue || !s.story.seen.welcome || s.story.seen[id] || cur) return;
    show(beat(id));
  }, [when, id, cur, s.story.on]);
}

export function NarratorHost() {
  const s = useGame();
  const rev = useStore((x) => x.rev);
  const tab = useStore((x) => x.tab);
  const cur = useStore((x) => x.beat);
  const show = useStore((x) => x.showBeat);
  const lesson = useStore((x) => x.lesson);
  const modal = useStore((x) => x.modal);
  const cutscene = useStore((x) => x.cutscene);
  const offline = useStore((x) => x.offline);
  const openCutscene = useStore((x) => x.openCutscene);
  const act = useStore((x) => x.act);
  const [i, setI] = useState(0);

  // the prologue opens by itself at the start of a story game
  useEffect(() => {
    if (s.story.on && !s.story.seen.prologue && !cutscene) openCutscene('prologue');
  }, [s.story.on]);

  useEffect(() => {
    if (cur || !s.story.on || cutscene || lesson || modal || offline) return;
    const b = dueBeat(s, tab);
    if (b) show(b);
  }, [rev, tab, cur, cutscene, lesson, modal, offline, s.story.on]);

  useEffect(() => setI(0), [cur?.id]);

  if (!cur || cutscene || lesson || offline) return null;
  const done = (then?: () => void) => {
    act((g) => { g.story.seen[cur.id] = g.now; for (const m of cur.marks ?? []) g.story.seen[m] = g.now; });
    show(null);
    then?.();
  };
  const last = i >= cur.lines.length - 1;
  const a = cur.action;
  const run = () => {
    if (!a) return done();
    const st = useStore.getState();
    if (a.kind === 'tab') done(() => st.setTab(a.tab));
    else if (a.kind === 'cutscene') done(() => st.openCutscene(a.id));
    else if (a.kind === 'codex') done(() => st.setCodexTab(a.tab));
    else done(() => st.openLesson({ kind: 'clade', id: a.id }));
  };
  return (
    <div className="narrator" role="status" aria-live="polite">
      <div className="narr-head">
        <MessageSquareText className="ic" />
        <span className="lbl">Narrator</span>
        {cur.lines.length > 1 && <span className="narr-n">{i + 1}/{cur.lines.length}</span>}
        <button className="iconbtn" aria-label="Zamknij" onClick={() => done()}><X className="ic" /></button>
      </div>
      <p key={i} className="narr-text">{cur.lines[i]}</p>
      <div className="narr-foot">
        <button className="narr-off" onClick={() => { act((g) => { g.story.on = false; }); show(null); }} title="Tryb bez fabuły: bez narratora i przerywników (włączysz go z powrotem w zakładce Inne)">wyłącz narrację</button>
        {!last
          ? <button className="btn small primary" onClick={() => setI(i + 1)}>Dalej <ChevronRight className="ic" /></button>
          : a ? <><button className="btn small" onClick={() => done()}>Później</button><button className="btn small primary" onClick={run}>{a.label}</button></>
            : <button className="btn small primary" onClick={() => done()}>Rozumiem</button>}
      </div>
    </div>
  );
}

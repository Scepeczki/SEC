// The living tree of one chapter: the fragment of the tree of life this site covers. A fork lights up when you dig up
// its first animal; until then it is a dim "?" — so the tree is explained as the animals come back to life.

import { Sparkles } from 'lucide-react';
import { GENERA } from '../../data/db';
import { cladeLore } from '../../data/lore';
import { treeNode } from '../../data/story/tree';
import { chapterTree, isLit, type ChapterNode, type ChapterPart } from '../../game/story';
import type { GameState } from '../../game/state';
import { FitSprite } from '../components';
import { useStore } from '../store';
import { nameOf } from '../treeData';

interface Row { node: ChapterNode; chain: number[]; depth: number }

/** collapse forks that only lead to one other fork (and hold no animals themselves) into one row */
function rows(root: ChapterNode): Row[] {
  const out: Row[] = [];
  const walk = (n: ChapterNode, depth: number) => {
    const chain = [n.id];
    let cur = n;
    while (depth > 0 && cur.kids.length === 1 && cur.genera.length === 0) { cur = cur.kids[0]; chain.push(cur.id); }
    out.push({ node: cur, chain, depth });
    cur.kids.forEach((k) => walk(k, depth + 1));
  };
  walk(root, 0);
  return out;
}

export function ChapterTree({ s, siteId, compact, part = 'native' }: { s: GameState; siteId: string; compact?: boolean; part?: ChapterPart }) {
  const openLesson = useStore((x) => x.openLesson);
  const root = chapterTree(siteId, part);
  const list = rows(root);
  const known = (id: number) => s.settings.revealAll || !!s.discovered[id];
  return (
    <div className={`ctree ${compact ? 'compact' : ''}`}>
      {list.map(({ node, chain, depth }) => {
        const lit = isLit(s, node.id);
        const found = node.all.filter(known).length;
        const lore = cladeLore(node.id);
        const tn = treeNode(node.id);
        const names = chain.map((id) => (isLit(s, id) ? nameOf(id) : '?'));
        return (
          <div key={node.id} className={`ct-row ${lit ? 'lit' : 'dark'}`} style={{ ['--d' as string]: depth }}>
            <span className="ct-guides" aria-hidden="true">{Array.from({ length: depth }, (_, i) => <i key={i} />)}</span>
            <button className="ct-fork" disabled={!lit} onClick={() => openLesson({ kind: 'clade', id: node.id })} title={lit ? 'Lekcja o tym rozwidleniu' : 'Gałąź zapali się, gdy wykopiesz jej pierwsze zwierzę'}>
              <span className="ct-dot" />
              <span className="ct-body">
                <b>{lit ? names.join(' › ') : 'Nieodkryta gałąź'}</b>
                {!compact && (lit ? (tn ? <small>{tn.headline}</small> : lore && <small>{lore.appeared}</small>) : tn && <small className="ct-teaser">{tn.narrator.teaser}</small>)}
              </span>
              <span className="ct-n">{found}/{node.all.length}</span>
            </button>
            {node.genera.length > 0 && (
              <div className="ct-animals">
                {node.genera.map((id) => {
                  const k = known(id);
                  return (
                    <button key={id} className={`ct-an ${k ? 'k' : ''}`} disabled={!k} onClick={() => openLesson({ kind: 'genus', id })} title={k ? `${GENERA.get(id)!.name}: lekcja` : 'Jeszcze nieodkryte'}>
                      <FitSprite genusId={id} w={compact ? 34 : 44} h={compact ? 20 : 26} silhouette={!k} max={2} title={k ? GENERA.get(id)!.name : 'Nieodkryte'} />
                      {k && <i className={`ct-gen ${s.hatched[id] ? 'park' : ''}`} title={`genom ${Math.floor(s.genome[id] ?? 0)}%${s.hatched[id] ? ' · w parku' : ''}`}><em style={{ width: `${Math.min(100, s.genome[id] ?? 0)}%` }} /></i>}
                      {!compact && <small>{k ? GENERA.get(id)!.name : '???'}</small>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!compact && <div className="ct-hint small muted"><Sparkles className="ic" /> Rozwidlenia zapalają się, gdy wykopiesz ich pierwsze zwierzę. Kliknij zapalone, żeby poznać jego historię.</div>}
    </div>
  );
}

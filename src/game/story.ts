// Story mode logic: chapters (one per dig site, oldest first), the living tree of a chapter (forks light up when you
// dig up their first member), rock types you have reached, and collection completion.

import { CLADES, GENERA, SITE_BY_ID, SITES, TAXA, ancestorIds } from '../data/db';
import { CLADE_LORE } from '../data/lore';
import { SITE_ORDER } from '../data/epochs';
import { TREE_NODES, routeIndex } from '../data/story/tree';
import { MINERALS, STRATA } from './geology';
import type { GameState } from './state';

export const chapterNo = (siteId: string) => SITE_ORDER.indexOf(siteId) + 1;

// ---------------------------------------------------------------- living tree of a chapter

export interface ChapterNode {
  id: number;
  depth: number;
  kids: ChapterNode[];
  /** genera of this site sitting directly under this fork (not under a deeper shown fork) */
  genera: number[];
  /** all site genera below */
  all: number[];
}

/** forks worth showing in a chapter: the ones with a Polish name or a written explanation (old lore or the Librarian's walk) */
const shown = (id: number) => { const c = CLADES.get(id); return !!c && (((!!c.namePl || !!CLADE_LORE[c.name]) && c.leafCount >= 2) || TREE_NODES.has(c.name)); };

const treeCache = new Map<string, ChapterNode>();
/** the fragment of the tree of life this site covers, from „Zwierzęta” down to its animals */
export type ChapterPart = 'native' | 'guests';
/** the site's own animals, or its guests of the epoch */
export function chapterTree(siteId: string, part: ChapterPart = 'native'): ChapterNode {
  const cacheKey = `${siteId}:${part}`;
  const hit = treeCache.get(cacheKey);
  if (hit) return hit;
  const site = SITE_BY_ID.get(siteId);
  const root: ChapterNode = { id: TAXA.rootId, depth: 0, kids: [], genera: [], all: [] };
  const byId = new Map<number, ChapterNode>([[root.id, root]]);
  for (const f of site?.fauna ?? []) {
    if (!!f.guest !== (part === 'guests')) continue;
    const g = GENERA.get(f.genusId);
    if (!g) continue;
    let node = root;
    node.all.push(g.id);
    for (const cid of ancestorIds(g.parent)) {
      if (cid === TAXA.rootId || !shown(cid)) continue;
      let n = byId.get(cid);
      if (!n) { n = { id: cid, depth: node.depth + 1, kids: [], genera: [], all: [] }; byId.set(cid, n); node.kids.push(n); }
      n.all.push(g.id);
      node = n;
    }
    node.genera.push(g.id);
  }
  // a fork with a single shown child and no own genera says nothing new on its own: keep it (it is a step of the
  // story), but order children by how many animals they hold
  // children follow the Librarian's walk where there is one (main branch first), else the biggest first
  const key = (n: ChapterNode) => routeIndex(CLADES.get(n.id)!.name);
  const sort = (n: ChapterNode) => { n.kids.sort((a, b) => key(a) - key(b) || b.all.length - a.all.length); n.kids.forEach(sort); };
  sort(root);
  treeCache.set(cacheKey, root);
  return root;
}

export function flatten(n: ChapterNode): ChapterNode[] {
  return [n, ...n.kids.flatMap(flatten)];
}

/** a fork is lit once you have found any animal below it (anywhere) */
export function isLit(s: GameState, cladeId: number): boolean {
  if (s.settings.revealAll || cladeId === TAXA.rootId) return true;
  for (const id of Object.keys(s.discovered)) {
    const g = GENERA.get(Number(id));
    if (g && (g.parent === cladeId || ancestorIds(g.parent).includes(cladeId))) return true;
  }
  return false;
}

/** lit forks of all chapters you own that the narrator has not announced yet (deepest last) */
export function freshForks(s: GameState): number[] {
  const out = new Set<number>();
  const disc = Object.keys(s.discovered).map(Number);
  for (const id of disc) {
    const g = GENERA.get(id);
    if (!g) continue;
    for (const cid of ancestorIds(g.parent)) if (shown(cid) && !s.story.seen[`fork:${cid}`]) out.add(cid);
  }
  return [...out].sort((a, b) => ancestorIds(a).length - ancestorIds(b).length);
}

// ---------------------------------------------------------------- rocks

export interface RockRef { siteId: string; index: number; name: string; desc: string; color: string; startDepth: number }

export const ROCKS: RockRef[] = SITES.flatMap((site) => {
  const list = STRATA[site.id] ?? [];
  let d = 0;
  return list.map((r, index) => {
    const ref = { siteId: site.id, index, name: r.name, desc: r.desc, color: r.color, startDepth: d };
    d += r.layers >= 99 ? 10 : r.layers;
    return ref;
  });
});

/** you have seen a rock once you dug into its first layer */
export const rockFound = (s: GameState, r: RockRef) => !!s.unlockedSites[r.siteId] && (s.sites[r.siteId]?.depth ?? 0) >= r.startDepth;

export const siteRocks = (siteId: string) => ROCKS.filter((r) => r.siteId === siteId);

// ---------------------------------------------------------------- completion

export function completion(s: GameState) {
  const genera = TAXA.genera.length;
  const hatched = Object.keys(s.hatched).length;
  const discovered = Object.keys(s.discovered).length;
  const fullGenome = Object.values(s.genome).filter((v) => v >= 100).length;
  const minerals = MINERALS.filter((m) => s.minerals?.[m.id]).length;
  const rocks = ROCKS.filter((r) => rockFound(s, r)).length;
  return { genera, hatched, discovered, fullGenome, minerals, mineralsTotal: MINERALS.length, rocks, rocksTotal: ROCKS.length };
}

// ---------------------------------------------------------------- chapter progress

/**
 * A chapter closes when its own animals (found at this site in the real rocks) are discovered. Guests of the epoch
 * (lived at this time and in this environment, but their fossils come from elsewhere) are an extra collection
 * with their own counter, so the last finds of a big site do not drag on.
 */
export function chapterProgress(s: GameState, siteId: string) {
  const fauna = SITE_BY_ID.get(siteId)?.fauna ?? [];
  const native = fauna.filter((f) => !f.guest);
  const guests = fauna.filter((f) => f.guest);
  const found = (list: typeof fauna) => list.filter((f) => s.discovered[f.genusId]).length;
  const nativeFound = found(native), guestsFound = found(guests);
  return { native: native.length, nativeFound, guests: guests.length, guestsFound, done: native.length > 0 && nativeFound === native.length };
}

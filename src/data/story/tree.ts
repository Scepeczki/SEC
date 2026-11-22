// The Librarian's walk along the tree of life, stage by stage (src/data/story/tree/drzewo-etap-*.json).
// A stage = the animals that first appear in one window of time; stage N is told in chapter N (the N-th dig site).
// Each node is one fork of the tree, explained in a few cards (the world, the starting point, what is new, why it
// paid off, how it split, what it led to), with its branches, narrator lines, concepts and sources.

import { CLADES, GENUS_BY_NAME, TAXA } from '../db';
import { SITE_ORDER } from '../epochs';

export type CardKind = 'swiat' | 'punkt-wyjscia' | 'nowosc' | 'dlaczego' | 'rozwidlenie' | 'skutki';
export interface TreeCard { kind: CardKind; title: string; text: string; visual?: string }
export interface TreeSource { title: string; url?: string; claim?: string }
export interface TreeBranch { id: string; namePl: string; trait: string; became: string; fate: string }
export interface TreeNode {
  id: string;
  namePl: string;
  parent: string;
  size: 'duze' | 'male';
  when: { split?: string; firstFossils?: string; confidence?: string };
  headline: string;
  scene: TreeCard[];
  branches: TreeBranch[];
  narrator: { teaser: string; lit: string };
  concepts: string[];
  misconception?: string;
  sources: TreeSource[];
  /** stage number the node is told in */
  stage: number;
}
export interface Spotlight { genus: string; underNode: string; cards: TreeCard[]; sources: TreeSource[]; stage: number }
export interface StageVisual { id: string; kind: string; title: string; purpose: string; howTo?: string; data?: unknown }
export interface Stage {
  nr: number;
  id: string;
  /** the dig site whose chapter tells this stage */
  site: string;
  title: string;
  window: string;
  genera: number;
  mainBranch: string;
  route: string[];
  intro: TreeCard[];
  outro: TreeCard[];
  visuals: StageVisual[];
  spotlights: Spotlight[];
}
export interface TreeConcept { id: string; name: string; short: string; text: string[] }

interface Batch {
  stage: Partial<Stage> & { nr: number; id: string; spotlights?: Omit<Spotlight, 'stage'>[] };
  nodes: Omit<TreeNode, 'stage'>[];
  newConcepts: TreeConcept[];
}

// static imports (not import.meta.glob) so Node scripts can read the content too; add new stages here
import e01a from './tree/drzewo-etap-01a.json';
import e01b from './tree/drzewo-etap-01b.json';
import e02 from './tree/drzewo-etap-02.json';
import e03 from './tree/drzewo-etap-03.json';
import e04 from './tree/drzewo-etap-04.json';
import pien from './tree/drzewo-pien.json';
/**
 * The Librarian's stages are windows of time, not dig sites: a stage is told in the chapter of its main site.
 * Later stages name it themselves (stage.site); these are the first ones, written before that field existed.
 */
const STAGE_SITE: Record<number, string> = { 1: 'chengjiang', 2: 'burgess', 3: 'fezouata' };
const files: Record<string, Batch> = { e01a, e01b, e02, e03, e04 } as unknown as Record<string, Batch>;

export const STAGES: Stage[] = [];
export const TREE_NODES = new Map<string, TreeNode>();
export const SPOTLIGHTS = new Map<string, Spotlight>();
export const TREE_CONCEPTS: TreeConcept[] = [];

for (const key of Object.keys(files).sort()) {
  const b = files[key];
  const st = b.stage;
  let stage = STAGES.find((x) => x.id === st.id);
  if (!stage) {
    stage = { nr: st.nr, id: st.id, site: (st as { site?: string }).site ?? STAGE_SITE[st.nr] ?? SITE_ORDER[st.nr - 1], title: '', window: '', genera: 0, mainBranch: '', route: [], intro: [], outro: [], visuals: [], spotlights: [] };
    STAGES.push(stage);
  }
  // a stage may come in several parts (etap-01a, etap-01b): later parts add to the first
  if (st.title) stage.title = st.title;
  if (st.window) stage.window = st.window;
  if (st.genera) stage.genera = st.genera;
  if (st.mainBranch) stage.mainBranch = st.mainBranch;
  if (st.route?.length) stage.route = st.route;
  stage.intro.push(...(st.intro ?? []));
  stage.outro.push(...(st.outro ?? []));
  stage.visuals.push(...(st.visuals ?? []));
  for (const sp of st.spotlights ?? []) {
    const s = { ...sp, stage: st.nr };
    stage.spotlights.push(s);
    SPOTLIGHTS.set(sp.genus, s);
  }
  for (const n of b.nodes) TREE_NODES.set(n.id, { ...n, stage: st.nr });
  for (const c of b.newConcepts) if (!TREE_CONCEPTS.some((x) => x.id === c.id)) TREE_CONCEPTS.push(c);
}
STAGES.sort((a, b) => a.nr - b.nr);

// ---------------------------------------------------------------- the trunk: from LUCA to the threshold of the Cambrian
// Told in the prologue. Its nodes outside the game tree (LUCA, Archaea, Eukaryota…) live only there; the ones in the
// game (Animalia, Bilateria, Eubilateria) also get their lessons from here (stage 0).

export interface Interlude { after: string; title: string; text: string; visual?: string }
const trunkBatch = pien as unknown as { trunk: string[]; interludes: Interlude[]; nodes: Omit<TreeNode, 'stage'>[]; newConcepts: TreeConcept[] };
export const TRUNK: TreeNode[] = trunkBatch.trunk.map((id) => ({ ...trunkBatch.nodes.find((n) => n.id === id)!, stage: 0 }));
export const INTERLUDES: Interlude[] = trunkBatch.interludes;
for (const n of TRUNK) TREE_NODES.set(n.id, n);
for (const c of trunkBatch.newConcepts) if (!TREE_CONCEPTS.some((x) => x.id === c.id)) TREE_CONCEPTS.push(c);

/** the Librarian's text for a fork, by clade id */
export const treeNode = (cladeId: number): TreeNode | undefined => {
  const c = CLADES.get(cladeId);
  return c ? TREE_NODES.get(c.name) : undefined;
};

/** the stage a site's chapter tells, if the Librarian has written it */
export const stageOfSite = (siteId: string): Stage | undefined => STAGES.find((s) => s.site === siteId);

/** a Polish name without the explanation in brackets: „Libristoma (trylobity …)” → „Libristoma” */
export const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** where a node sits on its stage's walk (unknown = at the end) */
export function routeIndex(name: string): number {
  const n = TREE_NODES.get(name);
  const st = n && STAGES.find((s) => s.nr === n.stage);
  const i = st ? st.route.indexOf(name) : -1;
  return i < 0 ? 999 : (n?.stage ?? 0) * 1000 + i;
}

/** spotlight cards of a genus */
export const spotlightOf = (genusName: string) => SPOTLIGHTS.get(genusName);

/** genus ids of a stage's spotlights that exist in the game */
export const spotlightGenera = (st: Stage) => st.spotlights.map((s) => GENUS_BY_NAME.get(s.genus)?.id).filter((x): x is number => x != null);

/** clade id by Latin name (for the Librarian's branch lists) */
export const CLADE_ID_BY_NAME = new Map(TAXA.clades.map((c) => [c.name, c.id]));

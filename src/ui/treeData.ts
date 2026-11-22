// Shared helpers for everything that draws the tree of life on a time axis (tree screen, lessons).

import { CLADES, GENERA, SITES, SUBTREE_GENERA, TAXA, ancestorIds } from '../data/db';
import { PERIODS } from '../data/geotime';
import { SITE_ORDER } from '../data/epochs';
import type { CladeNode } from '../data/types';
import { TREE_NODES, shortName } from '../data/story/tree';
import type { GameState } from '../game/state';

/** first appearance of a lineage in the fossil record (oldest genus in its subtree) and its last appearance */
export const ORIGIN = new Map<number, number>();
export const LAST = new Map<number, number>();
for (const c of TAXA.clades) {
  const gs = SUBTREE_GENERA.get(c.id) ?? [];
  ORIGIN.set(c.id, Math.max(0, ...gs.map((g) => GENERA.get(g)!.fromMa)));
  LAST.set(c.id, Math.min(...gs.map((g) => GENERA.get(g)!.toMa), 999));
}
for (const g of TAXA.genera) { ORIGIN.set(g.id, g.fromMa); LAST.set(g.id, g.toMa); }

/** a fork's name: Polish if the game has one, else the Librarian's (short form), else Latin */
export const label = (c: CladeNode) => c.namePl ?? (TREE_NODES.get(c.name) ? shortName(TREE_NODES.get(c.name)!.namePl) : c.name);
export const nameOf = (id: number) => { const c = CLADES.get(id); return c ? label(c) : GENERA.get(id)?.name ?? '?'; };

const RANKS: Record<string, string> = {
  kingdom: 'królestwo', phylum: 'typ', subphylum: 'podtyp', superclass: 'nadgromada', class: 'gromada', subclass: 'podgromada', infraclass: 'infragromada',
  superorder: 'nadrząd', order: 'rząd', suborder: 'podrząd', infraorder: 'infrarząd', superfamily: 'nadrodzina', family: 'rodzina', subfamily: 'podrodzina', tribe: 'plemię',
  'unranked clade': 'klad', unranked: 'klad', informal: 'grupa', genus: 'rodzaj',
};
export const rankPl = (r: string) => RANKS[r] ?? r;

/**
 * children worth showing: a chain of unnamed one-child clades collapses into its deepest member,
 * so you never click through five empty levels; oldest first
 */
export function effChildren(id: number): { id: number; genus: boolean }[] {
  const c = CLADES.get(id);
  if (!c) return [];
  return c.children.map((ch) => {
    if (GENERA.has(ch)) return { id: ch, genus: true };
    let cur = ch;
    for (;;) {
      const cc = CLADES.get(cur);
      if (!cc || cc.namePl || cc.children.length !== 1 || GENERA.has(cc.children[0])) break;
      cur = cc.children[0];
    }
    return { id: cur, genus: false };
  }).sort((a, b) => (ORIGIN.get(b.id) ?? 0) - (ORIGIN.get(a.id) ?? 0));
}

export function cladeStats(s: GameState, id: number) {
  const all = GENERA.has(id) ? [id] : SUBTREE_GENERA.get(id) ?? [];
  return { total: all.length, hatched: all.filter((g) => s.hatched[g]).length, discovered: all.filter((g) => s.discovered[g]).length };
}

/** a genus to stand for a branch: one you have, else one you found, else the best known one */
export function repGenus(s: GameState, id: number): number | undefined {
  if (GENERA.has(id)) return id;
  const all = SUBTREE_GENERA.get(id) ?? [];
  return all.find((g) => s.hatched[g]) ?? all.find((g) => s.discovered[g]) ?? [...all].sort((a, b) => (GENERA.get(b)!.occurrences ?? 0) - (GENERA.get(a)!.occurrences ?? 0))[0];
}

/** dig sites holding genera of this branch, in the order they open */
export function sitesFor(id: number): { id: string; name: string; n: number }[] {
  const set = new Set(GENERA.has(id) ? [id] : SUBTREE_GENERA.get(id) ?? []);
  return SITES.map((x) => ({ id: x.id, name: x.name, n: x.fauna.filter((f) => set.has(f.genusId)).length }))
    .filter((x) => x.n > 0).sort((a, b) => SITE_ORDER.indexOf(a.id) - SITE_ORDER.indexOf(b.id));
}

/** named ancestors from the root down to (and including) id: the steps of the story */
export function namedPath(id: number): number[] {
  const start = GENERA.has(id) ? GENERA.get(id)!.parent : id;
  const anc = [...ancestorIds(CLADES.get(start)?.parent ?? null), start];
  return anc.filter((a, i) => CLADES.get(a)?.namePl || i === anc.length - 1 || a === TAXA.rootId);
}

export const known = (s: GameState, genusId: number) => s.settings.revealAll || !!s.discovered[genusId];

export const EXTINCTIONS: { ma: number; name: string }[] = [
  { ma: 445, name: 'wymieranie ordowickie' },
  { ma: 372, name: 'wymieranie dewońskie' },
  { ma: 252, name: 'wymieranie permskie' },
  { ma: 201, name: 'wymieranie triasowe' },
  { ma: 66, name: 'koniec dinozaurów' },
];

export const ERAS = [
  { name: 'Paleozoik', start: 538.8, end: 251.9, color: '#3c5566' },
  { name: 'Mezozoik', start: 251.9, end: 66, color: '#4f6e3c' },
  { name: 'Kenozoik', start: 66, end: 0, color: '#7a6338' },
];

/**
 * time → x. In the "epoch" scale every period gets room by the square root of its length, so short periods
 * (like the whole Cenozoic) stay readable; the "real" scale is linear.
 */
export function makeScale(fromMa: number, toMa: number, x0: number, x1: number, epoch: boolean) {
  const cuts = [fromMa, ...PERIODS.map((p) => p.end).filter((e) => e < fromMa && e > toMa), toMa];
  const w = cuts.slice(1).map((c, i) => { const d = cuts[i] - c; return epoch ? Math.sqrt(Math.max(0.01, d)) : d; });
  const tot = w.reduce((a, b) => a + b, 0) || 1;
  const pos = [0];
  for (const v of w) pos.push(pos[pos.length - 1] + v / tot);
  return (ma: number): number => {
    const m = Math.max(toMa, Math.min(fromMa, ma));
    for (let i = 0; i < cuts.length - 1; i++) {
      if (m <= cuts[i] && m >= cuts[i + 1]) {
        const f = cuts[i] === cuts[i + 1] ? 0 : (cuts[i] - m) / (cuts[i] - cuts[i + 1]);
        return x0 + (pos[i] + f * (pos[i + 1] - pos[i])) * (x1 - x0);
      }
    }
    return x1;
  };
}

export function fmtMa(ma: number): string {
  if (ma < 0.5) return 'dziś';
  if (ma < 10) return `${ma.toFixed(1).replace('.', ',')} mln`;
  return `${Math.round(ma)} mln`;
}

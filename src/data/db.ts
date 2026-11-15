// Runtime access to generated data (taxa.json, sites.json).

import taxaJson from './taxa.json';
import sitesJson from './sites.json';
import type { CladeNode, Genus, Site, SitesFile, TaxaFile } from './types';
import type { SpriteSpec } from '../sprites/generator';

export const TAXA = taxaJson as unknown as TaxaFile;
export const SITES = (sitesJson as unknown as SitesFile).sites;

export const GENERA = new Map<number, Genus>(TAXA.genera.map((g) => [g.id, g]));
export const CLADES = new Map<number, CladeNode>(TAXA.clades.map((c) => [c.id, c]));
export const SITE_BY_ID = new Map<string, Site>(SITES.map((s) => [s.id, s]));
export const GENUS_BY_NAME = new Map<string, Genus>(TAXA.genera.map((g) => [g.name, g]));

/** ancestor clade ids, root first */
export function ancestorIds(parent: number | null): number[] {
  const out: number[] = [];
  let p = parent;
  while (p != null) {
    out.push(p);
    p = CLADES.get(p)?.parent ?? null;
  }
  return out.reverse();
}

const chainCache = new Map<number, string[]>();
export function chainNames(g: Genus): string[] {
  let c = chainCache.get(g.id);
  if (!c) {
    c = ancestorIds(g.parent).map((id) => CLADES.get(id)!.name);
    chainCache.set(g.id, c);
  }
  return c;
}

export function spriteSpec(g: Genus): SpriteSpec {
  return { name: g.name, archetype: g.archetype, size: g.size, habitat: g.habitat, chain: chainNames(g) };
}

export function cladeLabel(c: CladeNode): string {
  return c.namePl ? `${c.namePl}` : c.name;
}

// ---------------------------------------------------------------- derived indexes for game systems

/** genus ids in each clade's subtree */
export const SUBTREE_GENERA = new Map<number, number[]>();
for (const g of TAXA.genera) {
  for (const cid of ancestorIds(g.parent)) {
    let arr = SUBTREE_GENERA.get(cid);
    if (!arr) { arr = []; SUBTREE_GENERA.set(cid, arr); }
    arr.push(g.id);
  }
}

const GATE_MAX_LEAVES = 150;
/** research gate: nearest Polish-named ancestor (or largest ancestor with <= 150 leaves) */
export const GATE = new Map<number, number>();
for (const g of TAXA.genera) {
  const anc = ancestorIds(g.parent).reverse(); // parent first
  let gate = anc[0];
  for (const cid of anc) {
    const c = CLADES.get(cid)!;
    if (c.leafCount > GATE_MAX_LEAVES) break;
    gate = cid;
    if (c.namePl) break;
  }
  GATE.set(g.id, gate);
}

/** genera sharing the same direct parent */
export const SIBLINGS = new Map<number, number[]>();
for (const g of TAXA.genera) {
  const sib = (CLADES.get(g.parent)?.children ?? []).filter((id) => id !== g.id && GENERA.has(id));
  SIBLINGS.set(g.id, sib);
}

/** named clades (with Polish names) = collection milestones */
export const NAMED_CLADES = TAXA.clades.filter((c) => c.namePl && c.leafCount >= 2);

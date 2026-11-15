// Data pipeline: PBDB -> src/data/taxa.json + src/data/sites.json
// Run: npm run data   (responses are cached in data-raw/, delete it to refetch)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GROUPS, SITES } from './config';
import { ARCHETYPE_RULES, BRANCH_RULES, ICONS, POLISH_NAMES, SIZE_OVERRIDES } from '../../src/data/cladeRules';
import { ARCHETYPE_BY_ID } from '../../src/data/archetypes';
import { periodLabel } from '../../src/data/geotime';
import type {
  BranchId, CladeNode, Food, Genus, Habitat, Rarity, Site, SitesFile, SizeClass, TaxaFile,
} from '../../src/data/types';

const API = 'https://paleobiodb.org/data1.2';
const RAW = path.resolve('data-raw');
const OUT = path.resolve('src/data');
const SHOW = 'app,ecospace,class,parent,common';

interface PbdbTaxon {
  orig_no: string;
  taxon_no: string;
  taxon_name: string;
  taxon_rank?: string;
  accepted_rank?: string;
  parent_no?: string;
  n_occs?: number;
  firstapp_max_ma?: number;
  lastapp_min_ma?: number;
  early_interval?: string;
  late_interval?: string;
  taxon_environment?: string;
  life_habit?: string;
  diet?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  common_name?: string;
  is_extant?: string;
}

interface PbdbOcc {
  genus?: string;
  phylum?: string;
  class?: string;
  order?: string;
  lat?: string;
  lng?: string;
  max_ma?: number;
  min_ma?: number;
  accepted_rank?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<{ records: T[] }> {
  fs.mkdirSync(RAW, { recursive: true });
  const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 20);
  const file = path.join(RAW, key + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'paleo-collection-game-data-pipeline' } });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      if (!json.records) json.records = [];
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`Fetch failed ${url}: ${String(lastErr)}`);
}

const rankOf = (r: { taxon_rank?: string; accepted_rank?: string }) => r.taxon_rank ?? r.accepted_rank;
const num = (v: unknown) => (typeof v === 'number' ? v : v ? Number(v) : 0);
const realName = (s?: string) => (s && !s.startsWith('NO_') ? s : undefined);

// ---------------------------------------------------------------- 1. groups
async function fetchGroup(base: string): Promise<PbdbTaxon[]> {
  const url = `${API}/taxa/list.json?base_name=${encodeURIComponent(base)}&rank=genus&extant=no&taxon_status=valid&pres=regular&vocab=pbdb&show=${SHOW}&limit=all`;
  const j = await getJson<PbdbTaxon>(url);
  return j.records.filter((r) => rankOf(r) === 'genus' && r.is_extant !== 'extant');
}

function familyKey(r: PbdbTaxon): string {
  return realName(r.family) ?? (realName(r.order) ? 'o:' + r.order : 'p:' + r.parent_no);
}

/** Greedy pick with diminishing returns per family -> diversity over raw popularity. */
function selectDiverse(cands: PbdbTaxon[], quota: number): PbdbTaxon[] {
  const byFam = new Map<string, PbdbTaxon[]>();
  for (const r of [...cands].sort((a, b) => num(b.n_occs) - num(a.n_occs))) {
    const k = familyKey(r);
    if (!byFam.has(k)) byFam.set(k, []);
    byFam.get(k)!.push(r);
  }
  const picked: PbdbTaxon[] = [];
  const count = new Map<string, number>();
  while (picked.length < quota) {
    let bestK: string | null = null;
    let bestScore = -1;
    for (const [k, list] of byFam) {
      if (!list.length) continue;
      const c = count.get(k) ?? 0;
      const score = Math.log2(1 + num(list[0].n_occs)) / (1 + 0.6 * c);
      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    }
    if (bestK === null) break;
    picked.push(byFam.get(bestK)!.shift()!);
    count.set(bestK, (count.get(bestK) ?? 0) + 1);
  }
  return picked;
}

function isCollectible(r: PbdbTaxon | PbdbOcc & { taxon_rank?: string; is_extant?: string; taxon_name?: string }): boolean {
  if ('is_extant' in r && r.is_extant === 'extant') return false;
  const rk = rankOf(r as PbdbTaxon); if (rk && rk !== 'genus') return false;
  const name = (r as PbdbTaxon).taxon_name;
  if (name && ICONS[name]) return true;
  const ph = r.phylum;
  const cl = r.class ?? '';
  const od = r.order ?? '';
  if (ph === 'Chordata') return !['Conodonta', 'Ascidiacea', 'Thaliacea'].includes(cl);
  if (ph === 'Arthropoda') {
    if (['Meganisoptera', 'Palaeodictyoptera', 'Megasecoptera'].includes(od)) return true;
    return !['Ostracoda', 'Insecta', 'Maxillopoda', 'Branchiopoda', 'Arachnida', 'Collembola', 'Entognatha', 'Thecostraca', 'Copepoda'].includes(cl);
  }
  if (ph === 'Mollusca') return cl === 'Cephalopoda';
  if (ph === 'Lobopodia' || ph === 'Onychophora') return true;
  return false;
}

async function fetchByNames(names: string[]): Promise<PbdbTaxon[]> {
  const out: PbdbTaxon[] = [];
  for (let i = 0; i < names.length; i += 60) {
    const chunk = names.slice(i, i + 60);
    const url = `${API}/taxa/list.json?name=${encodeURIComponent(chunk.join(','))}&pres=regular&vocab=pbdb&show=${SHOW}`;
    try {
      const j = await getJson<PbdbTaxon>(url);
      out.push(...j.records);
    } catch (e) {
      // a single bad name can fail the batch -> retry one by one
      for (const n of chunk) {
        try {
          const j = await getJson<PbdbTaxon>(`${API}/taxa/list.json?name=${encodeURIComponent(n)}&pres=regular&vocab=pbdb&show=${SHOW}`);
          out.push(...j.records);
        } catch { /* unknown name */ }
      }
    }
  }
  return out;
}

const MINOR_LABELS: Record<string, string> = {
  Bivalvia: 'małż', Gastropoda: 'ślimak', Brachiopoda: 'ramienionóg', Porifera: 'gąbka',
  Cnidaria: 'koralowiec', Echinodermata: 'szkarłupień', Ostracoda: 'małżoraczek', Insecta: 'owad',
  Bryozoa: 'mszywioł', Annelida: 'pierścienica', Conodonta: 'konodont', Arachnida: 'pajęczak',
  Malacostraca: 'skorupiak', Crinoidea: 'liliowiec', Echinoidea: 'jeżowiec', Anthozoa: 'koralowiec',
  Hyolitha: 'hiolit', Chordata: 'kręgowiec', Mollusca: 'mięczak', Arthropoda: 'stawonóg',
};

function minorLabel(o: PbdbOcc): string {
  return MINOR_LABELS[o.class ?? ''] ?? MINOR_LABELS[o.phylum ?? ''] ?? 'skamieniałość';
}

// ---------------------------------------------------------------- main
async function main() {
  const selected = new Map<string, { rec: PbdbTaxon; source: string }>();
  const byName = new Map<string, string>(); // genus name -> orig_no

  const add = (rec: PbdbTaxon, source: string) => {
    if (TRACE.has(rec.taxon_name) || (rec as { difference?: string }).difference) return false;
    if (selected.has(rec.orig_no) || byName.has(rec.taxon_name)) return false;
    selected.set(rec.orig_no, { rec, source });
    byName.set(rec.taxon_name, rec.orig_no);
    return true;
  };

  console.log('0) Taksony śladowe (tropy, jaja) do wykluczenia…');
  const TRACE = new Set<string>();
  for (const pres of ['ichno', 'form']) {
    const j = await getJson<PbdbTaxon>(`${API}/taxa/list.json?base_name=Animalia&pres=${pres}&vocab=pbdb&limit=all`);
    for (const t of j.records) { TRACE.add(t.taxon_name); }
  }
  console.log('   ', TRACE.size, 'nazw');
  console.log('1) Grupy…');
  const candByName = new Map<string, PbdbTaxon>();
  for (const g of GROUPS) {
    const recs = await fetchGroup(g.base);
    recs.forEach((r) => candByName.set(r.taxon_name, r));
    const free = recs.filter((r) => !selected.has(r.orig_no) && !byName.has(r.taxon_name) && !TRACE.has(r.taxon_name) && !(r as { difference?: string }).difference);
    const picks = selectDiverse(free, g.quota);
    picks.forEach((r) => add(r, g.id));
    console.log(`   ${g.id.padEnd(18)} kandydaci=${String(recs.length).padStart(5)} wybrane=${picks.length}`);
  }

  console.log('2) Ikony…');
  const iconNames = Object.keys(ICONS).filter((n) => !byName.has(n));
  const fromCands = iconNames.filter((n) => candByName.has(n));
  fromCands.forEach((n) => add(candByName.get(n)!, 'icon'));
  const rest = iconNames.filter((n) => !candByName.has(n));
  const iconRecs = await fetchByNames(rest);
  const missingIcons: string[] = [];
  for (const n of rest) {
    // icons are known to be extinct: trust the name even if PBDB flags the genus as extant
    const r = iconRecs.find((x) => x.taxon_name === n && rankOf(x) === 'genus');
    if (!r) missingIcons.push(n);
    else add({ ...r, is_extant: 'extinct' }, 'icon');
  }
  if (missingIcons.length) console.log('   brak w PBDB / żyjące:', missingIcons.join(', '));

  console.log('3) Stanowiska…');
  const siteOccs = new Map<string, PbdbOcc[]>();
  for (const s of SITES) {
    const all: PbdbOcc[] = [];
    for (const strat of s.strat) {
      const url = `${API}/occs/list.json?strat=${encodeURIComponent(strat)}&cc=${s.cc}&base_name=Animalia&idreso=genus&pres=regular&vocab=pbdb&show=class,coords&limit=all`;
      const j = await getJson<PbdbOcc>(url);
      all.push(...j.records);
    }
    siteOccs.set(s.id, all);
    // force-include top collectible genera from this site
    const counts = new Map<string, number>();
    for (const o of all) if (o.genus) counts.set(o.genus, (counts.get(o.genus) ?? 0) + 1);
    const unknown = [...counts.keys()].filter((n) => !byName.has(n));
    const recs = await fetchByNames(unknown);
    const ranked = recs
      .filter((r) => rankOf(r) === 'genus' && isCollectible(r))
      .sort((a, b) => (counts.get(b.taxon_name) ?? 0) - (counts.get(a.taxon_name) ?? 0));
    let forced = 0;
    for (const r of ranked) {
      if (forced >= s.forceTop) break;
      if (add(r, 'site:' + s.id)) forced++;
    }
    console.log(`   ${s.id.padEnd(14)} wystąpienia=${String(all.length).padStart(5)} rodzaje=${String(counts.size).padStart(4)} dodane=${forced}`);
  }

  console.log('4) Przodkowie…');
  const ids = [...selected.keys()];
  const nodes = new Map<string, { id: string; name: string; rank: string; parent?: string }>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80).map((x) => 'txn:' + x).join(',');
    const j = await getJson<PbdbTaxon>(`${API}/taxa/list.json?id=${chunk}&rel=all_parents&vocab=pbdb`);
    for (const r of j.records) {
      nodes.set(r.orig_no, { id: r.orig_no, name: r.taxon_name, rank: rankOf(r) ?? '', parent: r.parent_no });
    }
  }
  for (const { rec } of selected.values()) {
    nodes.set(rec.orig_no, { id: rec.orig_no, name: rec.taxon_name, rank: 'genus', parent: rec.parent_no });
  }
  const animalia = [...nodes.values()].find((n) => n.name === 'Animalia');
  if (!animalia) throw new Error('Animalia not found');

  // full ancestor chains (unpruned) for rule matching
  const chainOf = (id: string): string[] => {
    const out: string[] = [];
    let cur = nodes.get(id);
    let guard = 0;
    while (cur && guard++ < 200) {
      out.push(cur.id);
      if (cur.id === animalia.id) break;
      cur = cur.parent ? nodes.get(cur.parent) : undefined;
    }
    return out;
  };

  console.log('5) Drzewo…');
  const parentOf = new Map<string, string>();
  const keepIds = new Set<string>([animalia.id]);
  let orphans = 0;
  for (const id of selected.keys()) {
    const chain = chainOf(id);
    if (chain[chain.length - 1] !== animalia.id) {
      orphans++;
      parentOf.set(id, animalia.id);
      keepIds.add(id);
      continue;
    }
    for (let i = 0; i < chain.length - 1; i++) parentOf.set(chain[i], chain[i + 1]);
    chain.forEach((c) => keepIds.add(c));
  }
  const children = new Map<string, Set<string>>();
  for (const id of keepIds) children.set(id, new Set());
  for (const [c, p] of parentOf) if (keepIds.has(c)) children.get(p)!.add(c);

  // prune single-child chains (keep Polish-named landmarks and the root)
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...keepIds]) {
      if (id === animalia.id || selected.has(id)) continue;
      const kids = children.get(id)!;
      const name = nodes.get(id)!.name;
      if (kids.size === 1 && !POLISH_NAMES[name]) {
        const [only] = kids;
        const p = parentOf.get(id)!;
        children.get(p)!.delete(id);
        children.get(p)!.add(only);
        parentOf.set(only, p);
        keepIds.delete(id);
        children.delete(id);
        changed = true;
      } else if (kids.size === 0) {
        const p = parentOf.get(id)!;
        children.get(p)!.delete(id);
        keepIds.delete(id);
        children.delete(id);
        changed = true;
      }
    }
  }

  // ------------------------------------------------------------ genera
  const allOccs = [...selected.values()].map((s) => num(s.rec.n_occs)).sort((a, b) => a - b);
  const pct = (v: number) => {
    let lo = 0, hi = allOccs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (allOccs[m] < v) lo = m + 1; else hi = m; }
    return lo / allOccs.length;
  };

  const genusSites = new Map<string, string[]>();
  const sitesOut: Site[] = [];
  for (const s of SITES) {
    const occs = siteOccs.get(s.id)!;
    const counts = new Map<string, number>();
    const minor = new Map<string, { name: string; group: string; occ: number }>();
    const lats: number[] = [], lngs: number[] = [], maxs: number[] = [], mins: number[] = [];
    for (const o of occs) {
      if (o.lat) lats.push(Number(o.lat));
      if (o.lng) lngs.push(Number(o.lng));
      if (o.max_ma) maxs.push(num(o.max_ma));
      if (o.min_ma) mins.push(num(o.min_ma));
      if (!o.genus) continue;
      const gid = byName.get(o.genus);
      if (gid) counts.set(gid, (counts.get(gid) ?? 0) + 1);
      else {
        const m = minor.get(o.genus) ?? { name: o.genus, group: minorLabel(o), occ: 0 };
        m.occ++;
        minor.set(o.genus, m);
      }
    }
    const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
    const q = (a: number[], f: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) * f)] : 0; };
    const fromMa = q(maxs, 0.8);
    const toMa = q(mins, 0.2);
    for (const ex of s.extra ?? []) { const gid = byName.get(ex); if (gid && !counts.has(gid)) counts.set(gid, 2); }
    const fauna = [...counts.entries()].map(([gid, occ]) => ({ genusId: Number(gid), occ })).sort((a, b) => b.occ - a.occ);
    for (const f of fauna) {
      const k = String(f.genusId);
      if (!genusSites.has(k)) genusSites.set(k, []);
      genusSites.get(k)!.push(s.id);
    }
    sitesOut.push({
      id: s.id, name: s.name, formations: s.strat, country: s.country,
      lat: Math.round(med(lats) * 100) / 100, lng: Math.round(med(lngs) * 100) / 100,
      period: periodLabel(fromMa, toMa), fromMa, toMa, description: s.description,
      fauna,
      minorFossils: [...minor.values()].sort((a, b) => b.occ - a.occ).slice(0, 40),
    });
  }

  const genera: Genus[] = [];
  const missingArch = new Map<string, number>();
  for (const [id, { rec }] of selected) {
    if (!keepIds.has(id)) continue;
    const chain = chainOf(id).map((c) => nodes.get(c)!.name);
    const icon = ICONS[rec.taxon_name];
    let archetype = icon?.archetype;
    if (!archetype) for (const n of chain) if (ARCHETYPE_RULES[n]) { archetype = ARCHETYPE_RULES[n]; break; }
    if (!archetype || !ARCHETYPE_BY_ID[archetype]) {
      missingArch.set(chain.slice(1, 4).join('<'), (missingArch.get(chain.slice(1, 4).join('<')) ?? 0) + 1);
      archetype = 'soft_bodied';
    }
    let branch: BranchId = 'paleo_seas';
    for (const n of chain) if (BRANCH_RULES[n]) { branch = BRANCH_RULES[n]; break; }
    const meta = ARCHETYPE_BY_ID[archetype];

    const env = (rec.taxon_environment ?? '').toLowerCase();
    const lh = (rec.life_habit ?? '').toLowerCase();
    const envMarine = /marine|oceanic|reef|coastal/.test(env);
    const envFresh = /freshwater|lacustrine|fluvial/.test(env) && !envMarine;
    let habitat: Habitat = meta.habitat;
    if (meta.rig === 'fly') habitat = 'air';
    else if (meta.semiAquatic) habitat = envMarine ? 'marine' : 'freshwater';
    else if (meta.habitat === 'marine' || meta.habitat === 'freshwater') {
      habitat = envFresh ? 'freshwater' : envMarine ? 'marine' : meta.habitat;
    } else if (meta.habitat === 'land' && /nektonic|aquatic/.test(lh) && !/semi/.test(lh) && meta.rig === 'swim') {
      habitat = envFresh ? 'freshwater' : 'marine';
    }

    const diet = (rec.diet ?? '').toLowerCase();
    let food: Food = meta.food;
    if (/piscivore/.test(diet)) food = 'fish';
    else if (/suspension|deposit|detritivore|filter|microcarnivore/.test(diet)) food = 'plankton';
    else if (/herbivore|grazer|browser|frugivore|granivore|folivore/.test(diet) && !/omnivore/.test(diet)) food = 'plants';
    else if (/carnivore|insectivore/.test(diet)) food = habitat === 'land' || habitat === 'air' ? 'meat' : meta.food === 'plankton' ? 'meat' : meta.food;

    const size: SizeClass = icon?.size ?? SIZE_OVERRIDES[rec.taxon_name] ?? meta.size;
    let rarity: Rarity;
    if (icon?.rarity !== undefined) rarity = icon.rarity;
    else {
      const p = pct(num(rec.n_occs));
      rarity = p >= 0.55 ? 0 : p >= 0.22 ? 1 : 2;
      if (size === 'XL' && rarity < 2) rarity = (rarity + 1) as Rarity;
    }

    genera.push({
      id: Number(id),
      name: rec.taxon_name,
      parent: Number(parentOf.get(id)),
      branch,
      archetype,
      habitat,
      food,
      size,
      rarity,
      fromMa: num(rec.firstapp_max_ma),
      toMa: num(rec.lastapp_min_ma),
      earlyInterval: rec.early_interval,
      lateInterval: rec.late_interval,
      occurrences: num(rec.n_occs),
      family: realName(rec.family),
      order: realName(rec.order),
      commonEn: rec.common_name,
      dietRaw: rec.diet,
      envRaw: rec.taxon_environment,
      icon: icon ? true : undefined,
      sites: genusSites.get(id) ?? [],
    });
  }

  const clades: CladeNode[] = [];
  const leafCount = new Map<string, number>();
  const countLeaves = (id: string): number => {
    if (selected.has(id)) return 1;
    let n = 0;
    for (const c of children.get(id) ?? []) n += countLeaves(c);
    leafCount.set(id, n);
    return n;
  };
  countLeaves(animalia.id);
  for (const id of keepIds) {
    if (selected.has(id)) continue;
    const n = nodes.get(id)!;
    clades.push({
      id: Number(id),
      name: n.name,
      namePl: POLISH_NAMES[n.name],
      rank: n.rank,
      parent: id === animalia.id ? null : Number(parentOf.get(id)),
      children: [...(children.get(id) ?? [])].map(Number),
      leafCount: leafCount.get(id) ?? 0,
    });
  }

  const taxa: TaxaFile = { generatedAt: new Date().toISOString(), rootId: Number(animalia.id), clades, genera };
  fs.writeFileSync(path.join(OUT, 'taxa.json'), JSON.stringify(taxa));
  const sites: SitesFile = { generatedAt: taxa.generatedAt, sites: sitesOut };
  fs.writeFileSync(path.join(OUT, 'sites.json'), JSON.stringify(sites));

  // ------------------------------------------------------------ stats
  console.log('\n=== STATYSTYKI ===');
  console.log(`rodzaje: ${genera.length}, klady: ${clades.length}, sieroty (bez linii do Animalia): ${orphans}`);
  const byBranch = new Map<string, number>();
  genera.forEach((g) => byBranch.set(g.branch, (byBranch.get(g.branch) ?? 0) + 1));
  console.log('gałęzie:', Object.fromEntries(byBranch));
  const byArch = new Map<string, number>();
  genera.forEach((g) => byArch.set(g.archetype, (byArch.get(g.archetype) ?? 0) + 1));
  console.log('szablony:', Object.fromEntries([...byArch].sort((a, b) => b[1] - a[1])));
  console.log('rzadkość:', [0, 1, 2, 3].map((r) => genera.filter((g) => g.rarity === r).length));
  console.log('habitat:', ['land', 'freshwater', 'marine', 'air'].map((h) => `${h}=${genera.filter((g) => g.habitat === h).length}`).join(' '));
  if (missingArch.size) console.log('BRAK SZABLONU (fallback soft_bodied):', Object.fromEntries(missingArch));
  const depth = (id: number): number => { const g = genera.find((x) => x.id === id); let d = 0; let p: number | null = g ? g.parent : id; const cm = new Map(clades.map((c) => [c.id, c])); while (p != null) { d++; p = cm.get(p)?.parent ?? null; } return d; };
  const depths = genera.map((g) => depth(g.id));
  console.log(`głębokość drzewa: śr=${(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)} max=${Math.max(...depths)}`);
  for (const s of sitesOut) {
    const names = s.fauna.slice(0, 8).map((f) => genera.find((g) => g.id === f.genusId)?.name).join(', ');
    console.log(`  ${s.id.padEnd(14)} kolekcja=${String(s.fauna.length).padStart(3)} drobne=${String(s.minorFossils.length).padStart(2)} ${s.period.padEnd(16)} [${s.lat},${s.lng}] ${names}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

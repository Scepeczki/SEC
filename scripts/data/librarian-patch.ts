// Applies the Librarian's data batches (docs/bibliotekarz/wyniki/zmiany-danych-*.json) on top of the PBDB build:
// new clades (sponges, brachiopods, worms, echinoderms…), new genera with exact ranges from PBDB, and fixes
// (moved clades, wrong ranges, missing sites). Idempotent: run it again after `npm run data`.
// Usage: npx tsx scripts/data/librarian-patch.ts
//
// Batch 2 (zmiany-danych-02-stanowiska.json) gives every genus without a dig site one from its own time and
// environment: a "gość epoki" (guest of the epoch) — its fossils come from elsewhere, the site stands for the epoch.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ARCHETYPE_RULES, BRANCH_RULES } from '../../src/data/cladeRules';
import { ARCHETYPE_BY_ID } from '../../src/data/archetypes';
import { periodLabel } from '../../src/data/geotime';
import type { BranchId, CladeNode, Food, Genus, Rarity, Site, SitesFile, TaxaFile } from '../../src/data/types';

/** add new genera first appearing at least this long ago (0 = all) */
const MIN_FAD = 0;
/** drop weight of a guest of the epoch (PBDB site extras get 2, real site genera usually 5–300) */
const GUEST_OCC = 3;
/** body plans the clade rules would get wrong */
const ARCHETYPE_OVERRIDE: Record<string, string> = { Sanctacaris: 'cambrian_arthropod', Offacolus: 'cambrian_arthropod' };
/** PBDB ranges further than this from the Librarian's dates come from stray occurrences: trust the Librarian */
const MAX_RANGE_DIFF = 30;
const API = 'https://paleobiodb.org/data1.2';
const RAW = path.resolve('data-raw');
const OUT = path.resolve('src/data');
const BATCHES = ['docs/bibliotekarz/wyniki/zmiany-danych-01.json'];
const SITE_BATCHES = ['docs/bibliotekarz/wyniki/zmiany-danych-02-stanowiska.json'];
/** the Librarian's proposal ids that the game names differently */
const SITE_RENAME: Record<string, string> = { ashfall: 'siwaliki' };

/** dig sites added to fill the gaps in time (Librarian, batch 2). Luoping, Nacimiento and Pisco are left for later. */
interface NewSite { id: string; name: string; strat: string[]; cc: string; country: string; window: [number, number]; description: string; lat?: number; lng?: number }
const NEW_SITES: NewSite[] = [
  { id: 'cincinnati', name: 'Wapienie Cincinnati', strat: ['Kope', 'Fairview', 'Waynesville', 'Liberty', 'Whitewater', 'Arnheim', 'Grant Lake', 'Bellevue', 'Corryville', 'Mount Auburn', 'Miamitown'], cc: 'US', country: 'USA', window: [455, 443],
    description: 'Późnoordowickie płytkie morze środka Ameryki Północnej. Ławice ramienionogów, mszywiołów i liliowców, a wśród nich trylobity i łodziki – szczyt ordowickiego różnicowania tuż przed wielkim wymieraniem.' },
  { id: 'bertie', name: 'Formacja Bertie', strat: ['Bertie', 'Williamsville', 'Fiddlers Green'], cc: 'US,CA', country: 'USA i Kanada', window: [433, 419],
    description: 'Sylurskie słone laguny nad dzisiejszym jeziorem Erie. Królestwo wielkoraków, takich jak Eurypterus, a obok nich pierwsze skorpiony i stawonogi, które zaglądały na ląd.' },
  { id: 'rhynie', name: 'Czert z Rhynie', strat: ['Dryden Flags', 'Rhynie Chert', 'Windyfield Chert'], cc: 'UK', country: 'Szkocja', window: [412, 400], lat: 57.33, lng: -2.84,
    description: 'Wczesnodewońskie gorące źródła Szkocji zamieniły w krzemień cały mały ekosystem lądowy: pierwsze rośliny naczyniowe, grzyby, roztocza, pajęczaki i najstarsze owady.' },
  { id: 'east_kirkton', name: 'Wapień East Kirkton', strat: ['East Kirkton', 'East Kirkton Limestone', 'Bathgate Hills Volcanic'], cc: 'UK', country: 'Szkocja', window: [350, 325],
    description: 'Wczesnokarbońskie jezioro wśród wulkanów Szkocji. Zachowały się w nim jedne z pierwszych w pełni lądowych czworonogów, skorpiony i wije z lasów, które dopiero powstawały.' },
  { id: 'joggins', name: 'Klify Joggins', strat: ['Joggins'], cc: 'CA', country: 'Kanada', window: [325, 295],
    description: 'Karbońskie lasy węglowe Nowej Szkocji. W pniach skamieniałych widłaków znaleziono Hylonomusa, jednego z najstarszych gadów. Klify są na liście światowego dziedzictwa UNESCO.' },
  { id: 'red_beds', name: 'Czerwone warstwy Teksasu', strat: ['Arroyo', 'Vale', 'Choza', 'Clyde', 'Belle Plains', 'Admiral', 'Petrolia', 'Nocona', 'Waggoner Ranch', 'Putnam'], cc: 'US', country: 'USA', window: [299, 265],
    description: 'Wczesnopermskie równiny rzeczne Teksasu, czerwone od utlenionego żelaza. Tu żył Dimetrodon z żaglem na grzbiecie, płazy Eryops i Diplocaulus o głowie jak bumerang.' },
  { id: 'elliot', name: 'Formacja Elliot', strat: ['Elliot'], cc: 'ZA,LS', country: 'RPA i Lesotho', window: [217, 180],
    description: 'Przełom triasu i jury w południowej Afryce. Wczesne dinozaury, jak Massospondylus z gniazdami pełnymi jaj, pierwsze krokodylokształtne i drobne ssakokształtne.' },
  { id: 'cedar_mountain', name: 'Formacja Cedar Mountain', strat: ['Cedar Mountain'], cc: 'US', country: 'USA', window: [140, 98],
    description: 'Wczesnokredowe równiny Utah. Utahraptor, wczesne ankylozaury i iguanodonty, a z czasem pierwsze rośliny kwiatowe.' },
  { id: 'santa_cruz', name: 'Formacja Santa Cruz', strat: ['Santa Cruz'], cc: 'AR', country: 'Argentyna', window: [29, 15],
    description: 'Wczesnomioceńska Patagonia, gdy Ameryka Południowa była wyspą-kontynentem. Własne kopytne, torbacze drapieżne, leniwce, gliptodonty i ptaki terroru.' },
  { id: 'siwaliki', name: 'Wzgórza Siwalik', strat: ['Chinji', 'Nagri', 'Dhok Pathan', 'Tatrot', 'Pinjor', 'Siwalik'], cc: 'PK,IN', country: 'Pakistan i Indie', window: [18, 2.6],
    description: 'Osady rzek spływających z wypiętrzających się Himalajów, od miocenu po pliocen. Małpy człekokształtne, przodkowie słoni, żyrafy i hipopotamy.' },
];
/** labels of non-collectible fossils (same as the PBDB build) */
const MINOR_LABELS: Record<string, string> = {
  Bivalvia: 'małż', Gastropoda: 'ślimak', Brachiopoda: 'ramienionóg', Porifera: 'gąbka', Cnidaria: 'koralowiec', Echinodermata: 'szkarłupień', Ostracoda: 'małżoraczek',
  Insecta: 'owad', Bryozoa: 'mszywioł', Annelida: 'pierścienica', Conodonta: 'konodont', Arachnida: 'pajęczak', Malacostraca: 'skorupiak', Crinoidea: 'liliowiec',
  Echinoidea: 'jeżowiec', Anthozoa: 'koralowiec', Hyolitha: 'hiolit', Chordata: 'kręgowiec', Mollusca: 'mięczak', Arthropoda: 'stawonóg',
};

interface NewClade { id: string; namePl: string; rank: string; parent: string }
interface NewGenus { genus: string; parent: string; fad: number; lad: number; sites?: string[]; env: string; diet: string; priority: string; note?: string }
interface Fix { what: string; id: string; from: string; to: string; why: string }
interface Batch { newClades: NewClade[]; newGenera: NewGenus[]; fixes: Fix[] }
interface SiteBatch { rodzaje: { genus: string; status: string; site: string | null; note?: string; proposedNewSite?: string }[] }
interface PbdbOcc { genus?: string; phylum?: string; class?: string; lat?: string; lng?: string; max_ma?: number; min_ma?: number }
interface PbdbTaxon {
  orig_no: string; taxon_name: string; taxon_rank?: string; accepted_rank?: string; n_occs?: number;
  firstapp_max_ma?: number; lastapp_min_ma?: number; early_interval?: string; late_interval?: string;
  taxon_environment?: string; diet?: string; family?: string; order?: string; common_name?: string; difference?: string;
}

async function getJson<T>(url: string): Promise<{ records: T[] }> {
  fs.mkdirSync(RAW, { recursive: true });
  const file = path.join(RAW, crypto.createHash('sha1').update(url).digest('hex').slice(0, 20) + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'paleo-collection-game-data-pipeline' } });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
      const json = JSON.parse(text);
      json.records ??= [];
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

const realName = (s?: string) => (s && !s.startsWith('NO_') ? s : undefined);
const num = (v: unknown) => (typeof v === 'number' ? v : v ? Number(v) : 0);
/** stable synthetic id for a clade PBDB does not give us (outside PBDB's id range) */
const synthId = (name: string) => 90_000_000 + (parseInt(crypto.createHash('sha1').update(name).digest('hex').slice(0, 7), 16) % 9_000_000);

async function main() {
  const taxa = JSON.parse(fs.readFileSync(path.join(OUT, 'taxa.json'), 'utf8')) as TaxaFile;
  const sites = JSON.parse(fs.readFileSync(path.join(OUT, 'sites.json'), 'utf8')) as SitesFile;
  const batches = BATCHES.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')) as Batch);

  const clades = new Map(taxa.clades.map((c) => [c.id, c]));
  const genera = new Map(taxa.genera.map((g) => [g.id, g]));
  const cladeByName = (n: string) => taxa.clades.find((c) => c.name === n);
  const genusByName = (n: string) => taxa.genera.find((g) => g.name === n);
  const siteById = new Map(sites.sites.map((s) => [s.id, s]));
  const log: string[] = [];

  const detach = (id: number, parent: number) => { const p = clades.get(parent); if (p) p.children = p.children.filter((x) => x !== id); };
  const attach = (id: number, parent: number) => { const p = clades.get(parent)!; if (!p.children.includes(id)) p.children.push(id); };
  const moveClade = (c: CladeNode, to: CladeNode) => { if (c.parent === to.id) return; detach(c.id, c.parent!); c.parent = to.id; attach(c.id, to.id); log.push(`klad ${c.name} → ${to.name}`); };
  const moveGenus = (g: Genus, to: CladeNode) => { if (g.parent === to.id) return; detach(g.id, g.parent); g.parent = to.id; attach(g.id, to.id); log.push(`rodzaj ${g.name} → ${to.name}`); };

  // ---------------------------------------------------------------- new clades (created on demand)
  const newClade = new Map<string, NewClade>();
  for (const b of batches) for (const c of b.newClades) newClade.set(c.id, c);
  const ensureClade = (name: string): CladeNode => {
    const have = cladeByName(name);
    if (have) return have;
    const spec = newClade.get(name);
    if (!spec) throw new Error(`Nieznany klad: ${name}`);
    const parent = ensureClade(spec.parent);
    const c: CladeNode = { id: synthId(name), name, namePl: spec.namePl, rank: spec.rank, parent: parent.id, children: [], leafCount: 0 };
    if (clades.has(c.id)) throw new Error(`Kolizja id kladu ${name}`);
    taxa.clades.push(c);
    clades.set(c.id, c);
    attach(c.id, parent.id);
    log.push(`nowy klad ${name} („${spec.namePl}”) pod ${parent.name}`);
    return c;
  };

  // ---------------------------------------------------------------- fixes
  const siteAdd = (g: Genus, siteId: string) => {
    const s = siteById.get(siteId);
    if (!s) throw new Error(`Nieznane stanowisko ${siteId}`);
    if (!s.fauna.some((f) => f.genusId === g.id)) s.fauna.push({ genusId: g.id, occ: 2 });
    if (!g.sites.includes(siteId)) g.sites.push(siteId);
  };
  const siteRemove = (g: Genus, siteId: string) => {
    const s = siteById.get(siteId);
    if (s) s.fauna = s.fauna.filter((f) => f.genusId !== g.id);
    g.sites = g.sites.filter((x) => x !== siteId);
  };
  for (const b of batches) for (const f of b.fixes) {
    const g = genusByName(f.id);
    switch (f.what) {
      case 'przenieś klad': moveClade(cladeByName(f.id)!, ensureClade(f.to)); break;
      case 'przenieś rodzaj':
        if (f.id === 'Kerygmachela') {
          // the Librarian's note: "docelowo osobny klad »lobopodia z płatami«" — PBDB has the family for it
          const fam = cladeByName('Kerygmachelidae') ?? (() => {
            const parent = ensureClade(f.to);
            const c: CladeNode = { id: synthId('Kerygmachelidae'), name: 'Kerygmachelidae', namePl: 'Lobopodia z płatami', rank: 'family', parent: parent.id, children: [], leafCount: 0 };
            taxa.clades.push(c); clades.set(c.id, c); attach(c.id, parent.id);
            return c;
          })();
          moveGenus(g!, fam);
        } else moveGenus(g!, ensureClade(f.to));
        break;
      case 'zmień zakres': {
        const [a, z] = f.to.split('–').map(Number);
        if (g && (g.fromMa !== a || g.toMa !== z)) { g.fromMa = a; g.toMa = z; log.push(`zakres ${g.name}: ${f.to}`); }
        break;
      }
      case 'dopisz stanowisko': for (const sid of f.to.split('/')) if (!g!.sites.includes(sid)) { siteAdd(g!, sid); log.push(`${g!.name} + ${sid}`); } break;
      case 'usuń stanowisko': if (g?.sites.includes(f.from)) { siteRemove(g, f.from); log.push(`${g.name} − ${f.from}`); } break;
      case 'popraw rodzinę': if (g?.family) { g.family = undefined; log.push(`${g.name}: bez rodziny`); } break;
      case 'zmień dietę':
        for (const n of f.id.split(',').map((x) => x.trim())) { const x = genusByName(n); if (x && x.food !== 'plankton') { x.food = 'plankton'; log.push(`${n}: dieta → drobny pokarm`); } }
        break;
      default:
        // "scal klady" (Actinopterygii), "usuń stanowisko albo zmień zakres" (Dicellopyge), "usuń rodzaj albo popraw"
        // (Branchiopus): they touch later stages and saves; left for the stage that covers them
        log.push(`POMINIĘTE (${f.what}): ${f.id}`);
    }
  }

  // ---------------------------------------------------------------- new genera
  const wanted = batches.flatMap((b) => b.newGenera).filter((g) => g.fad >= MIN_FAD && !genusByName(g.genus));
  const found = new Map<string, PbdbTaxon>();
  for (let i = 0; i < wanted.length; i += 40) {
    const names = wanted.slice(i, i + 40).map((g) => g.genus);
    const j = await getJson<PbdbTaxon>(`${API}/taxa/list.json?name=${encodeURIComponent(names.join(','))}&pres=regular&vocab=pbdb&show=app,ecospace,class,parent,common`);
    for (const r of j.records) if ((r.taxon_rank ?? r.accepted_rank) === 'genus' && !r.difference) found.set(r.taxon_name, r);
  }
  const occs = taxa.genera.map((g) => g.occurrences).sort((a, b) => a - b);
  const pct = (v: number) => occs.filter((x) => x < v).length / occs.length;
  for (const w of wanted) {
    const r = found.get(w.genus);
    const parent = ensureClade(w.parent);
    const chain: string[] = [];
    for (let c: CladeNode | undefined = parent; c; c = c.parent != null ? clades.get(c.parent) : undefined) chain.push(c.name);
    const archetype = ARCHETYPE_OVERRIDE[w.genus] ?? chain.map((n) => ARCHETYPE_RULES[n]).find((a) => a && ARCHETYPE_BY_ID[a]) ?? 'soft_bodied';
    let branch: BranchId = 'paleo_seas';
    for (const n of chain) if (BRANCH_RULES[n]) { branch = BRANCH_RULES[n]; break; }
    const meta = ARCHETYPE_BY_ID[archetype];
    const food: Food = /mięso/.test(w.diet) ? 'meat' : /ryb/.test(w.diet) ? 'fish' : 'plankton';
    const n = num(r?.n_occs);
    const p = pct(n);
    const rarity: Rarity = (p >= 0.55 ? 0 : p >= 0.22 ? 1 : 2) as Rarity;
    const id = r ? Number(r.orig_no) : synthId(w.genus);
    if (genera.has(id) || clades.has(id)) throw new Error(`Kolizja id rodzaju ${w.genus}`);
    const g: Genus = {
      id, name: w.genus, parent: parent.id, branch, archetype,
      habitat: meta.rig === 'fly' ? 'air' : /ląd/.test(w.env) ? 'land' : /słodk/.test(w.env) ? 'freshwater' : /morze/.test(w.env) ? 'marine' : meta.habitat,
      food, size: meta.size, rarity,
      // PBDB ranges when PBDB knows the genus; otherwise the Librarian's approximate dates
      fromMa: w.fad, toMa: w.lad,
      earlyInterval: r?.early_interval, lateInterval: r?.late_interval,
      occurrences: n, family: realName(r?.family), order: realName(r?.order), commonEn: r?.common_name,
      dietRaw: r?.diet, envRaw: r?.taxon_environment, sites: [],
    };
    const pa = num(r?.firstapp_max_ma), pz = num(r?.lastapp_min_ma);
    const pbdbOk = !!r && pa > 0 && Math.abs(pa - w.fad) <= MAX_RANGE_DIFF && Math.abs(pz - w.lad) <= MAX_RANGE_DIFF;
    if (pbdbOk) { g.fromMa = pa; g.toMa = pz; } else if (r) log.push(`  ${w.genus}: zakres PBDB ${Math.round(pa)}–${Math.round(pz)} odrzucony, daty Bibliotekarza ${w.fad}–${w.lad}`);
    taxa.genera.push(g);
    genera.set(id, g);
    attach(id, parent.id);
    for (const sid of w.sites ?? []) siteAdd(g, sid);
    log.push(`nowy rodzaj ${w.genus} (${pbdbOk ? 'PBDB' : 'daty Bibliotekarza'} ${Math.round(g.fromMa)}–${Math.round(g.toMa)}) pod ${parent.name} · ${archetype}${g.sites.length ? ' · ' + g.sites.join('/') : ''}`);
  }

  // ---------------------------------------------------------------- new dig sites (batch 2: filling the gaps in time)
  // Native fauna comes from PBDB occurrences in the site's formations, kept to the site's time window (some formation
  // names are reused elsewhere, e.g. "Vale"). Genera found there natively are no longer guests anywhere else.
  for (const ns of NEW_SITES) {
    if (siteById.has(ns.id)) continue;
    const occs: PbdbOcc[] = [];
    for (const st of ns.strat) {
      const j = await getJson<PbdbOcc>(`${API}/occs/list.json?strat=${encodeURIComponent(st)}&cc=${ns.cc}&base_name=Animalia&idreso=genus&pres=regular&vocab=pbdb&show=class,coords&limit=all`);
      for (const o of j.records) {
        const mid = (num(o.max_ma) + num(o.min_ma)) / 2;
        if (mid <= ns.window[0] + 3 && mid >= ns.window[1] - 3) occs.push(o);
      }
    }
    const counts = new Map<number, number>();
    const minor = new Map<string, { name: string; group: string; occ: number }>();
    const lats: number[] = [], lngs: number[] = [], maxs: number[] = [], mins: number[] = [];
    for (const o of occs) {
      if (o.lat) lats.push(Number(o.lat));
      if (o.lng) lngs.push(Number(o.lng));
      maxs.push(num(o.max_ma)); mins.push(num(o.min_ma));
      if (!o.genus) continue;
      const g = genusByName(o.genus);
      if (g) counts.set(g.id, (counts.get(g.id) ?? 0) + 1);
      else {
        const m = minor.get(o.genus) ?? { name: o.genus, group: MINOR_LABELS[o.class ?? ''] ?? MINOR_LABELS[o.phylum ?? ''] ?? 'skamieniałość', occ: 0 };
        m.occ++;
        minor.set(o.genus, m);
      }
    }
    const q = (a: number[], f: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) * f)] : 0; };
    const fromMa = Math.round(q(maxs, 0.8) * 10) / 10 || ns.window[0];
    const toMa = Math.round(q(mins, 0.2) * 10) / 10 || ns.window[1];
    const site: Site = {
      id: ns.id, name: ns.name, formations: ns.strat, country: ns.country,
      lat: ns.lat ?? Math.round(q(lats, 0.5) * 100) / 100, lng: ns.lng ?? Math.round(q(lngs, 0.5) * 100) / 100,
      period: periodLabel(fromMa, toMa), fromMa, toMa, description: ns.description,
      fauna: [...counts.entries()].map(([genusId, occ]) => ({ genusId, occ })),
      minorFossils: [...minor.values()].sort((a, b) => b.occ - a.occ).slice(0, 40),
    };
    sites.sites.push(site);
    siteById.set(ns.id, site);
    for (const f of site.fauna) {
      const g = genera.get(f.genusId)!;
      // a genus at home here stops being a guest elsewhere
      for (const sid of [...g.sites]) {
        const other = siteById.get(sid)!;
        if (other.fauna.find((x) => x.genusId === g.id)?.guest) { other.fauna = other.fauna.filter((x) => x.genusId !== g.id); g.sites = g.sites.filter((x) => x !== sid); }
      }
      g.sites.push(ns.id);
    }
    log.push(`nowe stanowisko ${ns.id}: ${occs.length} wystąpień, ${site.fauna.length} rodzajów z gry, ${site.minorFossils.length} drobnych · ${site.period} ${fromMa}–${toMa}`);
  }

  // ---------------------------------------------------------------- sites for genera without one (batch 2)
  let guests = 0;
  for (const f of SITE_BATCHES) {
    const b = JSON.parse(fs.readFileSync(f, 'utf8')) as SiteBatch;
    for (const r of b.rodzaje) {
      // genera waiting for a new site go to it once the game has it
      const target = r.site ?? (r.proposedNewSite ? SITE_RENAME[r.proposedNewSite] ?? r.proposedNewSite : null);
      if (!target || !/^(przypisz|czeka)/.test(r.status)) continue;
      const g = genusByName(r.genus);
      const s = siteById.get(target);
      if (!g || !s || g.sites.length) continue;
      s.fauna.push({ genusId: g.id, occ: GUEST_OCC, guest: true });
      g.sites.push(target);
      guests++;
    }
  }
  log.push(`goście epoki: ${guests} rodzajów dostało stanowisko; bez stanowiska zostaje ${taxa.genera.filter((g) => !g.sites.length).length}`);

  // ---------------------------------------------------------------- Polish names the Librarian corrected
  for (const [n, pl] of [['Chelicerata', 'Szczękoczułkowce'], ['Deuterostomia', 'Wtórouste']]) { const c = cladeByName(n); if (c && c.namePl !== pl) { c.namePl = pl; log.push(`nazwa ${n}: ${pl}`); } }

  // ---------------------------------------------------------------- leaf counts, site order
  const count = (id: number): number => {
    const c = clades.get(id);
    if (!c) return 1;
    c.leafCount = c.children.reduce((a, k) => a + count(k), 0);
    return c.leafCount;
  };
  count(taxa.rootId);
  for (const s of sites.sites) s.fauna.sort((a, b) => b.occ - a.occ);

  fs.writeFileSync(path.join(OUT, 'taxa.json'), JSON.stringify(taxa));
  fs.writeFileSync(path.join(OUT, 'sites.json'), JSON.stringify(sites));
  console.log(log.join('\n'));
  console.log(`\nrodzaje: ${taxa.genera.length}, klady: ${taxa.clades.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

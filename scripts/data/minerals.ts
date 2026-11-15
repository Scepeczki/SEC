// Builds src/data/minerals.json: ~20 real minerals unique to every dig site, unlocked deeper and deeper.
// Source: Wikidata (mineral species with a Polish name and a chemical formula, CC0), cached in data-raw/.
// Colour, crystal form and rarity are game approximations derived from the formula.
// Run: npx tsx scripts/data/minerals.ts   (after npm run data, so all sites exist)

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SITES } from './config';

const RAW = 'data-raw';
const PER_SITE = 20;
const BUCKETS = [8, 6, 4, 2]; // rarity 0..3 per site

interface WdMineral { en: string; pl: string; formula: string }

async function wikidata(): Promise<WdMineral[]> {
  const file = path.join(RAW, 'wikidata-minerals.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const q = `SELECT ?m ?en ?pl ?formula WHERE {
    ?m wdt:P31 wd:Q12089225 .
    ?m rdfs:label ?en FILTER(lang(?en)='en')
    ?m rdfs:label ?pl FILTER(lang(?pl)='pl')
    ?m wdt:P274 ?formula
  }`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), {
    headers: { 'User-Agent': 'paleo-collection-game-data-pipeline/1.0', Accept: 'application/sparql-results+json' },
  });
  const j = (await r.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  const seen = new Set<string>();
  const out: WdMineral[] = [];
  for (const b of j.results.bindings) {
    if (seen.has(b.m.value)) continue;
    seen.add(b.m.value);
    out.push({ en: b.en.value, pl: b.pl.value, formula: b.formula.value });
  }
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

// ---------------------------------------------------------------- chemistry → class, colour, form

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const plain = (f: string) => f.replace(/[₀-₉]/g, (c) => SUB[c]);
const elements = (f: string) => new Set(plain(f).match(/[A-Z][a-z]?/g) ?? []);

type Cls = 'native' | 'sulfide' | 'halide' | 'oxide' | 'carbonate' | 'borate' | 'sulfate' | 'phosphate' | 'silicate' | 'other';
const CLS_PL: Record<Cls, string> = {
  native: 'Pierwiastek rodzimy', sulfide: 'Siarczek', halide: 'Halogenek', oxide: 'Tlenek', carbonate: 'Węglan', borate: 'Boran',
  sulfate: 'Siarczan', phosphate: 'Fosforan', silicate: 'Krzemian', other: 'Minerał',
};
function classOf(f: string, el: Set<string>): Cls {
  const p = plain(f);
  const metals = [...el].filter((e) => !['O', 'H', 'S', 'Se', 'Te', 'As', 'Sb', 'C', 'F', 'Cl', 'Br', 'I', 'B', 'P', 'Si', 'N'].includes(e));
  if (el.size === 1) return 'native';
  if (/CO3/.test(p)) return 'carbonate';
  if (/SO4/.test(p)) return 'sulfate';
  if (/(PO4|AsO4|VO4)/.test(p)) return 'phosphate';
  if (el.has('Si') && el.has('O')) return 'silicate';
  if (el.has('B') && el.has('O')) return 'borate';
  if (!el.has('O') && (el.has('S') || el.has('Se') || el.has('Te') || el.has('As') || el.has('Sb'))) return 'sulfide';
  if (!el.has('O') && (el.has('F') || el.has('Cl') || el.has('Br') || el.has('I'))) return 'halide';
  if (el.has('O') && metals.length) return 'oxide';
  return 'other';
}

function hash(s: string): number {
  return parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 8), 16) / 0xffffffff;
}
const shade = (hex: string, k: number) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)))).map((v) => v.toString(16).padStart(2, '0')).join('');

function colourOf(name: string, el: Set<string>, cls: Cls): string {
  const h = hash(name);
  const pick = (...c: string[]) => c[Math.floor(h * c.length)];
  let c: string;
  if (cls === 'native') c = el.has('Au') ? '#ffd23a' : el.has('Ag') ? '#d8dde2' : el.has('S') ? '#e3cf3a' : el.has('Cu') ? '#c8743a' : el.has('C') ? '#2a2a2e' : '#b9bec4';
  else if (el.has('Hg')) c = '#b5302a';
  else if (el.has('U')) c = pick('#c9d84a', '#e4d23c', '#a8c94a');
  else if (el.has('Co') && cls !== 'sulfide') c = pick('#c0507a', '#d0609a');
  else if (el.has('Cu') && cls !== 'sulfide') c = pick('#3fa76a', '#3d7fc4', '#2fa59a', '#4f9f4a');
  else if (el.has('V')) c = pick('#d4552a', '#c86a2a', '#b84a30');
  else if (el.has('Cr')) c = pick('#c8442f', '#3f8f5a');
  else if (el.has('Ni') && cls !== 'sulfide') c = '#7fbf6a';
  else if (el.has('Mn') && cls === 'oxide') c = '#2f2a26';
  else if (el.has('Mn')) c = pick('#d77a9a', '#c9708a', '#b8865a');
  else if (cls === 'sulfide') c = el.has('Fe') || el.has('Cu') ? pick('#c9a640', '#b08a4a', '#8a8f96') : el.has('As') ? pick('#d0a030', '#c84a2a', '#8a8f96') : pick('#5e6670', '#7a8088', '#9aa0a8');
  else if (el.has('Fe') && cls === 'oxide') c = pick('#8e3b2a', '#6e4a30', '#3e3a38');
  else if (el.has('Fe')) c = pick('#8a6a40', '#a07a48', '#7a8a50');
  else if (el.has('Ti')) c = pick('#3e3a38', '#a0644a');
  else if (el.has('Ba') || el.has('Sr')) c = pick('#cfd9e6', '#a7c6e6', '#e6dfcf');
  else if (cls === 'halide' || cls === 'borate') c = pick('#f0e6e6', '#ede7da', '#e8eef0', '#d9c8e8');
  else if (cls === 'silicate') c = pick('#d9d2c3', '#b9c8b0', '#c6b8d8', '#e6ebf0', '#d8c0a8', '#a8c0c8');
  else c = pick('#efd7a2', '#e6ebf0', '#e2dbc9', '#d9d0e8');
  return shade(c, 0.88 + hash(name + '#') * 0.24);
}

function formOf(name: string, el: Set<string>, cls: Cls, formula: string): string {
  const h = hash(name + 'f');
  if (cls === 'native' && !el.has('S') && !el.has('C')) return 'nugget';
  if (cls === 'sulfide') return h < 0.7 ? 'cube' : 'crystal';
  if (cls === 'oxide') return el.has('Mn') && h < 0.4 ? 'dendrite' : h < 0.6 ? 'nodule' : 'cube';
  if (cls === 'silicate' && el.size <= 3 && el.has('H')) return 'opal';
  if (cls === 'phosphate') return h < 0.5 ? 'nodule' : 'crystal';
  if (cls === 'carbonate' && el.has('Cu')) return 'nodule';
  return plain(formula).length > 40 && h < 0.3 ? 'nodule' : 'crystal';
}

// ---------------------------------------------------------------- which rocks suit which site

/** element and class preferences of each site's geology */
const PROFILE: Record<string, { el: string[]; cls: Cls[] }> = {
  morrison: { el: ['U', 'V', 'Cu', 'Fe', 'Ca'], cls: ['silicate', 'oxide', 'phosphate'] },
  hell_creek: { el: ['Fe', 'Ca', 'Na', 'S'], cls: ['sulfate', 'carbonate', 'silicate'] },
  krasiejow: { el: ['Cu', 'Fe', 'Pb', 'Ca'], cls: ['carbonate', 'sulfide', 'sulfate'] },
  chinle: { el: ['U', 'Cu', 'Si', 'Fe', 'V'], cls: ['silicate', 'oxide', 'phosphate'] },
  solnhofen: { el: ['Ca', 'Mn', 'Sr', 'Mg'], cls: ['carbonate', 'oxide', 'sulfate'] },
  burgess: { el: ['Zn', 'Pb', 'Ba', 'S', 'Fe'], cls: ['sulfide', 'sulfate', 'carbonate'] },
  djadokhta: { el: ['Fe', 'Ca', 'Mg', 'Al'], cls: ['oxide', 'carbonate', 'silicate'] },
  niobrara: { el: ['Sr', 'Ca', 'Fe', 'S'], cls: ['sulfate', 'carbonate', 'sulfide'] },
  green_river: { el: ['Na', 'B', 'Mg', 'Ca', 'K'], cls: ['carbonate', 'borate', 'halide'] },
  yixian: { el: ['Na', 'K', 'Ca', 'Al', 'Si'], cls: ['silicate'] },
  oxford_clay: { el: ['Fe', 'S', 'Ca', 'P'], cls: ['sulfide', 'sulfate', 'phosphate'] },
  karoo: { el: ['Cu', 'Ca', 'Mg', 'Al'], cls: ['silicate', 'carbonate'] },
  chengjiang: { el: ['P', 'Fe', 'S', 'Ca'], cls: ['phosphate', 'sulfide'] },
  dinosaur_park: { el: ['Fe', 'Al', 'Mg', 'Na'], cls: ['silicate', 'carbonate', 'oxide'] },
  tendaguru: { el: ['Fe', 'Ca', 'Ti', 'Al'], cls: ['oxide', 'carbonate', 'silicate'] },
  ischigualasto: { el: ['B', 'Fe', 'Na', 'Ca'], cls: ['borate', 'silicate', 'oxide'] },
  white_river: { el: ['Si', 'Ca', 'K', 'Na'], cls: ['silicate', 'carbonate'] },
  holzmaden: { el: ['Fe', 'S', 'Ca', 'Zn'], cls: ['sulfide', 'carbonate', 'phosphate'] },
  gogo: { el: ['Ca', 'Mg', 'Fe', 'Mn'], cls: ['carbonate', 'oxide'] },
  nemegt: { el: ['Fe', 'Ca', 'Mn', 'Al'], cls: ['oxide', 'carbonate', 'silicate'] },
  kem_kem: { el: ['V', 'Pb', 'Fe', 'Mn'], cls: ['phosphate', 'oxide', 'carbonate'] },
  fezouata: { el: ['Co', 'As', 'Ni', 'Cu'], cls: ['phosphate', 'sulfide', 'oxide'] },
  cleveland: { el: ['Fe', 'S', 'Ba', 'Ni'], cls: ['sulfide', 'sulfate'] },
  santana: { el: ['Ca', 'S', 'Sr', 'Na'], cls: ['sulfate', 'carbonate', 'halide'] },
  mazon_creek: { el: ['Fe', 'Zn', 'Pb', 'S'], cls: ['carbonate', 'sulfide'] },
  messel: { el: ['Fe', 'P', 'Mg', 'Ca'], cls: ['phosphate', 'carbonate', 'silicate'] },
  pampas: { el: ['Mn', 'Cu', 'Ca', 'Na'], cls: ['carbonate', 'silicate', 'sulfate'] },
};

/** the classic minerals already in the game (shared by all sites) */
const TAKEN = new Set(['kwarc', 'kalcyt', 'gips', 'piryt', 'syderyt', 'agat', 'jaspis', 'celestyn', 'malachit', 'ametyst', 'opal', 'złoto']);

async function main() {
  const wd = await wikidata();
  const cands = wd
    .filter((m) => /^[\p{L}-]+$/u.test(m.pl) && m.pl.length <= 16 && !TAKEN.has(m.pl.toLowerCase()) && m.formula.length <= 60)
    .map((m) => {
      const el = elements(m.formula);
      const cls = classOf(m.formula, el);
      // well-known minerals usually have a lowercase Polish label on Wikidata; short formulas are commoner
      const common = (m.pl[0] === m.pl[0].toLowerCase() ? 1 : 0) + Math.max(0, 1 - plain(m.formula).length / 40);
      return { ...m, el, cls, common };
    });
  // de-duplicate by Polish name
  const byName = new Map<string, (typeof cands)[number]>();
  for (const c of cands) if (!byName.has(c.pl.toLowerCase())) byName.set(c.pl.toLowerCase(), c);
  const pool = [...byName.values()];
  console.log('kandydaci', pool.length);

  const siteIds = SITES.map((s) => s.id);
  const picked = new Map<string, typeof pool>(siteIds.map((id) => [id, []]));
  const used = new Set<string>();
  const score = (siteId: string, c: (typeof pool)[number]) => {
    const p = PROFILE[siteId] ?? { el: [], cls: [] };
    let sc = 0;
    p.el.forEach((e, i) => { if (c.el.has(e)) sc += 2 - i * 0.25; });
    const ci = p.cls.indexOf(c.cls);
    if (ci >= 0) sc += 2 - ci * 0.5;
    return sc + c.common * 0.8 + hash(siteId + c.pl) * 0.6;
  };
  // round-robin so every site gets its best remaining match
  for (let round = 0; round < PER_SITE; round++) {
    for (const id of siteIds) {
      let best: (typeof pool)[number] | undefined, bs = -1;
      for (const c of pool) {
        if (used.has(c.pl)) continue;
        const sc = score(id, c);
        if (sc > bs) { bs = sc; best = c; }
      }
      if (!best) continue;
      used.add(best.pl);
      picked.get(id)!.push(best);
    }
  }

  const out: unknown[] = [];
  for (const id of siteIds) {
    const list = picked.get(id)!.sort((a, b) => b.common - a.common || a.pl.localeCompare(b.pl));
    let k = 0;
    BUCKETS.forEach((n, rarity) => {
      for (let i = 0; i < n && k < list.length; i++, k++) {
        const c = list[k];
        const name = c.pl[0].toUpperCase() + c.pl.slice(1);
        // unlock depth (layers): commons from the start, legendary ones deep down
        const minDepth = [0, 8, 22, 40][rarity] + Math.round(i * [1.2, 2, 4, 9][rarity]);
        const coins = Math.round([35, 90, 240, 700][rarity] * (0.85 + hash(name + '$') * 0.3));
        out.push({
          id: 'm_' + c.en.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          name,
          color: colourOf(name, c.el, c.cls),
          form: formOf(name, c.el, c.cls, c.formula),
          rarity,
          coins,
          formula: c.formula,
          desc: `${CLS_PL[c.cls]} · ${c.formula}`,
          site: id,
          minDepth,
        });
      }
    });
  }
  fs.writeFileSync('src/data/minerals.json', JSON.stringify({ source: 'Wikidata (CC0): mineral species with Polish names and formulas', minerals: out }));
  console.log('minerały', out.length, 'na', siteIds.length, 'stanowisk');
  for (const id of siteIds.slice(0, 27)) console.log(' ', id.padEnd(14), picked.get(id)!.slice(0, 6).map((c) => c.pl).join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });

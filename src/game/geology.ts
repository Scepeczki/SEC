// Rock layers of each dig site (top → bottom, i.e. younger → older) and minerals that can turn up.
// The sequences are simplified game versions of the real formations: names and colours follow the
// typical rocks of each place, thicknesses are game layers, not metres.

import siteMineralData from '../data/minerals.json';

export type Grain = 'sand' | 'mud' | 'shale' | 'lime' | 'chalk' | 'coal' | 'tuff' | 'loess';

export interface Stratum {
  name: string;
  /** short description shown in the dig UI */
  desc: string;
  color: string;
  /** mottles / concretions / spots */
  accent?: string;
  /** thin continuous seams (coal, ash, ironstone) */
  seam?: string;
  grain: Grain;
  /** how many game layers this stratum lasts (the last one of a site lasts forever) */
  layers: number;
}

const S = (name: string, desc: string, grain: Grain, color: string, layers: number, extra: { accent?: string; seam?: string } = {}): Stratum => ({ name, desc, grain, color, layers, ...extra });

export const STRATA: Record<string, Stratum[]> = {
  morrison: [
    S('Ogniwo Brushy Basin', 'pstre mułowce z popiołami wulkanicznymi — zielonoszare, fioletowe i czerwone pasy', 'mud', '#8b8f84', 6, { accent: '#8c6c8a', seam: '#a4987e' }),
    S('Ogniwo Salt Wash', 'jasne piaskowce dawnych koryt rzecznych — tu leży najwięcej kości', 'sand', '#b9a986', 6, { accent: '#8f7a56' }),
    S('Ogniwo Tidwell', 'czerwone mułowce równin zalewowych z wkładkami gipsu', 'mud', '#9c5f4c', 5, { accent: '#cdb894' }),
    S('Ogniwo Windy Hill', 'wapniste piaskowce z dawnego wybrzeża', 'sand', '#a89b80', 99, { accent: '#7d705a' }),
  ],
  hell_creek: [
    S('Iłowce z lignitem', 'szarobrązowe iły z czarnymi wkładkami węgla brunatnego', 'mud', '#837b6d', 4, { seam: '#2b2520' }),
    S('Piaskowce rzeczne', 'szare piaskowce dawnych rzek — warstwy z triceratopsami', 'sand', '#a39c88', 8, { accent: '#7a6a52' }),
    S('Szare mułowce', 'drobnoziarniste mułowce z konkrecjami żelaza', 'mud', '#737066', 6, { accent: '#8a5a3a' }),
    S('Piaskowce Fox Hills', 'morskie piaskowce wycofującego się Morza Zachodniego', 'sand', '#b1a683', 99),
  ],
  krasiejow: [
    S('Czerwone iłowce kajpru', 'czerwone iły z zielonymi plamami odbarwień', 'mud', '#8f4c40', 5, { accent: '#77907e' }),
    S('Szare iłowce z wapieniem', 'warstwa kostna dawnego jeziora — tu leżą metoposaury', 'mud', '#7d8078', 6, { accent: '#a9a594' }),
    S('Wapień jeziorny', 'twarde ławice wapienia przekładane iłem', 'lime', '#aaa694', 4),
    S('Pstre iłowce', 'czerwono-szare iły triasowej równiny', 'mud', '#8a5c54', 99, { accent: '#7d8078' }),
  ],
  solnhofen: [
    S('Wapień płytowy', 'cieniutkie płyty wapienia z laguny — zachowują nawet pióra', 'lime', '#d9cca5', 8, { accent: '#b9a77a' }),
    S('Ławice Flinz', 'twardsze, grubsze płyty przekładane miękkim „Fäule”', 'lime', '#cbbd94', 6, { seam: '#b3a37c' }),
    S('Wapień rafowy', 'masywny wapień gąbkowych raf', 'lime', '#bdb299', 99, { accent: '#a59a80' }),
  ],
  burgess: [
    S('Łupek Burgess', 'czarny, drobny łupek z warstwy Phyllopod', 'shale', '#41424a', 6, { accent: '#6a6a70' }),
    S('Ciemny łupek Stephen', 'łupek osadzony u stóp podmorskiego klifu', 'shale', '#36373e', 6),
    S('Wapień Cathedral', 'jasnoszary wapień dawnej rafy', 'lime', '#6c6c68', 99),
  ],
  niobrara: [
    S('Kreda Smoky Hill', 'miękka, jasna kreda pełnego morza z rdzawymi plamami', 'chalk', '#d7cca6', 10, { accent: '#c58f50' }),
    S('Margle kredowe', 'kreda przekładana iłem, z cienkimi warstwami bentonitu', 'chalk', '#bbb08c', 6, { seam: '#e0d6b4' }),
    S('Wapień Fort Hays', 'twardy, masywny wapień', 'lime', '#cac3a9', 99),
  ],
  yixian: [
    S('Łupki jeziorne', 'cienko warstwowane łupki z popiołem — tu zachowały się pióra', 'shale', '#a69f8e', 6, { seam: '#d9d3c1' }),
    S('Tufy wulkaniczne', 'popiół, który zasypał całe ekosystemy', 'tuff', '#8e8b81', 5, { accent: '#c7c0ae' }),
    S('Bazalt', 'ciemna lawa z wnętrza ziemi', 'tuff', '#4c4c50', 99, { accent: '#6c6a66' }),
  ],
  ischigualasto: [
    S('Szarozielone mułowce', 'mułowce Doliny Księżyca', 'mud', '#8a9282', 5, { accent: '#b5b0a0' }),
    S('Czerwone piaskowce', 'piaskowce triasowych rzek', 'sand', '#a1624d', 6),
    S('Bentonity', 'jasne iły z wulkanicznego popiołu', 'mud', '#bab5a5', 99, { seam: '#9a9484' }),
  ],
  karoo: [
    S('Mułowce Beaufort', 'zielonoszare mułowce z czasów wielkiego wymierania', 'mud', '#7e8777', 6, { accent: '#8e5e50' }),
    S('Czerwone mułowce', 'czerwone osady suchych równin', 'mud', '#8f5f51', 6, { accent: '#7e8777' }),
    S('Piaskowce Elliot', 'czerwonawe piaskowce wczesnej jury', 'sand', '#a9836b', 99),
  ],
  cleveland: [
    S('Czarny łupek Cleveland', 'bitumiczny łupek dewońskiego morza z konkrecjami', 'shale', '#303035', 8, { accent: '#6b5b48' }),
    S('Łupek Chagrin', 'szary, miękki łupek', 'shale', '#4b4d52', 99),
  ],
  holzmaden: [
    S('Łupek posidoniowy', 'ciemny, bitumiczny łupek z ichtiozaurami', 'shale', '#3e3f44', 8, { accent: '#56575c' }),
    S('Ławice wapienia', 'cienkie warstwy wapienia w łupku', 'lime', '#6d6d67', 4),
    S('Ciemne iłowce', 'iły dna jurajskiego morza', 'mud', '#46474c', 99),
  ],
  dinosaur_park: [
    S('Piaskowce badlandów', 'jasne piaskowce dawnych koryt z warstwami żelaziaków', 'sand', '#b4aa90', 6, { seam: '#8b5b3b' }),
    S('Szare mułowce', 'mułowce delty z warstwami kostnymi', 'mud', '#8b887d', 6, { accent: '#6a5a46' }),
    S('Piaskowce Oldman', 'piaskowce rzeczne z konkrecjami', 'sand', '#a99b7d', 99),
  ],
  nemegt: [
    S('Płowe piaskowce', 'piaskowce wielkich rzek pustyni Gobi', 'sand', '#c19b6b', 8, { accent: '#a86a4a' }),
    S('Czerwone mułowce', 'rdzawe osady równin zalewowych', 'mud', '#a96b4b', 6),
    S('Piaskowce Baruungoyot', 'piaskowce wydm i oaz', 'sand', '#c9a171', 99),
  ],
  kem_kem: [
    S('Czerwone piaskowce', 'piaskowce wielkiej delty — królestwo spinozaura', 'sand', '#b1613f', 6),
    S('Rdzawe piaskowce', 'piaskowce z otoczakami i zębami', 'sand', '#c1814b', 6, { accent: '#8a4a30' }),
    S('Margle Akrabou', 'jasne margle morskie', 'lime', '#c9b58b', 99),
  ],
  santana: [
    S('Wapień płytowy Crato', 'płyty wapienia z owadami i pterozaurami', 'lime', '#d5c9a5', 6, { accent: '#b9a77a' }),
    S('Łupki Romualdo', 'łupki z konkrecjami pełnymi ryb', 'shale', '#9b9179', 6, { accent: '#c5b991' }),
    S('Iłowce Ipubi', 'iły z warstwami gipsu', 'mud', '#8b8579', 99, { seam: '#e5dccb' }),
  ],
  messel: [
    S('Łupek olejowy', 'wilgotny, ciemny łupek z dna jeziora wulkanicznego', 'shale', '#2f2a25', 99, { accent: '#4b4337' }),
  ],
  mazon_creek: [
    S('Łupek Francis Creek', 'szary łupek z konkrecjami syderytu', 'shale', '#5d5f63', 6, { accent: '#8b6b47' }),
    S('Pokład węgla Colchester', 'czarny węgiel z karbońskich bagien', 'coal', '#25231f', 2),
    S('Iły podłoża', 'szare iły pod pokładem węgla', 'mud', '#6b6b69', 99),
  ],
  pampas: [
    S('Less pampejski', 'pylasty, płowy osad nawiewany wiatrem', 'loess', '#a98d69', 6, { accent: '#c9b48c' }),
    S('Gleby kopalne', 'ciemne poziomy dawnych gleb', 'loess', '#6f5b45', 4),
    S('Wapienna tosca', 'zbite wapienne skorupy', 'lime', '#c3b18d', 99),
  ],
  // ---- 0.2.0
  chinle: [
    S('Ogniwo Petrified Forest', 'pstre, fioletowo-szare iłowce bentonitowe z pniami skamieniałych drzew', 'mud', '#8e7f8c', 6, { accent: '#b0866a', seam: '#cfc2b0' }),
    S('Ogniwo Owl Rock', 'różowe wapienie jeziorne i mułowce', 'lime', '#b98c82', 4, { accent: '#d7b8a6' }),
    S('Ogniwo Sonsela', 'piaskowce i zlepieńce rzeczne', 'sand', '#a79476', 5, { accent: '#7f6a50' }),
    S('Ogniwo Blue Mesa', 'niebieskoszare iłowce z kośćmi fitozaurów', 'mud', '#7d8794', 99, { accent: '#9b7d74' }),
  ],
  djadokhta: [
    S('Piaski Płonących Klifów', 'pomarańczowe piaskowce dawnych wydm', 'sand', '#c98f5c', 7, { accent: '#e0b07a' }),
    S('Piaskowce z gniazdami', 'zbite piaski pustynnych burz — tu leżą gniazda owiraptorów', 'sand', '#b97c50', 6, { accent: '#d9a46e', seam: '#9e6440' }),
    S('Ciemnoczerwone mułowce', 'drobne osady okresowych oaz', 'mud', '#94573c', 99, { accent: '#c08a5a' }),
  ],
  green_river: [
    S('Łupki warwowe', 'cieniutkie roczne warstewki dna jeziora — tu leżą całe ryby', 'shale', '#c7b79a', 6, { seam: '#9a8a6c', accent: '#e0d4bc' }),
    S('Łupek olejowy Parachute', 'brązowy łupek bogaty w kerogen', 'shale', '#7a6450', 5, { accent: '#a08a6c' }),
    S('Ewaporaty z troną', 'białe warstwy soli z wysychającego jeziora', 'chalk', '#ddd5c5', 3, { seam: '#bfb39c' }),
    S('Mułowce Bridger', 'zielonoszare mułowce równin z kośćmi ssaków', 'mud', '#8a8f7a', 99, { accent: '#a99a7a' }),
  ],
  oxford_clay: [
    S('Ił kimerydzki', 'ciemne, bitumiczne iły z kośćmi pliozaurów', 'shale', '#4a4640', 6, { accent: '#6d6458', seam: '#827564' }),
    S('Wapień koralowy', 'jasne wapienie dawnej rafy', 'lime', '#c9bf9f', 4, { accent: '#a99c78' }),
    S('Ił oksfordzki', 'szare iły pełne amonitów i belemnitów', 'mud', '#6f6c66', 6, { accent: '#8b8578' }),
    S('Kornbrasz', 'pokruszone, muszlowe wapienie', 'lime', '#b5a27e', 99, { accent: '#d8c8a0' }),
  ],
  chengjiang: [
    S('Łupek Maotianshan', 'żółtawe, zwietrzałe łupki z miękkimi zwierzętami', 'shale', '#c4ad7c', 6, { accent: '#d8c49a', seam: '#a68f62' }),
    S('Mułowce Yu’anshan', 'szarozielone mułowce głębszego dna', 'shale', '#7f8774', 6, { accent: '#9aa28a' }),
    S('Fosforyty Meishucun', 'ciemne warstwy fosforytów najwcześniejszego kambru', 'mud', '#4f4c48', 99, { accent: '#77705f' }),
  ],
  tendaguru: [
    S('Górna warstwa z zauropodami', 'czerwonawe piaskowce i mułowce z kośćmi giraffatytana', 'sand', '#b0826a', 6, { accent: '#d0a882' }),
    S('Piaskowce z Trigonia', 'morskie piaskowce z małżami', 'sand', '#c2ab84', 4, { accent: '#9a8a68' }),
    S('Środkowa warstwa z dinozaurami', 'margliste mułowce z kentrozaurami', 'mud', '#9a7a62', 6, { accent: '#b8987a' }),
    S('Piaskowce z Nerinea', 'wapniste piaski płytkiego morza', 'sand', '#bfb08e', 99),
  ],
  white_river: [
    S('Formacja Brule', 'różowobeżowe mułowce i pyły wulkaniczne Badlands', 'loess', '#c8a88a', 7, { accent: '#e0cbb0', seam: '#a98a70' }),
    S('Formacja Chadron', 'szarozielone iły bentonitowe z kośćmi brontoterów', 'mud', '#9a9a86', 6, { accent: '#b8a88a' }),
    S('Żółte Kopce', 'zwietrzałe, żółte gleby kopalne', 'loess', '#c9a560', 99, { accent: '#a0784a' }),
  ],
  gogo: [
    S('Konkrecje Gogo', 'wapienne bryły z rybami zachowanymi w 3D', 'lime', '#9c958a', 6, { accent: '#c0b6a2' }),
    S('Wapień przedrafowy', 'szare wapienie ze stoku dawnej rafy', 'lime', '#8a867c', 6, { accent: '#a59c88' }),
    S('Wapień rafowy Pillara', 'jasne, masywne wapienie dewońskiej bariery', 'lime', '#bdb6a0', 99, { accent: '#9a8f78' }),
  ],
  fezouata: [
    S('Górne łupki Fezouata', 'oliwkowozielone łupki z trylobitami', 'shale', '#7d8364', 6, { accent: '#a3a582', seam: '#9a8a62' }),
    S('Łupki z wielkimi radiodontami', 'drobne łupki burzowe z Aegirocassis', 'shale', '#6b6f58', 6, { accent: '#8f9070' }),
    S('Piaskowce Zini', 'jasne, kwarcowe piaskowce wybrzeża', 'sand', '#c2b593', 99, { accent: '#9a8c6a' }),
  ],
};

export interface StratumAt { s: Stratum; next: Stratum; index: number; into: number; left: number; round: number }

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
/** the rock sequence never ends: after the last rock the site's beds repeat (older, deeper benches II, III …) */
const roundOf = (st: Stratum, round: number): Stratum => (round ? { ...st, name: st.name + (ROMAN[round + 1] ?? ` ${round + 1}`), desc: `starsze, głębsze ławice: ${st.desc}` } : st);
const layersOf = (st: Stratum) => (st.layers >= 99 ? 10 : st.layers);

/** which rock a given layer (0-based depth) is cut into */
export function stratumAt(siteId: string, depth: number): StratumAt {
  const list = STRATA[siteId] ?? STRATA.morrison;
  const cycle = list.reduce((a, x) => a + layersOf(x), 0);
  const round = Math.floor(depth / cycle);
  let d = depth - round * cycle;
  for (let i = 0; i < list.length; i++) {
    const n = layersOf(list[i]);
    if (d < n) {
      const nextI = (i + 1) % list.length;
      return { s: roundOf(list[i], round), next: roundOf(list[nextI], nextI === 0 ? round + 1 : round), index: i, into: d, left: n - d, round };
    }
    d -= n;
  }
  return { s: list[0], next: list[0], index: 0, into: 0, left: 1, round };
}

/** the sequence of rocks starting at a layer, with how many layers each spans (for drawing a section) */
export function strataFrom(siteId: string, fromDepth: number, layers: number): { s: Stratum; from: number; to: number }[] {
  const out: { s: Stratum; from: number; to: number }[] = [];
  let d = fromDepth;
  while (d < fromDepth + layers) {
    const at = stratumAt(siteId, d);
    const to = Math.min(fromDepth + layers, d + at.left);
    out.push({ s: at.s, from: d, to });
    d = to;
  }
  return out;
}

// ---------------------------------------------------------------- minerals
export type MineralForm = 'crystal' | 'cube' | 'nodule' | 'nugget' | 'dendrite' | 'opal';

export interface Mineral {
  id: string;
  name: string;
  color: string;
  form: MineralForm;
  rarity: 0 | 1 | 2 | 3;
  coins: number;
  desc: string;
  /** sites where it turns up more often */
  sites?: string[];
  /** site-specific mineral: found only here… */
  site?: string;
  /** …and only from this layer down */
  minDepth?: number;
  formula?: string;
}

/** classic minerals found everywhere */
export const COMMON_MINERALS: Mineral[] = [
  { id: 'kwarc', name: 'Kwarc', color: '#e6ebf0', form: 'crystal', rarity: 0, coins: 20, desc: 'Najpospolitszy minerał skorupy ziemskiej. Drobne kryształy rosną w szczelinach skał.' },
  { id: 'kalcyt', name: 'Kalcyt', color: '#efd7a2', form: 'crystal', rarity: 0, coins: 20, desc: 'Węglan wapnia, ten sam związek co w muszlach. Często wypełnia pustki w skamieniałościach.', sites: ['solnhofen', 'niobrara', 'santana', 'holzmaden', 'krasiejow'] },
  { id: 'gips', name: 'Gips (selenit)', color: '#e2dbc9', form: 'crystal', rarity: 0, coins: 25, desc: 'Przejrzyste tafle, które krystalizują w wysychających jeziorach i lagunach.', sites: ['santana', 'morrison', 'karoo', 'hell_creek'] },
  { id: 'piryt', name: 'Piryt', color: '#d6b443', form: 'cube', rarity: 1, coins: 60, desc: '„Złoto głupców”: złociste sześciany. W łupkach potrafi zastąpić całe muszle i kości.', sites: ['burgess', 'holzmaden', 'cleveland', 'messel', 'mazon_creek'] },
  { id: 'syderyt', name: 'Syderyt', color: '#9b6a3b', form: 'nodule', rarity: 1, coins: 50, desc: 'Węglan żelaza. W jego konkrecjach przetrwała słynna fauna Mazon Creek.', sites: ['mazon_creek', 'messel', 'cleveland'] },
  { id: 'agat', name: 'Agat', color: '#c67b5a', form: 'nodule', rarity: 1, coins: 70, desc: 'Pasiasty chalcedon. Skrzemieniałe kości z formacji Morrison bywają agatowe.', sites: ['morrison', 'ischigualasto', 'pampas'] },
  { id: 'jaspis', name: 'Jaspis', color: '#a8463a', form: 'nodule', rarity: 1, coins: 60, desc: 'Nieprzezroczysty kwarc, zabarwiony na czerwono tlenkami żelaza.', sites: ['kem_kem', 'nemegt', 'karoo'] },
  { id: 'celestyn', name: 'Celestyn', color: '#a7c6e6', form: 'crystal', rarity: 2, coins: 140, desc: 'Bladoniebieskie kryształy siarczanu strontu, rosnące w wapieniach i gipsach.', sites: ['niobrara', 'santana', 'solnhofen'] },
  { id: 'malachit', name: 'Malachit', color: '#38a86a', form: 'nodule', rarity: 2, coins: 160, desc: 'Zielony minerał miedzi z koncentrycznymi pasami.', sites: ['krasiejow', 'karoo'] },
  { id: 'ametyst', name: 'Ametyst', color: '#9a68d0', form: 'crystal', rarity: 2, coins: 180, desc: 'Fioletowa odmiana kwarcu, rośnie w pustkach skał wulkanicznych.', sites: ['yixian', 'pampas', 'ischigualasto'] },
  { id: 'dendryt', name: 'Dendryty manganowe', color: '#2f2a26', form: 'dendrite', rarity: 2, coins: 120, desc: 'Czarne „paprotki” z tlenków manganu na płytkach wapienia. Wyglądają jak rośliny, ale nimi nie są.', sites: ['solnhofen', 'santana'] },
  { id: 'opal', name: 'Opal szlachetny', color: '#c9efe6', form: 'opal', rarity: 3, coins: 500, desc: 'Mieni się wszystkimi kolorami tęczy. W Australii zastępuje nawet kości dinozaurów.' },
  { id: 'zloto', name: 'Złoto rodzime', color: '#ffd23a', form: 'nugget', rarity: 3, coins: 800, desc: 'Prawdziwy samorodek. Na stanowisku paleontologicznym to wielka rzadkość.', sites: ['pampas', 'nemegt'] },
];
/** ~20 real minerals unique to each site (src/data/minerals.json, built from Wikidata) */
export const SITE_MINERALS: Mineral[] = (siteMineralData as { minerals: Mineral[] }).minerals;
export const MINERALS: Mineral[] = [...COMMON_MINERALS, ...SITE_MINERALS];
export const MINERAL_BY_ID = new Map(MINERALS.map((m) => [m.id, m]));
const BY_SITE = new Map<string, Mineral[]>();
for (const m of SITE_MINERALS) { if (!BY_SITE.has(m.site!)) BY_SITE.set(m.site!, []); BY_SITE.get(m.site!)!.push(m); }
/** the site's own minerals, shallowest first */
export const siteMinerals = (siteId: string): Mineral[] => BY_SITE.get(siteId) ?? [];

const MINERAL_RARITY_WEIGHT = [1, 0.35, 0.1, 0.025];
/** the site's own minerals: steeper — very rare and legendary ones are hard to get */
const SITE_RARITY_WEIGHT = [1, 0.3, 0.05, 0.015];

/** relative odds of each mineral at a site and depth */
export function mineralWeights(siteId: string, depth: number): [Mineral, number][] {
  const out: [Mineral, number][] = COMMON_MINERALS.map((m) => [m, MINERAL_RARITY_WEIGHT[m.rarity] * (m.sites?.includes(siteId) ? 4 : 1) * (1 + depth * 0.03 * m.rarity)]);
  // the site's own minerals: once unlocked by depth, they are the main thing you find
  // legendary ones are meant to be a real event: roughly one per several hundred layers
  for (const m of siteMinerals(siteId)) if (depth >= (m.minDepth ?? 0)) out.push([m, SITE_RARITY_WEIGHT[m.rarity] * 3 * (1 + depth * 0.006 * m.rarity)]);
  return out;
}

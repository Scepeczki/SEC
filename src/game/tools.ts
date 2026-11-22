// Workshop (dig 2.0): one upgrade tree built around chain reactions. Six branches:
//   Kopanie — manual digging (power, crits, a wider brush, bigger layers, auto-brush)
//   Skała — modifiers that new layers start with (arrows, blasts, veins, keystones, resonance, crystals)
//   Ręka geologa — your own modifiers, placed a few times per layer (blast, link, rotate, move, copy)
//   Reakcje — combo rules (multiplier, lower threshold, combos over several breaks, loot, stars)
//   Georadar, Ekipy — seeing finds in the rock and digging on autopilot
// Nodes cost rock shards (earned only by digging) and, deeper in, research points. Effects are folded into Mods.

import type { GameState } from './state';

export type ToolId = 'hand' | 'rock' | 'craft' | 'combo' | 'radar' | 'crew';

export interface ToolNode {
  id: string;
  tool: ToolId;
  name: string;
  /** what the node does at a given level (level ≥ 1) */
  effect: (lvl: number) => string;
  /** one-line idea of the node */
  desc: string;
  max: number;
  /** price of going from `lvl` to `lvl + 1` */
  cost: (lvl: number) => { shards: number; pb: number };
  /** prerequisites: [node id, minimum level] — every one must be met */
  req?: [string, number][];
  /** position in the tree grid (column, row) */
  x: number;
  y: number;
  /** capstone: the big payoff at the end of a branch */
  cap?: boolean;
}

const r = (x: number) => (x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100);
/** geometric price: shards base·g^lvl, research points pb0 + pbStep·lvl (0 = none) */
// the first two levels of every node stay cheap (a new branch always gives quick buys), higher ones get dearer and dearer
const LATE = (lvl: number) => (lvl >= 2 ? 1 + lvl : 1);
const geo = (base: number, g: number, pb0 = 0, pbStep = 0) => (lvl: number) => ({ shards: r(base * g ** lvl * LATE(lvl)), pb: pb0 || pbStep ? Math.round(pb0 + pbStep * lvl) : 0 });
const once = (shards: number, pb = 0) => () => ({ shards: shards >= 100000 ? shards * 5 : shards, pb });
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const TOOL_NAMES: Record<ToolId, string> = { hand: 'Kopanie', rock: 'Skała', craft: 'Ręka geologa', combo: 'Reakcje', radar: 'Georadar', crew: 'Ekipy' };
export const TOOL_ORDER: ToolId[] = ['hand', 'rock', 'craft', 'combo', 'radar', 'crew'];
/** what each branch is for (shown in the workshop) */
export const TOOL_BLURB: Record<ToolId, string> = {
  hand: 'Twoje własne uderzenia: siła, krytyki, szerszy pędzel i większe warstwy.',
  rock: 'Nowe warstwy zaczynają się z kamieniami-niespodziankami, które odpalają kolejne.',
  craft: 'Sam ustawiasz reakcję: kilka razy na warstwę dokładasz, łączysz, obracasz i przenosisz modyfikatory.',
  combo: 'Zasady combo: im więcej pól pęknie z jednego uderzenia, tym większe nagrody.',
  radar: 'Widzisz, gdzie w skale leżą kości i skarby.',
  crew: 'Ekipy kopią same, także gdy Cię nie ma.',
};

/** modifier frequency: share of plain tiles that get it, per node level */
export const MOD_RATE = { arrow: 0.012, bomb: 0.006, vein: 0.005, key: 0.006, echo: 0.004, gem: 0.004 } as const;
/** uses per layer of the player's own modifiers, per node level */
export const USES = { bomb: [0, 1, 2, 3], link: [0, 1, 2, 3], rotate: [0, 2, 4, 6], move: [0, 1, 2, 3], copy: [0, 1, 2, 3] } as const;

export const TOOL_NODES: ToolNode[] = [
  // ---------------- Kopanie (columns 0–2)
  { id: 'm_power', tool: 'hand', x: 1, y: 0, name: 'Twardsze włosie', desc: 'Mocniejsze pociągnięcia pędzla: mniej uderzeń na kamień.', max: 10, cost: geo(40, 1.55), effect: (l) => `siła pędzla +${15 * l}%` },
  { id: 'm_crit', tool: 'hand', x: 0, y: 1, req: [['m_power', 2]], name: 'Precyzyjny ruch', desc: 'Czasem kamień pęka od jednego pociągnięcia.', max: 5, cost: geo(250, 1.8, 0, 4), effect: (l) => `${3 * l}% szansy na krytyk` },
  { id: 'm_area', tool: 'hand', x: 2, y: 1, req: [['m_power', 3]], name: 'Szeroki pędzel', desc: 'Jedno pociągnięcie szoruje kilka kamieni naraz. Każdy z nich może zacząć reakcję.', max: 2, cost: geo(1200, 4, 15, 45), effect: (l) => (l === 1 ? 'pędzel obejmuje 2 pola (wskazane i to po prawej)' : 'pędzel obejmuje kwadrat 2×2') },
  { id: 'm_care', tool: 'hand', x: 0, y: 2, req: [['m_crit', 1]], name: 'Delikatna dłoń', desc: 'Kości wychodzą lepiej zachowane.', max: 3, cost: geo(2500, 2.2, 15, 15), effect: (l) => `+${3 * l}% szansy na lepszą jakość` },
  { id: 'm_size', tool: 'hand', x: 2, y: 2, req: [['m_area', 1]], name: 'Większa warstwa', desc: 'Szersze odkrywki: więcej kamieni, więcej znalezisk i dłuższe reakcje.', max: 2, cost: geo(6000, 4, 40, 120), effect: (l) => (l === 1 ? 'warstwa 12 × 8 pól' : 'warstwa 14 × 9 pól') },
  { id: 'm_auto', tool: 'hand', x: 1, y: 3, req: [['m_care', 1]], name: 'Pędzel mechaniczny', desc: 'Wystarczy wodzić myszką: pędzel sam szoruje pole pod kursorem.', max: 3, cost: geo(4000, 2.4, 20, 25), effect: (l) => `${[0, 2, 3, 4][l]} pociągnięcia na sekundę bez klikania` },
  { id: 'm_master', tool: 'hand', x: 1, y: 4, cap: true, req: [['m_auto', 1], ['m_size', 1]], name: 'Mistrz pędzla', desc: 'Zwieńczenie gałęzi: lata praktyki w jednym ruchu.', max: 1, cost: once(200000, 1500), effect: () => 'siła pędzla ×2, krytyki ×1,5' },

  // ---------------- Skała: modifiers a new layer starts with (columns 3–5)
  { id: 'g_arrow', tool: 'rock', x: 4, y: 0, name: 'Iskra', desc: 'W skale pojawiają się kamienie ze strzałką. Rozbity niszczy pola w kierunku strzałki, a jeśli trafi w inny modyfikator, reakcja idzie dalej.', max: 5, cost: geo(30, 1.75), effect: (l) => `ok. ${pct(MOD_RATE.arrow * l)} kamieni ze strzałką · zasięg 2 pola` },
  { id: 'g_reach', tool: 'rock', x: 3, y: 1, req: [['g_arrow', 2]], name: 'Długa iskra', desc: 'Strzałki sięgają dalej.', max: 2, cost: geo(600, 3, 5, 20), effect: (l) => `zasięg strzałki ${2 + l} pola` },
  { id: 'g_bomb', tool: 'rock', x: 5, y: 1, req: [['g_arrow', 1]], name: 'Gniazdo prochu', desc: 'Kamienie z ładunkiem: rozbity wybucha i kruszy wszystko dookoła (3×3).', max: 5, cost: geo(150, 1.8, 0, 3), effect: (l) => `ok. ${pct(MOD_RATE.bomb * l)} kamieni z ładunkiem` },
  { id: 'g_key', tool: 'rock', x: 3, y: 2, req: [['g_reach', 1]], name: 'Zwornik', desc: 'Kamień-zwornik: jeśli rozbijesz go jako ostatni w jego wierszu, zawali się cała jego kolumna.', max: 3, cost: geo(2500, 2.2, 15, 20), effect: (l) => `ok. ${pct(MOD_RATE.key * l)} zworników` },
  { id: 'g_vein', tool: 'rock', x: 5, y: 2, req: [['g_bomb', 2]], name: 'Żyła', desc: 'Pęknięta żyła rozsadza każdy kamień, który dotyka pustki połączonej z tym kamieniem. Im więcej już wykopałeś, tym więcej zabierze.', max: 3, cost: geo(3500, 2.2, 20, 25), effect: (l) => `ok. ${pct(MOD_RATE.vein * l)} kamieni z żyłą` },
  { id: 'g_gem', tool: 'rock', x: 3, y: 3, req: [['g_key', 1]], name: 'Kryształ mnożnika', desc: 'Kryształ sam nic nie niszczy, ale gdy pęknie w trakcie reakcji, jej mnożnik nagród rośnie dwukrotnie.', max: 3, cost: geo(6000, 2.3, 30, 30), effect: (l) => `ok. ${pct(MOD_RATE.gem * l)} kryształów · mnożnik ×2 na każdy` },
  { id: 'g_echo', tool: 'rock', x: 5, y: 3, req: [['g_vein', 1]], name: 'Rezonans', desc: 'Kamień rezonansowy odpala inne kamienie z modyfikatorami, nawet daleko od siebie.', max: 3, cost: geo(6000, 2.3, 30, 30), effect: (l) => `ok. ${pct(MOD_RATE.echo * l)} kamieni rezonansowych · odpala ${l >= 3 ? 2 : 1} inne modyfikatory` },
  { id: 'g_cap', tool: 'rock', x: 4, y: 4, cap: true, req: [['g_gem', 1], ['g_echo', 1]], name: 'Skała niespodzianek', desc: 'Zwieńczenie gałęzi: każda warstwa to minowe pole.', max: 1, cost: once(200000, 1500), effect: () => 'modyfikatorów ×1,5, wybuch ładunku 5×5' },

  // ---------------- Ręka geologa: your own modifiers, a few uses per layer (columns 6–8)
  { id: 'p_bomb', tool: 'craft', x: 7, y: 0, req: [['g_arrow', 1]], name: 'Własny ładunek', desc: 'Podkładasz ładunek pod dowolny kamień. Wybuchnie, gdy kamień pęknie: od Twojego uderzenia albo w trakcie reakcji.', max: 3, cost: geo(200, 2.4, 0, 8), effect: (l) => `${USES.bomb[l]} ${l === 1 ? 'ładunek' : 'ładunki'} na warstwę` },
  { id: 'p_link', tool: 'craft', x: 6, y: 1, req: [['p_bomb', 1]], name: 'Połączenie', desc: 'Łączysz dwa dowolne kamienie: gdy pęknie jeden, pęka i drugi. Tak przerzucisz reakcję na drugi koniec warstwy.', max: 3, cost: geo(1200, 2.4, 10, 15), effect: (l) => `${USES.link[l]} ${l === 1 ? 'połączenie' : 'połączenia'} na warstwę` },
  { id: 'p_rotate', tool: 'craft', x: 8, y: 1, req: [['p_bomb', 1]], name: 'Obrót', desc: 'Obracasz strzałkę o 90°, żeby celowała tam, gdzie chcesz.', max: 3, cost: geo(800, 2.2, 5, 10), effect: (l) => `${USES.rotate[l]} obroty na warstwę` },
  { id: 'p_move', tool: 'craft', x: 6, y: 2, req: [['p_link', 1]], name: 'Przesunięcie', desc: 'Przenosisz istniejący modyfikator na inny kamień.', max: 3, cost: geo(3000, 2.4, 20, 20), effect: (l) => `${USES.move[l]} ${l === 1 ? 'przesunięcie' : 'przesunięcia'} na warstwę` },
  { id: 'p_copy', tool: 'craft', x: 8, y: 2, req: [['p_rotate', 1]], name: 'Kopia', desc: 'Powielasz istniejący modyfikator na inny kamień (oryginał zostaje).', max: 3, cost: geo(4000, 2.4, 25, 25), effect: (l) => `${USES.copy[l]} ${l === 1 ? 'kopia' : 'kopie'} na warstwę` },
  { id: 'p_thrift', tool: 'craft', x: 7, y: 3, req: [['p_move', 1], ['p_copy', 1]], name: 'Oszczędna ręka', desc: 'Duża reakcja oddaje zużyte ruchy: im dłuższa, tym więcej.', max: 2, cost: geo(12000, 2.6, 60, 60), effect: (l) => `combo ${l === 1 ? '15' : '10'}+ oddaje 1 użycie każdego narzędzia` },
  { id: 'p_cap', tool: 'craft', x: 7, y: 4, cap: true, req: [['p_thrift', 1]], name: 'Architekt warstwy', desc: 'Zwieńczenie gałęzi: warstwa układa się tak, jak chcesz.', max: 1, cost: once(200000, 1500), effect: () => '+1 użycie każdego odblokowanego narzędzia na warstwę' },

  // ---------------- Reakcje: combo rules (columns 9–11)
  { id: 'c_mult', tool: 'combo', x: 10, y: 0, name: 'Mnożnik reakcji', desc: 'Każde pole ponad próg combo podnosi mnożnik odłamków i łupów z tej reakcji.', max: 5, cost: geo(50, 1.8), effect: (l) => `+${(10 + 5 * l)}% za każde pole ponad próg` },
  { id: 'c_min', tool: 'combo', x: 9, y: 1, req: [['c_mult', 1]], name: 'Niższy próg', desc: 'Combo liczy się od mniejszej liczby pól.', max: 2, cost: geo(1000, 3, 10, 30), effect: (l) => `combo od ${4 - l} pól` },
  { id: 'c_carry', tool: 'combo', x: 11, y: 1, req: [['c_mult', 2]], name: 'Dwutakt', desc: 'Combo nie kończy się po jednym uderzeniu: kolejne ręczne rozbicie dolicza się do tej samej reakcji.', max: 2, cost: geo(1600, 3, 15, 40), effect: (l) => `combo trwa przez ${l + 1} ręczne rozbicia` },
  { id: 'c_loot', tool: 'combo', x: 9, y: 2, req: [['c_min', 1]], name: 'Łup z reakcji', desc: 'Duże combo wyrzuca dodatkowe nagrody: monety, punkty badań, a przy największych mutagen albo minerał.', max: 3, cost: geo(3000, 2.3, 15, 20), effect: (l) => `combo 10+: monety · 15+: badania · 25+: ${l >= 2 ? 'mutagen lub minerał' : 'więcej monet'} (×${l})` },
  { id: 'c_stars', tool: 'combo', x: 11, y: 2, req: [['c_carry', 1]], name: 'Perfekcjonista', desc: 'Warstwa wykopana małą liczbą ręcznych rozbić dostaje gwiazdki i większą nagrodę.', max: 3, cost: geo(3000, 2.3, 15, 20), effect: (l) => `3 gwiazdki do ${4 + l} rozbić, nagroda za gwiazdkę +${25 + 15 * l}%` },
  { id: 'c_quake', tool: 'combo', x: 10, y: 3, req: [['c_loot', 1], ['c_stars', 1]], name: 'Wstrząs', desc: 'Po dużej reakcji cała warstwa drży: pozostałe kamienie słabną (ale same nie pękają).', max: 3, cost: geo(10000, 2.4, 50, 50), effect: (l) => `combo 12+: reszta kamieni traci ${15 * l}% wytrzymałości` },
  { id: 'c_cap', tool: 'combo', x: 10, y: 4, cap: true, req: [['c_quake', 1]], name: 'Reakcja łańcuchowa', desc: 'Zwieńczenie gałęzi: nagroda dla mistrzów jednego uderzenia.', max: 1, cost: once(200000, 1500), effect: () => 'combo 20+: mnożnik ×1,5 · cała warstwa jednym uderzeniem: złota skrzynia' },

  // ---------------- Georadar (columns 12–14)
  { id: 'r_res', tool: 'radar', x: 13, y: 0, name: 'Georadar', desc: 'Pokazuje, gdzie w skale coś leży — z każdym poziomem dokładniej.', max: 4,
    cost: (l) => ({ shards: [1500, 9000, 35000, 120000][l] ?? 0, pb: [20, 80, 250, 700][l] ?? 0 }),
    effect: (l) => ['', 'rozmyte strefy wokół kości (z pustą skałą dookoła)', 'węższe strefy, także bursztyn i minerały', 'prawie dokładne kontury w kolorach rodzaju', 'dokładne kontury wszystkich znalezisk'][l] },
  { id: 'r_glint', tool: 'radar', x: 12, y: 1, req: [['r_res', 1]], name: 'Czujnik kryształów', desc: 'Bursztyn i minerały błyskają nawet przez nietkniętą skałę.', max: 1, cost: once(9000, 50), effect: () => 'błyski przez całą skałę' },
  { id: 'r_sonar', tool: 'radar', x: 14, y: 1, req: [['r_res', 2]], name: 'Sonar', desc: 'Strefy kości na georadarze świecą kolorem rzadkości: od razu widać, gdzie leży coś cennego.', max: 1, cost: once(16000, 90), effect: () => 'kolor rzadkości w strefach kości' },
  { id: 'r_lucky', tool: 'radar', x: 12, y: 2, req: [['r_glint', 1]], name: 'Wykrywacz anomalii', desc: 'Złote błyski pojawiają się częściej.', max: 3, cost: geo(10000, 2.2, 40, 40), effect: (l) => `złote błyski ${Math.round(100 / (1 - 0.2 * l) - 100)}% częściej` },
  { id: 'r_rare', tool: 'radar', x: 14, y: 2, req: [['r_sonar', 1]], name: 'Analiza widmowa', desc: 'Namierza rzadsze okazy w skale.', max: 5, cost: geo(9000, 2, 40, 30), effect: (l) => `rzadkie kości +${10 * l}%` },
  { id: 'r_tomo', tool: 'radar', x: 13, y: 3, cap: true, req: [['r_res', 4], ['r_lucky', 1], ['r_rare', 2]], name: 'Tomograf', desc: 'Zwieńczenie gałęzi: skała przezroczysta jak szkło.', max: 1, cost: once(250000, 1500), effect: () => 'rzadkie kości ×1,5, minerały ×1,5, +5% jakości' },

  // ---------------- Ekipy (columns 15–17)
  { id: 'k_speed', tool: 'crew', x: 16, y: 0, name: 'Lepsze kilofy', desc: 'Ekipy kopią szybciej.', max: 8, cost: geo(400, 1.65), effect: (l) => `tempo ekip +${10 * l}%` },
  { id: 'k_power', tool: 'crew', x: 15, y: 1, req: [['k_speed', 2]], name: 'Ciężkie dłuta', desc: 'Każde uderzenie ekipy jest mocniejsze.', max: 5, cost: geo(2000, 1.9, 0, 5), effect: (l) => `siła ekip +${25 * l}%` },
  { id: 'k_hire', tool: 'crew', x: 17, y: 1, req: [['k_speed', 3]], name: 'Nowy pracownik', desc: 'Dodatkowa ekipa na stanowisku.', max: 3, cost: geo(6000, 3, 30, 60), effect: (l) => `+${l} ${l === 1 ? 'ekipa' : 'ekipy'}` },
  { id: 'r_crew', tool: 'crew', x: 15, y: 2, req: [['k_power', 1], ['r_res', 1]], name: 'Mapy dla ekip', desc: 'Ekipy z georadarem częściej kopią tam, gdzie coś leży.', max: 3, cost: geo(6000, 2.1, 20, 20), effect: (l) => `+${8 * l}% celnych uderzeń ekip` },
  { id: 'k_sift', tool: 'crew', x: 17, y: 2, req: [['k_hire', 1]], name: 'Sito', desc: 'Z każdego pola zostaje więcej odłamków.', max: 5, cost: geo(5000, 2, 10, 10), effect: (l) => `odłamki +${20 * l}%` },
  { id: 'k_boss', tool: 'crew', x: 16, y: 3, req: [['r_crew', 1], ['k_sift', 1]], name: 'Brygadzista', desc: 'Ekipy czasem kruszą pole jednym ciosem (pola ze znaleziskami i modyfikatorami i tak zostawiają Tobie).', max: 3, cost: geo(20000, 2.3, 80, 60), effect: (l) => `${5 * l}% krytyków ekip` },
  { id: 'k_expo', tool: 'crew', x: 16, y: 4, cap: true, req: [['k_boss', 2], ['k_hire', 2]], name: 'Wielka ekspedycja', desc: 'Zwieńczenie gałęzi: całe obozowisko pracuje dla Ciebie.', max: 1, cost: once(250000, 1500), effect: () => 'tempo ekip ×2, odłamki od ekip ×2' },
];
export const TOOL_NODE_BY_ID = new Map(TOOL_NODES.map((n) => [n.id, n]));
export const TOOL_COLS = 18;

export const toolLevel = (s: GameState, id: string) => s.tools?.[id] ?? 0;

/** first unmet prerequisite (undefined = all met) */
export function missingReq(s: GameState, n: ToolNode): [ToolNode, number] | undefined {
  for (const [id, lvl] of n.req ?? []) if (toolLevel(s, id) < lvl) return [TOOL_NODE_BY_ID.get(id)!, lvl];
  return undefined;
}

export function canBuyToolNode(s: GameState, id: string): { ok: boolean; why?: string; shards: number; pb: number } {
  const n = TOOL_NODE_BY_ID.get(id);
  if (!n) return { ok: false, why: 'Nieznane ulepszenie', shards: 0, pb: 0 };
  const lvl = toolLevel(s, id);
  const c = n.cost(lvl);
  if (lvl >= n.max) return { ok: false, why: 'Maksymalny poziom', ...c };
  const miss = missingReq(s, n);
  if (miss) return { ok: false, why: `Wymaga: ${miss[0].name}${miss[0].max > 1 ? ` poz. ${miss[1]}` : ''}`, ...c };
  if ((s.shards ?? 0) < c.shards) return { ok: false, why: 'Za mało odłamków', ...c };
  if (s.pb < c.pb) return { ok: false, why: 'Za mało punktów badań', ...c };
  return { ok: true, ...c };
}

export function buyToolNode(s: GameState, id: string): boolean {
  const c = canBuyToolNode(s, id);
  if (!c.ok) return false;
  s.shards -= c.shards;
  s.pb -= c.pb;
  (s.tools ??= {})[id] = toolLevel(s, id) + 1;
  return true;
}

// ---------------------------------------------------------------- 0.3 → 0.4: the old brush / hammer / charge trees are gone

const oldGeo = (base: number, g: number, pb0 = 0, pbStep = 0) => (lvl: number) => ({ shards: r(base * g ** lvl), pb: pb0 || pbStep ? Math.round(pb0 + pbStep * lvl) : 0 });
const oldOnce = (shards: number, pb = 0) => () => ({ shards, pb });
const OLD_COST: Record<string, (lvl: number) => { shards: number; pb: number }> = {
  b_power: oldGeo(150, 1.6), b_crit: oldGeo(700, 1.8, 5, 5), b_care: oldGeo(2500, 2.2, 15, 15), b_splash: oldGeo(1000, 1.8, 0, 5), b_combo: oldGeo(4000, 2.2, 25, 20),
  b_sweep: oldGeo(6000, 2.2, 30, 25), b_ember: oldGeo(5000, 2.2, 25, 25), b_fever: oldGeo(20000, 2.4, 80, 60), b_wild: oldGeo(18000, 2.4, 80, 60), b_auto: oldGeo(5000, 2.4, 25, 25),
  b_master: oldOnce(250000, 1500), h_unlock: oldOnce(1200, 15), h_power: oldGeo(800, 1.6, 0, 2), h_safe: oldGeo(1200, 1.8, 0, 4), h_crit: oldGeo(2500, 1.9, 5, 5),
  h_area: oldOnce(15000, 80), h_feather: oldOnce(12000, 60), h_after: oldGeo(16000, 2.3, 60, 50), h_quake: oldGeo(20000, 2.3, 80, 60), h_auto: oldGeo(14000, 2.4, 60, 50),
  h_titan: oldOnce(250000, 1500), x_unlock: oldOnce(4000, 40), x_fuse: oldGeo(2500, 1.9, 5, 5), x_power: oldGeo(9000, 3, 40, 60), x_bag: oldGeo(8000, 2.3, 30, 30),
  x_crush: oldGeo(7000, 2.2, 20, 20), x_chain: oldGeo(22000, 2.4, 90, 70), x_mega: oldOnce(250000, 1500),
};

/** give back everything spent on nodes that no longer exist; returns the refund */
export function refundRemovedNodes(s: GameState): { shards: number; pb: number } {
  const out = { shards: 0, pb: 0 };
  for (const [id, lvl] of Object.entries(s.tools ?? {})) {
    if (TOOL_NODE_BY_ID.has(id)) continue;
    const cost = OLD_COST[id];
    if (cost) for (let l = 0; l < lvl; l++) { const c = cost(l); out.shards += c.shards; out.pb += c.pb; }
    delete s.tools[id];
  }
  s.shards = (s.shards ?? 0) + out.shards;
  s.pb += out.pb;
  return out;
}

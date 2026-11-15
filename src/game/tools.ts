// Workshop: one big classic upgrade tree with five branches (brush, hammer, charges, georadar, crews).
// Nodes are bought with rock shards (earned only by digging) and, deeper in the tree, research points.
// Early nodes give small steps; the capstones at the bottom of each branch are huge — slow start, big finish.
// Effects are folded into Mods (see mods.ts).

import type { GameState } from './state';

export type ToolId = 'brush' | 'hammer' | 'charge' | 'radar' | 'crew';

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
const geo = (base: number, g: number, pb0 = 0, pbStep = 0) => (lvl: number) => ({ shards: r(base * g ** lvl), pb: pb0 || pbStep ? Math.round(pb0 + pbStep * lvl) : 0 });
const once = (shards: number, pb = 0) => () => ({ shards, pb });

export const TOOL_NAMES: Record<ToolId, string> = { brush: 'Pędzel', hammer: 'Młot', charge: 'Ładunki', radar: 'Georadar', crew: 'Ekipy' };
export const TOOL_ORDER: ToolId[] = ['brush', 'hammer', 'charge', 'radar', 'crew'];

export const TOOL_NODES: ToolNode[] = [
  // ---------------- brush (columns 0–2)
  { id: 'b_power', tool: 'brush', x: 1, y: 0, name: 'Twardsze włosie', desc: 'Mocniejsze pociągnięcia pędzla.', max: 10, cost: geo(150, 1.6), effect: (l) => `siła pędzla +${10 * l}%` },
  { id: 'b_crit', tool: 'brush', x: 0, y: 1, req: [['b_power', 2]], name: 'Precyzyjny ruch', desc: 'Trafienia krytyczne: pole pęka od razu.', max: 5, cost: geo(700, 1.8, 5, 5), effect: (l) => `${2 * l}% szansy na krytyk` },
  { id: 'b_care', tool: 'brush', x: 1, y: 1, req: [['b_power', 4]], name: 'Delikatna dłoń', desc: 'Kości wychodzą lepiej zachowane.', max: 3, cost: geo(2500, 2.2, 15, 15), effect: (l) => `+${3 * l}% szansy na lepszą jakość` },
  { id: 'b_splash', tool: 'brush', x: 2, y: 1, req: [['b_power', 3]], name: 'Rozprysk', desc: 'Uderzenie osłabia też 4 pola dookoła.', max: 5, cost: geo(1000, 1.8, 0, 5), effect: (l) => `sąsiedzi dostają ${8 * l}% siły uderzenia` },
  { id: 'b_combo', tool: 'brush', x: 0, y: 2, req: [['b_crit', 1]], name: 'Rytm', desc: 'Seria szybkich uderzeń mnoży szansę na krytyk.', max: 3, cost: geo(4000, 2.2, 25, 20), effect: (l) => `seria 10+: krytyk ×${1 + 0.5 * l}, seria 20+: ×${1 + l}` },
  { id: 'b_sweep', tool: 'brush', x: 1, y: 2, req: [['b_care', 1], ['b_splash', 1]], name: 'Szeroki pędzel', desc: 'Czasem jedno pociągnięcie zahacza o drugie pole.', max: 3, cost: geo(6000, 2.2, 30, 25), effect: (l) => `${15 * l}% szansy na pełne uderzenie w sąsiednie pole` },
  { id: 'b_ember', tool: 'brush', x: 2, y: 2, req: [['b_splash', 2]], name: 'Żarzące włosie', desc: 'Co piąte uderzenie podpala pole: tli się ono i sąsiedzi.', max: 3, cost: geo(5000, 2.2, 25, 25), effect: (l) => `tlenie przez 4 s: −${(0.12 * l).toFixed(2)} siły na sekundę` },
  { id: 'b_fever', tool: 'brush', x: 0, y: 3, req: [['b_combo', 2]], name: 'Gorączka', desc: 'Pełna seria (30) włącza Gorączkę: każde trafienie krytyczne.', max: 3, cost: geo(20000, 2.4, 80, 60), effect: (l) => `Gorączka trwa ${2 + l} s` },
  { id: 'b_wild', tool: 'brush', x: 2, y: 3, req: [['b_ember', 2]], name: 'Pożar', desc: 'Wygasające pole może zapalić sąsiada.', max: 3, cost: geo(18000, 2.4, 80, 60), effect: (l) => `${25 * l}% szansy, że ogień przeskoczy dalej` },
  { id: 'b_auto', tool: 'brush', x: 1, y: 3, req: [['b_sweep', 1]], name: 'Pędzel mechaniczny', desc: 'Wystarczy wodzić myszką: pędzel sam szoruje pole pod kursorem.', max: 3, cost: geo(5000, 2.4, 25, 25), effect: (l) => `${[0, 2, 3, 4][l]} pociągnięcia na sekundę bez klikania` },
  { id: 'b_master', tool: 'brush', x: 1, y: 4, cap: true, req: [['b_fever', 1], ['b_auto', 1], ['b_wild', 1]], name: 'Mistrz pędzla', desc: 'Zwieńczenie gałęzi: lata praktyki w jednym ruchu.', max: 1, cost: once(250000, 1500), effect: () => 'siła pędzla ×2, krytyki ×1,5' },

  // ---------------- hammer (columns 3–5)
  { id: 'h_unlock', tool: 'hammer', x: 4, y: 0, name: 'Młot pneumatyczny', desc: 'Nowe narzędzie: uderza w plus z 5 pól.', max: 1, cost: once(1200, 15), effect: () => 'odblokowany (klawisz 2)' },
  { id: 'h_power', tool: 'hammer', x: 3, y: 1, req: [['h_unlock', 1]], name: 'Cięższy obuch', desc: 'Mocniejsze uderzenia młota.', max: 10, cost: geo(800, 1.6, 0, 2), effect: (l) => `siła młota +${10 * l}%` },
  { id: 'h_safe', tool: 'hammer', x: 5, y: 1, req: [['h_unlock', 1]], name: 'Amortyzator', desc: 'Mniejsze ryzyko uszkodzenia kości.', max: 5, cost: geo(1200, 1.8, 0, 4), effect: (l) => `ryzyko ${25 - 4 * l}% zamiast 25%` },
  { id: 'h_crit', tool: 'hammer', x: 3, y: 2, req: [['h_power', 2]], name: 'Uderzenie w szczelinę', desc: 'Krytyki młota rozbijają środkowe pole.', max: 5, cost: geo(2500, 1.9, 5, 5), effect: (l) => `${2 * l}% szansy na krytyk` },
  { id: 'h_area', tool: 'hammer', x: 4, y: 2, req: [['h_power', 3], ['h_safe', 1]], name: 'Szeroki zamach', desc: 'Młot uderza w kwadrat 3×3 zamiast plusa.', max: 1, cost: once(15000, 80), effect: () => 'obszar 3×3' },
  { id: 'h_feather', tool: 'hammer', x: 5, y: 2, req: [['h_safe', 3]], name: 'Czułe ramię', desc: 'Młot ryzykuje kość tylko w środku uderzenia.', max: 1, cost: once(12000, 60), effect: () => 'boczne pola nigdy nie uszkadzają kości' },
  { id: 'h_after', tool: 'hammer', x: 3, y: 3, req: [['h_crit', 2]], name: 'Wstrząs wtórny', desc: 'Krytyk młota odbija się drugim ciosem obok.', max: 3, cost: geo(16000, 2.3, 60, 50), effect: (l) => `${25 * l}% szansy na drugi cios po krytyku` },
  { id: 'h_quake', tool: 'hammer', x: 4, y: 3, req: [['h_area', 1]], name: 'Fala uderzeniowa', desc: 'Każde uderzenie młota wstrząsa całą warstwą.', max: 3, cost: geo(20000, 2.3, 80, 60), effect: (l) => `wszystkie pola tracą ${1.5 * l}% wytrzymałości (nigdy nie pękają od fali)` },
  { id: 'h_auto', tool: 'hammer', x: 5, y: 3, req: [['h_feather', 1]], name: 'Młot udarowy', desc: 'Młot sam uderza w pole pod kursorem — tylko prowadzisz go myszką.', max: 3, cost: geo(14000, 2.4, 60, 50), effect: (l) => `${[0, 1, 1.5, 2][l]} uderzenia na sekundę bez klikania` },
  { id: 'h_titan', tool: 'hammer', x: 4, y: 4, cap: true, req: [['h_quake', 1], ['h_after', 1]], name: 'Kafar', desc: 'Zwieńczenie gałęzi: młot, który kruszy góry.', max: 1, cost: once(250000, 1500), effect: () => 'siła młota ×2, krytyki młota ×1,5' },

  // ---------------- charges (columns 6–8)
  { id: 'x_unlock', tool: 'charge', x: 7, y: 0, name: 'Ładunek prochowy', desc: 'Nowe narzędzie: wybuch kruszy skałę 3×3. Pola z kośćmi zostają osłabione — odkopujesz je sam.', max: 1, cost: once(4000, 40), effect: () => 'odblokowany (klawisz 3), ładuje się 90 s' },
  { id: 'x_fuse', tool: 'charge', x: 6, y: 1, req: [['x_unlock', 1]], name: 'Szybki lont', desc: 'Ładunki szybciej się odnawiają.', max: 5, cost: geo(2500, 1.9, 5, 5), effect: (l) => `odnawianie −${12 * l}%` },
  { id: 'x_power', tool: 'charge', x: 8, y: 1, req: [['x_unlock', 1]], name: 'Mocniejszy proch', desc: 'Większy zasięg wybuchu.', max: 2, cost: geo(9000, 3, 40, 60), effect: (l) => (l === 1 ? 'zasięg: romb 13 pól' : 'zasięg: kwadrat 5×5') },
  { id: 'x_bag', tool: 'charge', x: 6, y: 2, req: [['x_fuse', 2]], name: 'Torba na ładunki', desc: 'Więcej ładunków w zapasie.', max: 3, cost: geo(8000, 2.3, 30, 30), effect: (l) => `${1 + l} ładunki w zapasie` },
  { id: 'x_crush', tool: 'charge', x: 8, y: 2, req: [['x_power', 1]], name: 'Kruszarka', desc: 'Wybuch zostawia więcej odłamków.', max: 3, cost: geo(7000, 2.2, 20, 20), effect: (l) => `odłamki z wybuchu ×${(1 + 0.5 * l).toFixed(1)}` },
  { id: 'x_chain', tool: 'charge', x: 7, y: 3, req: [['x_bag', 1], ['x_crush', 1]], name: 'Reakcja łańcuchowa', desc: 'Wybuch może odpalić drugi w innym miejscu.', max: 3, cost: geo(22000, 2.4, 90, 70), effect: (l) => `${20 * l}% szansy na drugi wybuch` },
  { id: 'x_mega', tool: 'charge', x: 7, y: 4, cap: true, req: [['x_chain', 2]], name: 'Ładunek głębinowy', desc: 'Zwieńczenie gałęzi: wybuch czuje cała warstwa.', max: 1, cost: once(250000, 1500), effect: () => 'odnawianie ×0,5, każdy wybuch osłabia całą warstwę o 25%' },

  // ---------------- georadar (columns 9–11)
  { id: 'r_res', tool: 'radar', x: 10, y: 0, name: 'Georadar', desc: 'Pokazuje, gdzie w skale coś leży — z każdym poziomem dokładniej.', max: 4,
    cost: (l) => ({ shards: [2500, 12000, 45000, 150000][l] ?? 0, pb: [25, 100, 300, 800][l] ?? 0 }),
    effect: (l) => ['', 'rozmyte strefy wokół kości (z pustą skałą dookoła)', 'węższe strefy, także bursztyn i minerały', 'prawie dokładne kontury w kolorach rodzaju', 'dokładne kontury wszystkich znalezisk'][l] },
  { id: 'r_glint', tool: 'radar', x: 9, y: 1, req: [['r_res', 1]], name: 'Czujnik kryształów', desc: 'Bursztyn i minerały błyskają nawet przez nietkniętą skałę.', max: 1, cost: once(9000, 50), effect: () => 'błyski przez całą skałę' },
  { id: 'r_sonar', tool: 'radar', x: 11, y: 1, req: [['r_res', 2]], name: 'Sonar', desc: 'Strefy kości na georadarze świecą kolorem rzadkości: od razu widać, gdzie leży coś cennego.', max: 1, cost: once(16000, 90), effect: () => 'kolor rzadkości w strefach kości' },
  { id: 'r_lucky', tool: 'radar', x: 9, y: 2, req: [['r_glint', 1]], name: 'Wykrywacz anomalii', desc: 'Złote błyski pojawiają się częściej.', max: 3, cost: geo(10000, 2.2, 40, 40), effect: (l) => `złote błyski ${Math.round(100 / (1 - 0.2 * l) - 100)}% częściej` },
  { id: 'r_rare', tool: 'radar', x: 11, y: 2, req: [['r_sonar', 1]], name: 'Analiza widmowa', desc: 'Namierza rzadsze okazy w skale.', max: 5, cost: geo(9000, 2, 40, 30), effect: (l) => `rzadkie kości +${10 * l}%` },
  { id: 'r_tomo', tool: 'radar', x: 10, y: 3, cap: true, req: [['r_res', 4], ['r_lucky', 1], ['r_rare', 2]], name: 'Tomograf', desc: 'Zwieńczenie gałęzi: skała przezroczysta jak szkło.', max: 1, cost: once(250000, 1500), effect: () => 'rzadkie kości ×1,5, minerały ×1,5, +5% jakości' },

  // ---------------- crews (columns 12–14)
  { id: 'k_speed', tool: 'crew', x: 13, y: 0, name: 'Lepsze kilofy', desc: 'Ekipy kopią szybciej.', max: 8, cost: geo(400, 1.65), effect: (l) => `tempo ekip +${10 * l}%` },
  { id: 'k_power', tool: 'crew', x: 12, y: 1, req: [['k_speed', 2]], name: 'Ciężkie dłuta', desc: 'Każde uderzenie ekipy jest mocniejsze.', max: 5, cost: geo(2000, 1.9, 0, 5), effect: (l) => `siła ekip +${25 * l}%` },
  { id: 'k_hire', tool: 'crew', x: 14, y: 1, req: [['k_speed', 3]], name: 'Nowy pracownik', desc: 'Dodatkowa ekipa na stanowisku.', max: 3, cost: geo(6000, 3, 30, 60), effect: (l) => `+${l} ${l === 1 ? 'ekipa' : 'ekipy'}` },
  { id: 'r_crew', tool: 'crew', x: 12, y: 2, req: [['k_power', 1], ['r_res', 1]], name: 'Mapy dla ekip', desc: 'Ekipy z georadarem częściej kopią tam, gdzie coś leży.', max: 3, cost: geo(6000, 2.1, 20, 20), effect: (l) => `+${8 * l}% celnych uderzeń ekip` },
  { id: 'k_sift', tool: 'crew', x: 14, y: 2, req: [['k_hire', 1]], name: 'Sito', desc: 'Z każdego pola zostaje więcej odłamków.', max: 5, cost: geo(5000, 2, 10, 10), effect: (l) => `odłamki +${20 * l}%` },
  { id: 'k_boss', tool: 'crew', x: 13, y: 3, req: [['r_crew', 1], ['k_sift', 1]], name: 'Brygadzista', desc: 'Ekipy czasem kruszą pole jednym ciosem (pola ze znaleziskami i tak zostawiają Tobie).', max: 3, cost: geo(20000, 2.3, 80, 60), effect: (l) => `${5 * l}% krytyków ekip` },
  { id: 'k_expo', tool: 'crew', x: 13, y: 4, cap: true, req: [['k_boss', 2], ['k_hire', 2]], name: 'Wielka ekspedycja', desc: 'Zwieńczenie gałęzi: całe obozowisko pracuje dla Ciebie.', max: 1, cost: once(250000, 1500), effect: () => 'tempo ekip ×2, odłamki od ekip ×2' },
];
export const TOOL_NODE_BY_ID = new Map(TOOL_NODES.map((n) => [n.id, n]));

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

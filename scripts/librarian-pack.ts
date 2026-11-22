// Builds the reference pack for the Librarian (docs/bibliotekarz/): everything the game holds, as plain markdown.
//   gra-stanowiska.md — the chapters (dig sites, oldest first) with their fauna
//   gra-drzewo.md     — the whole tree of life in the game: every clade with its Polish name and every genus
// Usage: npx tsx scripts/librarian-pack.ts

import fs from 'node:fs';
import { CLADES, GENERA, SITE_BY_ID, TAXA } from '../src/data/db';
import { EPOCHS, SITE_ORDER } from '../src/data/epochs';
import { SITE_UNLOCK } from '../src/game/content';
import { CLADE_LORE, GENUS_LORE } from '../src/data/lore';
import { STORY } from '../src/data/story';
import { ORIGIN, LAST, effChildren } from '../src/ui/treeData';

const HAB: Record<string, string> = { land: 'ląd', freshwater: 'słodka woda', marine: 'morze', air: 'powietrze' };
const FOOD: Record<string, string> = { meat: 'mięso', plants: 'rośliny', fish: 'ryby', plankton: 'plankton' };
const ma = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

// ---------------------------------------------------------------- sites
const S: string[] = ['# Stanowiska (rozdziały) i ich fauna', '', `Wygenerowano: ${new Date().toISOString().slice(0, 10)}. Kolejność = kolejność rozdziałów w grze (od najstarszych skał); etap N Bibliotekarza = rozdział N. Przy rodzaju: zakres w mln lat temu (pierwsze–ostatnie wystąpienie w PBDB), środowisko, dieta, rodzina. „opis” = ma już szczegółowy opis w grze (GENUS_LORE), „BRAK opisu” = trzeba napisać.`, '', 'Każde stanowisko ma dwie listy: **fauna miejscowa** (skamieniałości naprawdę z tych skał; rozdział zamyka się po znalezieniu ich wszystkich) i **goście epoki** (żyli w tym czasie i środowisku, ale ich skamieniałości pochodzą z innych miejsc; dodatkowa kolekcja).', ''];
SITE_ORDER.forEach((id, i) => {
  const s = SITE_BY_ID.get(id)!;
  S.push(`## Rozdział ${i + 1}: ${s.name} (id: ${id})`, '');
  S.push(`- ${s.country} · ${s.period} · ${ma(s.fromMa)}–${ma(s.toMa)} mln lat temu · formacje: ${s.formations.join(', ')}`);
  S.push(`- Odblokowanie: poziom parku ${SITE_UNLOCK[id]?.level}, ${SITE_UNLOCK[id]?.cost} monet`);
  S.push(`- Tytuł etapu w grze: „${EPOCHS[id]?.title ?? ''}”${STORY.chapters[id] ? ' · ma już przerywnik fabularny' : ' · brak przerywnika fabularnego'}`);
  S.push(`- Opis: ${s.description}`);
  for (const [label, list] of [['Fauna miejscowa', s.fauna.filter((f) => !f.guest)], ['Goście epoki', s.fauna.filter((f) => f.guest)]] as const) {
    if (!list.length) continue;
    S.push(`- ${label} (${list.length}):`);
    for (const f of [...list].sort((a, b) => b.occ - a.occ)) {
      const g = GENERA.get(f.genusId);
      if (!g) continue;
      S.push(`  - ${g.name} · ${ma(g.fromMa)}–${ma(g.toMa)} · ${HAB[g.habitat]} · ${FOOD[g.food]}${g.family ? ` · ${g.family}` : ''} · ${GENUS_LORE[g.name] ? 'opis' : 'BRAK opisu'}`);
    }
  }
  if (s.minorFossils?.length) S.push(`- Drobne skamieniałości (nie do wskrzeszenia): ${s.minorFossils.slice(0, 30).map((m) => m.name).join(', ')}${s.minorFossils.length > 30 ? ' …' : ''}`);
  S.push('');
});
fs.writeFileSync('docs/bibliotekarz/gra-stanowiska.md', S.join('\n'));

// ---------------------------------------------------------------- whole tree
const T: string[] = ['# Drzewo życia w grze (wszystkie klady i rodzaje)', '', `Razem ${TAXA.genera.length} rodzajów, ${TAXA.clades.length} kladów. Drzewo jak w danych gry (PBDB). Łańcuchy kladów bez polskiej nazwy, z jednym potomkiem, są zwinięte (pokazany najgłębszy). Format kladu: nazwa łacińska („polska”) · ranga · liczba rodzajów · zakres skamieniałości w grze · [opis]/[dlaczego] = ma już tekst. Rodzaje: nazwa (od–do mln lat, stanowiska; „—” = jeszcze na żadnym stanowisku).`, ''];
const walk = (id: number, depth: number) => {
  const c = CLADES.get(id)!;
  const pad = '  '.repeat(depth);
  const tags = [CLADE_LORE[c.name] ? '[opis]' : '', STORY.forks[c.name] ? '[dlaczego]' : ''].filter(Boolean).join(' ');
  T.push(`${pad}- ${c.name}${c.namePl ? ` („${c.namePl}”)` : ''} · ${c.rank} · ${c.leafCount} · ${ma(ORIGIN.get(id) ?? 0)}–${ma(LAST.get(id) ?? 0)}${tags ? ' ' + tags : ''}`);
  const kids = effChildren(id);
  const gen = kids.filter((k) => k.genus).map((k) => GENERA.get(k.id)!);
  if (gen.length) T.push(`${pad}    rodzaje: ${gen.map((g) => `${g.name} (${ma(g.fromMa)}–${ma(g.toMa)}, ${g.sites.length ? g.sites.map((sid) => (SITE_BY_ID.get(sid)!.fauna.find((x) => x.genusId === g.id)?.guest ? sid + ' (gość)' : sid)).join('/') : '—'})`).join('; ')}`);
  for (const k of kids) if (!k.genus) walk(k.id, depth + 1);
};
walk(TAXA.rootId, 0);
fs.writeFileSync('docs/bibliotekarz/gra-drzewo.md', T.join('\n'));
console.log('stanowiska', S.join('\n').length, 'drzewo', T.join('\n').length);

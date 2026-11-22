// Prints the fragment of the tree of life a dig site covers, exactly as the game shows it (chapter tree),
// for the Librarian prompt (docs/bibliotekarz/). Usage: npx tsx scripts/tree-outline.ts chengjiang [burgess …]

import { CLADES, GENERA } from '../src/data/db';
import { chapterTree, type ChapterNode } from '../src/game/story';
import { CLADE_LORE } from '../src/data/lore';
import { STORY } from '../src/data/story';
import { ORIGIN, LAST } from '../src/ui/treeData';

const sites = process.argv.slice(2);
if (!sites.length) { console.error('Podaj id stanowiska, np. chengjiang'); process.exit(1); }

for (const siteId of sites) {
  const root = chapterTree(siteId);
  console.log(`## Drzewo rozdziału: ${siteId}\n`);
  const walk = (n: ChapterNode) => {
    const c = CLADES.get(n.id)!;
    const pad = '  '.repeat(n.depth);
    const span = `${Math.round(ORIGIN.get(n.id) ?? 0)}–${Math.round(LAST.get(n.id) ?? 0)} mln`;
    const flags = [CLADE_LORE[c.name] ? 'ma opis' : 'BRAK opisu', STORY.forks[c.name] ? 'ma „dlaczego”' : 'BRAK „dlaczego”'].join(', ');
    console.log(`${pad}- ${c.name}${c.namePl ? ` („${c.namePl}”)` : ''} · ${c.rank} · ${n.all.length} rodz. tutaj · skamieniałości w grze: ${span} · ${flags}`);
    if (n.genera.length) console.log(`${pad}    rodzaje: ${n.genera.map((g) => GENERA.get(g)!.name).join(', ')}`);
    n.kids.forEach(walk);
  };
  walk(root);
  console.log('');
}

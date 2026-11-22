// "Who rules here": a bar chart of a chapter's animals by major group (the Librarian's "sklad-etapu" visual),
// counted from the site's fauna, with how many of each you have already found.

import { GENERA, SITE_BY_ID, ancestorIds } from '../../data/db';
import { CLADE_ID_BY_NAME } from '../../data/story/tree';
import type { GameState } from '../../game/state';
import { nameOf } from '../treeData';

/** major groups, most specific first: an animal counts toward the first group it belongs to */
const GROUPS = ['Trilobita', 'Radiodonta', 'Arthropoda', 'Onychophora', 'Scalidophora', 'Cephalopoda', 'Mollusca', 'Brachiopoda', 'Annelida', 'Echinodermata', 'Hemichordata', 'Vertebrata', 'Chordata', 'Porifera', 'Cnidaria', 'Ctenophora', 'Cambroernida'];

export function Composition({ s, siteId }: { s: GameState; siteId: string }) {
  const site = SITE_BY_ID.get(siteId);
  const rows = new Map<string, { total: number; found: number }>();
  for (const f of site?.fauna ?? []) {
    const g = GENERA.get(f.genusId);
    if (!g) continue;
    const anc = new Set(ancestorIds(g.parent));
    const grp = GROUPS.find((n) => { const id = CLADE_ID_BY_NAME.get(n); return id != null && anc.has(id); }) ?? 'inne';
    const r = rows.get(grp) ?? { total: 0, found: 0 };
    r.total++;
    if (s.settings.revealAll || s.discovered[g.id]) r.found++;
    rows.set(grp, r);
  }
  const list = [...rows.entries()].sort((a, b) => b[1].total - a[1].total);
  const max = Math.max(1, ...list.map(([, r]) => r.total));
  return (
    <div className="compo" role="img" aria-label="Skład fauny rozdziału według grup">
      {list.map(([grp, r]) => (
        <div key={grp} className="compo-row">
          <span className="compo-name">{grp === 'inne' ? 'inne' : nameOf(CLADE_ID_BY_NAME.get(grp)!)}</span>
          <span className="compo-bar"><i style={{ width: `${(r.total / max) * 100}%` }}><em style={{ width: `${(r.found / r.total) * 100}%` }} /></i></span>
          <span className="compo-n">{r.found}/{r.total}</span>
        </div>
      ))}
      <small className="muted">Na stanowisku {site?.name}: {site?.fauna.length ?? 0} rodzajów. Długość paska: ile rodzajów z tej grupy kryje stanowisko. Jaśniejsza część: ile już znalazłeś.</small>
    </div>
  );
}

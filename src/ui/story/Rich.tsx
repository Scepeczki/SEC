// Text from the Librarian with concept references: "…linieją (linienie)…" — the id in brackets becomes a small
// "concept" badge with the concept's short explanation on hover. Unknown hyphenated ids are dropped; other
// one-word brackets ("(kambr)") stay as they were.

import { BookOpen } from 'lucide-react';
import { CONCEPT_BY_ID } from '../../data/story';

export function Rich({ text }: { text: string }) {
  const parts = text.split(/\s*\(([a-z0-9]+(?:-[a-z0-9]+)*)\)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const c = CONCEPT_BY_ID.get(p);
        if (!c) return p.includes('-') ? null : ` (${p})`;
        return <span key={i} className="cref" title={`Pojęcie: ${c.name} — ${c.short}. Pełna karta w Encyklopedii, zakładka Pojęcia.`}><BookOpen className="ic" />{c.name}</span>;
      })}
    </>
  );
}

/** paragraphs of Rich text */
export function RichP({ text }: { text: string }) {
  return <>{text.split(/\n+/).map((t, i) => <p key={i}><Rich text={t} /></p>)}</>;
}

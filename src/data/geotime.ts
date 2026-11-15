// Geological time scale (ICS), Polish names and standard ICS colors.

export interface Period {
  id: string;
  namePl: string;
  era: 'Proterozoik' | 'Paleozoik' | 'Mezozoik' | 'Kenozoik';
  start: number; // Ma
  end: number; // Ma
  color: string;
}

export const PERIODS: Period[] = [
  { id: 'ediacaran', namePl: 'Ediakar', era: 'Proterozoik', start: 635, end: 538.8, color: '#FED96A' },
  { id: 'cambrian', namePl: 'Kambr', era: 'Paleozoik', start: 538.8, end: 485.4, color: '#7FA056' },
  { id: 'ordovician', namePl: 'Ordowik', era: 'Paleozoik', start: 485.4, end: 443.8, color: '#009270' },
  { id: 'silurian', namePl: 'Sylur', era: 'Paleozoik', start: 443.8, end: 419.2, color: '#B3E1B6' },
  { id: 'devonian', namePl: 'Dewon', era: 'Paleozoik', start: 419.2, end: 358.9, color: '#CB8C37' },
  { id: 'carboniferous', namePl: 'Karbon', era: 'Paleozoik', start: 358.9, end: 298.9, color: '#67A599' },
  { id: 'permian', namePl: 'Perm', era: 'Paleozoik', start: 298.9, end: 251.9, color: '#F04028' },
  { id: 'triassic', namePl: 'Trias', era: 'Mezozoik', start: 251.9, end: 201.4, color: '#812B92' },
  { id: 'jurassic', namePl: 'Jura', era: 'Mezozoik', start: 201.4, end: 145, color: '#34B2C9' },
  { id: 'cretaceous', namePl: 'Kreda', era: 'Mezozoik', start: 145, end: 66, color: '#7FC64E' },
  { id: 'paleogene', namePl: 'Paleogen', era: 'Kenozoik', start: 66, end: 23.03, color: '#FD9A52' },
  { id: 'neogene', namePl: 'Neogen', era: 'Kenozoik', start: 23.03, end: 2.58, color: '#FFE619' },
  { id: 'quaternary', namePl: 'Czwartorzęd', era: 'Kenozoik', start: 2.58, end: 0, color: '#F9F97F' },
];

export function periodAt(ma: number): Period {
  for (const p of PERIODS) if (ma <= p.start && ma >= p.end) return p;
  return ma > PERIODS[0].start ? PERIODS[0] : PERIODS[PERIODS.length - 1];
}

/** "Kreda" or "Jura – Kreda" for a range. */
export function periodLabel(fromMa: number, toMa: number): string {
  const a = periodAt(fromMa);
  const b = periodAt(toMa);
  return a.id === b.id ? a.namePl : `${a.namePl} – ${b.namePl}`;
}

export function formatMa(ma: number): string {
  if (ma >= 10) return `${Math.round(ma)} mln lat`;
  if (ma >= 1) return `${ma.toFixed(1)} mln lat`;
  return `${Math.round(ma * 1000)} tys. lat`;
}

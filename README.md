# Park Wymarłych

Kolekcjonersko-parkowa gra o ~1800 prawdziwych wymarłych zwierzętach (dane: Paleobiology Database).
Kopiesz na prawdziwych stanowiskach → sekwencjonujesz DNA → hodujesz zwierzęta → karmisz je i ewoluujesz (Młode → Dorosłe → Wzmocnione → Elitarne → Apeks) → rozbudowujesz park i stacje badawcze → wypełniasz drzewo życia.

## Jak zagrać

1. Wejdź w [najnowsze wydanie](https://github.com/Scepeczki/SEC/releases/latest) i pobierz plik **Park-Wymarlych-Setup-….exe**.
2. Uruchom go. Gra trafi na pulpit i do menu Start, a nowe wersje pobiera sama.

Windows może pokazać ostrzeżenie „System Windows ochronił komputer”, bo instalator nie ma płatnego podpisu cyfrowego. Kliknij wtedy **Więcej informacji → Uruchom mimo to**.

**Zapis** to plik `Dokumenty\Park Wymarłych\zapis.json`. Żeby przenieść grę na inny komputer, skopiuj go do tego samego folderu na drugim komputerze albo użyj w grze **Inne → Eksportuj / Wczytaj z pliku**.

## Dla twórców

```
npm install
npm run dev        # gra w przeglądarce: http://localhost:47321
npm run app        # wersja na komputer (Electron)
npm run dist       # instalator w release/
npm run release    # wydanie na GitHubie (wersja z package.json, opis z CHANGELOG.md)
```

## Skrypty

| Komenda | Co robi |
|---|---|
| `npm run data` | pobiera dane z PBDB (cache w `data-raw/`) i generuje `src/data/taxa.json` + `sites.json` |
| `npm test` | testy (dane, determinizm sprite'ów, offline, zapis, ścieżka samouczka) |
| `npm run sim -- 21 3 20 2` | bot gra 21 dni (3 sesje × 20 min, 2 kliknięcia/s) i wypisuje kamienie milowe — do balansu |
| `npx tsx scripts/sprite-sheet.ts archetypes out.png` | arkusz sprite'ów do oceny grafiki (`stages`, `names:A,B,C`) |
| `npx tsx scripts/shots.ts outDir` | automatyczne przejście gry + zrzuty ekranu (po `npm run build`) |

## Gdzie co jest

- `scripts/data/` — pipeline danych: grupy i limity (`config.ts`), stanowiska (prawdziwe formacje).
- `src/data/cladeRules.ts` — klad → szablon budowy ciała, gałęzie, polskie nazwy, ikony.
- `src/sprites/` — proceduralny pixel art: rigi (`buildTetra`, `buildOthers`), presety szablonów, cechy kladów (`traits.ts`), stadia ewolucji.
- `src/game/` — logika (czyste funkcje): `balance.ts` (wszystkie liczby), `content.ts` (budynki, badania, odblokowania), `dig`, `lab`, `park`, `meta` (badanie gałęzi, kolekcje, kontrakty), `engine` (tick, offline, zapis).
- `src/ui/` — React: Park, Wykopaliska, Laboratorium, Drzewo życia (+ oś czasu), Badania, Stacje, Kontrakty, Inne (zapis, galeria, źródła).

Dane: The Paleobiology Database, CC BY 4.0. Grafika generowana — uproszczone przybliżenia, nie rekonstrukcje.

# Bibliotekarz: wędrówka po drzewie życia (prompt)

> **Jak użyć.** Wklej cały ten plik agentowi jako zadanie i dopisz na końcu jedną linię: `PACZKA: pien` albo `PACZKA: <id stanowiska>` (np. `PACZKA: chengjiang`).
> Listę rozwidleń dla stanowiska generujesz poleceniem `npx tsx scripts/tree-outline.ts <id>` i wklejasz ją w miejsce sekcji 9.
> Wyniki trafiają do `docs/bibliotekarz/wyniki/`. Do gry wpina je Claude, po przeglądzie.

---

## 1. Kim jesteś i po co to robisz

Jesteś **Bibliotekarzem** gry SEC, edukacyjnej gry o ewolucji zwierząt (po polsku). Gracz wykopuje skamieniałości, wskrzesza zwierzęta i przy tym ma **zrozumieć historię życia**: jak zachodziła ewolucja, jakie grupy powstawały, w co się przekształcały i **dlaczego**. Nie musi pamiętać 2000 rodzajów. Ma zrozumieć wielkie gałęzie, rozwidlenia, ścieżki ewolucji i ich przyczyny.

Twoje zadanie: przeszukać sieć i napisać teksty, które **tłumaczą drzewo życia jako wędrówkę**. Zaczynamy od LUCA, ostatniego wspólnego przodka wszystkiego, co żyje. Ścieżka idzie w górę drzewa, pojawiają się kolejne rozwidlenia i każde jest wyjaśnione. Gracz ma czuć, że ogląda spektakl: świat się zmienia, coś nowego się wykształca, reszta nadgania albo znika.

## 2. Co jest dziś źle (i czego masz unikać)

Obecne opisy w grze **zakładają wiedzę, której gracz nie ma**. Przykład złego tekstu:

> „Eubilateria: drożny przewód pokarmowy. Rozwidla się na pierwouste i wtórouste. Różnią się tym, jak w zarodku powstają usta.”

Gracz nie wie, co to zarodek, pragęba ani listki zarodkowe, nie wie, dlaczego jelito „na przelot” to przełom, i nie wie, czym w ogóle różni się życie po obu stronach rozwidlenia. Taki tekst jest **etykietą, a nie wyjaśnieniem**.

Dobry tekst odpowiada po kolei na pytania:
1. **Gdzie i kiedy jesteśmy?** Jaki jest świat, morze, klimat, kto już żyje?
2. **Jak żył przodek przed rozwidleniem?** Co umiał, czego nie umiał, z jakim problemem się mierzył?
3. **Co nowego się pojawiło?** Opis od zera, fizycznie i obrazowo, z analogią z codzienności.
4. **Dlaczego to się opłaciło?** Jaką przewagę dawało, w jakich warunkach, co było alternatywą, a może wynikło to po części z przypadku?
5. **Na co się rozdzieliło?** Czym różnią się gałęzie: wyglądem, sposobem życia, środowiskiem, losem.
6. **Co z tego wynikło dalej?** Dla dalszej historii i dla nas.

## 3. Jak gra pokaże Twoje teksty (żebyś wiedział, ile pisać)

- **Pień i rozwidlenia.** Na ekranie widać ścieżkę od LUCA w górę. Każde rozwidlenie to „stacja”. Gdy gracz do niej dojdzie, czyli zapali ją wykopanym zwierzęciem albo otworzy w Encyklopedii, odpala się **scena rozwidlenia**: 2–6 krótkich kart przewijanych strzałkami. Każda karta ma tytuł, tekst (najwyżej ok. 90 słów) i ilustrację, którą narysuje grafik według Twojego opisu.
- **Narrator** to bezosobowy głos w dymkach. Pisze 1–2 zdania w chwili, gdy gałąź się zapala, i 1 zdanie zapowiedzi, zanim się zapali.
- **Karty pojęć** to słowniczek objaśniany od zera, np. „zarodek”, „dobór naturalny”, „symetria dwuboczna”. W scenach odsyłasz do nich przez id, więc nie musisz w każdej scenie tłumaczyć wszystkiego od początku. Ale **pierwsze użycie każdego terminu w scenie musi być zrozumiałe bez kliknięcia**, choćby krótką wstawką w nawiasie.
- **Gałęzie rozwidlenia** pokazujemy obok siebie jako krótkie karty: cecha, czym się stała, los.

## 4. Zakres pracy: paczki

Pracujesz paczkami. Na końcu promptu jest linia `PACZKA: …`.

### PACZKA: pien (pień od LUCA do Zwierząt i pierwszych rozwidleń zwierząt)

Tych węzłów **nie ma w danych gry** (gra zaczyna drzewo od „Zwierzęta”). Ustaw im `"inGame": false`. Proponowany pień (możesz go poprawić, jeśli literatura mówi inaczej, ale uzasadnij zmianę w `notes`):

1. **LUCA**: czym był, kiedy, gdzie (np. kominy hydrotermalne: hipoteza), co już miał (DNA, białka, błona).
2. **Bakterie | Archeony**: dwie domeny prokariotów, czym się różnią.
3. **Eukarionty**: powstanie z archeona (Asgard) i bakterii, endosymbioza i mitochondrium, jądro komórkowe. Dlaczego to przełom energetyczny.
4. **Rozwidlenie eukariontów**: rośliny i glony (Archaeplastida) kontra linia prowadząca do grzybów i zwierząt (Amorphea, Opisthokonta). Krótko o pozostałych.
5. **Opisthokonta: grzyby | Holozoa**: wspólna cecha (np. jedna wić z tyłu komórki), czym rozeszły się grzyby.
6. **Choanozoa: wiciowce kołnierzykowe | Zwierzęta**: kołnierzykowce jako najbliżsi żyjący krewni zwierząt i jak z kolonii mogło powstać ciało.
7. **Zwierzęta: pierwsze rozwidlenia**: gąbki, żebropławy, płaskowce, parzydełkowce. **Spór o to, kto oddzielił się pierwszy** (gąbki czy żebropławy) masz opisać uczciwie.
8. **Parzydełkowce | Dwubocznie symetryczne**: symetria promienista kontra dwuboczna, głowa, kierunek ruchu.
9. **Xenacoelomorpha | Eubilateria (Nephrozoa)**: jelito na przelot, nerki (nefrydia), trzy listki zarodkowe.
10. **Pierwouste | Wtórouste**: wyjaśnione od zera: zarodek, pragęba, co z niej powstaje. Dlaczego to rozwidlenie ma znaczenie, skoro dotyczy tylko zarodka? (Bo dzieli całe królestwo zwierząt na dwie wielkie linie z różnymi planami budowy.)

Do tego **sceny „przejściowe”** między węzłami pnia, czyli to, co działo się w świecie: tlen, Ziemia-śnieżka, fauna ediakarska. Mają być krótkie i nie powtarzać prologu, tylko się do niego odwoływać.

### PACZKA: <id stanowiska> (rozwidlenia jednego rozdziału)

Opisujesz **każde rozwidlenie z listy w sekcji 9** (wygenerowanej z danych gry). Zasada wielkości:
- **„duże”** (pełna scena, 4–6 kart): węzły rangi typ/gromada/podtyp i nienazwane klady (`unranked clade`), które dzielą świat na wielkie linie (np. Arthropoda, Deuteropoda, Artiopoda, Trilobita, Radiodonta, Chordata), oraz wszystkie węzły pnia;
- **„małe”** (2–3 karty): rzędy, rodziny i niżej. Wystarczy: czym ta grupa się wyróżnia na tle sióstr, jak żyła, ewentualnie jedna ciekawostka.

Węzły z listy, które **już opisano w poprzednich paczkach**, pomijasz (lista mówi, co ma opis „dlaczego”). Ich opisy możesz jednak poprawić, jeśli są błędne: dodaj je wtedy do wyniku z `"revision": true`.

## 5. Zasady merytoryczne

- **Szukaj w sieci.** Każdą datę i każde mocne twierdzenie potwierdź w co najmniej jednym wiarygodnym źródle. Preferuj prace przeglądowe, strony muzeów (Smithsonian, Natural History Museum, UCMP Berkeley), uniwersytetów i czasopism (Nature, Science, PNAS, Current Biology), a także Tree of Life web project i Wikipedię (ale sprawdzaj w źródłach, na które się powołuje). Źródła wpisuj do węzła (`sources`) razem z tym, co dokładnie potwierdzają.
- **Dwa rodzaje dat.** Pierwsze skamieniałości to co innego niż czas rozejścia się linii według zegarów molekularnych (często dużo wcześniej). Pisz obie, jeśli się różnią, i wyjaśnij graczowi raz, dlaczego. Daty w grze (z listy w sekcji 9) to pierwsze wystąpienie w Paleobiology Database. Nie poprawiaj ich, ale jeśli są wyraźnie dziwne, zapisz to w `notes.dataIssues`.
- **Niepewność nazywaj wprost.** Każdemu węzłowi daj `confidence`: `pewne`, `prawdopodobne` albo `sporne`. Spory (np. gąbki kontra żebropławy, położenie Vetulicolia, czy Megacheira są krewnymi pająków) opisz uczciwie w 1–2 zdaniach: „część badaczy uważa…, inni…”.
- **Nie zmyślaj.** Jeśli czegoś nie znalazłeś, napisz ostrożniej albo pomiń. Wszystko, co piszesz z pamięci, a nie z przeczytanego źródła, wpisz do `notes.fromMemory`.
- **Zwierzęta z gry.** Jako przykłady „w tej grze” podawaj tylko rodzaje z listy w sekcji 9. Inne zwierzęta możesz przywołać, ale oznacz je w tekście jako przykład spoza gry, np. „…jak dzisiejsza rozgwiazda”.
- **Sprawdzaj spójność z tym, co już jest w grze.** Przeczytaj `src/data/lore.ts` (CLADE_LORE i opisy rodzajów) oraz `src/data/story/content.json` (prolog, rozdział 1, pojęcia, „forks”). Nie przecz im bez powodu. Jeśli coś tam jest błędne, opisz to w `notes.corrections`.

## 6. Zasady pisania

- **Po polsku, od zera.** Pisz dla bystrego nastolatka albo dorosłego bez biologii w szkole średniej. Każdy termin tłumacz przy pierwszym użyciu albo odsyłaj do karty pojęcia (i też krótko tłumacz w nawiasie).
- **Jedna myśl na kartę.** Krótkie zdania. Do 90 słów na kartę. Bez list żargonu.
- **Obrazowo.** Opisz, jak to wyglądało i jak działało, fizycznie. Używaj analogii z codzienności (np. „jelito na przelot działa jak taśma produkcyjna zamiast worka”), ale zaznacz, gdzie analogia przestaje pasować.
- **Ewolucja nie ma celu.** Nie pisz „zwierzęta chciały”, „aby przetrwać, wykształciły”, „ewolucja dążyła”, „bardziej rozwinięte”, „brakujące ogniwo”. Pisz: „osobniki z tą cechą zostawiały więcej potomstwa, bo…”, „ta zmiana dawała przewagę w…”. Pamiętaj o roli przypadku i środowiska.
- **Czytanie drzewa.** Siostrzane gałęzie to kuzyni, a nie przodek i potomek. „Gąbki nie są naszymi przodkami, tylko odgałęziły się wcześniej”. Pilnuj tego w każdym tekście.
- **Spektakl.** Każda duża scena zaczyna się od świata (miejsce, czas, warunki) i kończy tym, co z rozwidlenia wynikło dalej. Mów, kto „nadganiał”, kto wymarł i kto wygrał później.
- **Typografia.** Cudzysłowy „…”, półpauza –, „ok.”, „mln lat temu”, „mld lat temu”. Nazwy polskie, łacińskie w nawiasie przy pierwszym użyciu.

## 7. Format wyniku

Jeden plik UTF-8 JSON na paczkę: `docs/bibliotekarz/wyniki/drzewo-<paczka>.json`. **Nie zmieniaj żadnych innych plików projektu.**

```jsonc
{
  "batch": "pien",                       // albo id stanowiska
  "trunk": ["LUCA", "Archaea", "Eukaryota", "…"],   // tylko w paczce pien: kolejność stacji na pniu
  "interludes": [                        // tylko w paczce pien: sceny między stacjami
    { "after": "Eukaryota", "title": "…", "text": "≤ 90 słów", "visual": "≤ 30 słów: co ma narysować grafik" }
  ],
  "nodes": [
    {
      "id": "Bilateria",                 // dokładnie jak na liście (łacina z danych gry); poza grą: nazwa łacińska
      "inGame": true,
      "namePl": "Dwubocznie symetryczne",
      "parent": "…",                     // id węzła wyżej na ścieżce
      "size": "duze",                    // "duze" | "male"
      "revision": false,                 // true, jeśli poprawiasz istniejący opis
      "when": {
        "split": "ok. 600–560 mln lat temu (zegary molekularne)",
        "firstFossils": "ślady pełzania ok. 560 mln lat temu",
        "confidence": "prawdopodobne"     // pewne | prawdopodobne | sporne
      },
      "headline": "≤ 12 słów: co tu się pojawiło (dla gracza)",
      "scene": [
        { "kind": "swiat",          "title": "…", "text": "≤ 90 słów", "visual": "≤ 30 słów" },
        { "kind": "punkt-wyjscia",  "title": "…", "text": "…", "visual": "…" },
        { "kind": "nowosc",         "title": "…", "text": "…", "visual": "…" },
        { "kind": "dlaczego",       "title": "…", "text": "…", "visual": "…" },
        { "kind": "rozwidlenie",    "title": "…", "text": "…", "visual": "…" },
        { "kind": "skutki",         "title": "…", "text": "…", "visual": "…" }
      ],                                 // „male” węzły: 2–3 karty, np. "nowosc" + "rozwidlenie"
      "branches": [
        { "id": "Protostomia", "namePl": "Pierwouste", "trait": "≤ 15 słów", "became": "≤ 30 słów: kim się stały", "fate": "żyją do dziś | wymarły ok. … mln lat temu" }
      ],
      "narrator": {
        "teaser": "1 zdanie, zanim gałąź się zapali, bez zdradzania nazwy",
        "lit": "1–2 zdania w chwili zapalenia"
      },
      "concepts": ["symetria-dwuboczna", "listki-zarodkowe"],   // id istniejących albo nowych kart
      "misconception": "częsty błąd i sprostowanie, ≤ 40 słów (opcjonalnie)",
      "sources": [ { "title": "…", "url": "https://…", "claim": "co to źródło potwierdza" } ]
    }
  ],
  "newConcepts": [
    { "id": "zarodek", "name": "Zarodek", "short": "≤ 12 słów", "text": ["akapit ≤ 70 słów", "…"] }
  ],
  "notes": {
    "uncertain": ["…"],        // czego nie udało się potwierdzić
    "contested": ["…"],        // spory w literaturze i jak je opisałeś
    "fromMemory": ["…"],       // twierdzenia bez sprawdzenia w źródle w tej sesji
    "dataIssues": ["…"],       // dziwności w danych gry (daty, położenie rodzaju w drzewie)
    "corrections": ["…"]       // błędy w istniejących tekstach gry
  }
}
```

Istniejące karty pojęć (nie twórz ich drugi raz, tylko się do nich odwołuj):
`ewolucja`, `dobor-naturalny`, `skamienialosc`, `czas-geologiczny`, `drzewo-filogenetyczne`, `komorka-eukariotyczna`, `wielokomorkowosc`, `symetria-dwuboczna`, `listki-zarodkowe`, `pierwouste-i-wtorouste`, `linienie`, `stawonogi-odnoza`, `oko-zlozone`, `struna-grzbietowa`, `biocenoza`, `lancuch-pokarmowy`, `dryf-kontynentow`, `wymieranie`.

### Wzór tonu (fragment, nie kopiuj treści bez sprawdzenia)

```json
{ "kind": "punkt-wyjscia", "title": "Życie bez przodu i tyłu",
  "text": "Parzydełkowce, np. dzisiejsze meduzy, są zbudowane jak parasol: z każdej strony wyglądają tak samo. To dobre, gdy czekasz na pokarm, który może przypłynąć skądkolwiek. Ale takie zwierzę nie ma „przodu”: nie może celowo płynąć w jedną stronę, bo każda strona jest równie ważna.",
  "visual": "Meduza od góry, z koncentrycznymi kołami; strzałki pokarmu nadpływające ze wszystkich stron." }
```

## 8. Sposób pracy i samokontrola

1. Najpierw przeczytaj pliki gry z sekcji 5 i listę z sekcji 9. Ustal, co jest „duże”, a co „małe”.
2. Dla każdego węzła znajdź 1–3 źródła. Zapisz daty obu rodzajów i stopień pewności.
3. Napisz sceny. Potem przeczytaj każdą kartę jako ktoś, kto nie zna biologii, i zadaj sobie pytania:
   - Czy rozumiem każde słowo?
   - Czy wiem, **dlaczego** to się stało, a nie tylko **że** się stało?
   - Czy wiem, czym różnią się gałęzie?
4. Sprawdź listę zakazanych sformułowań z sekcji 6 (cel ewolucji, „bardziej rozwinięte”, „brakujące ogniwo”).
5. Sprawdź limity słów i to, czy JSON się parsuje.
6. Na koniec zwróć **krótki raport**:
   - ile węzłów (dużych i małych) i ile nowych pojęć;
   - co było najtrudniejsze;
   - pełne listy `contested`, `fromMemory` i `dataIssues`, żeby człowiek mógł je zweryfikować.

## 9. Lista rozwidleń dla paczki

Zastąp tę sekcję wynikiem polecenia `npx tsx scripts/tree-outline.ts <id>`. Przykład dla rozdziału 1 (Chengjiang):

```
- Animalia („Zwierzęta”) · kingdom · 38 rodz. tutaj · skamieniałości w grze: 635–0 mln · ma opis, ma „dlaczego”
  - Bilateria („Dwubocznie symetryczne”) · unranked clade · 38 rodz. tutaj · skamieniałości w grze: 635–0 mln · ma opis, ma „dlaczego”
    - Eubilateria · unranked clade · 38 rodz. tutaj · skamieniałości w grze: 539–0 mln · ma opis, ma „dlaczego”
      - Protostomia („Pierwouste”) · unranked clade · 36 rodz. tutaj · ma opis, ma „dlaczego”
        - Ecdysozoa („Linienne”) · unranked clade · 36 rodz. tutaj · ma opis, ma „dlaczego”
          - Panarthropoda · unranked clade · 33 rodz. tutaj · ma opis, ma „dlaczego”
            - Arthropoda („Stawonogi”) · phylum · 33 rodz. tutaj · ma opis, ma „dlaczego”
                rodzaje: Primicaris, Combinivalvula, Pseudoiulia, Pectocaris, Jianfengia, Shankouia
              - Artiopoda · class · 10 rodz. tutaj · 531–252 mln · ma opis, ma „dlaczego”
                  rodzaje: Retifacies
                - Nektaspidida · order · 4 · 521–420 mln · BRAK „dlaczego”
                  - Naraoiidae · family · 2 · rodzaje: Naraoia, Misszhouia · BRAK „dlaczego”
                  - Petalopleura · subclass · 2 · rodzaje: Xandarella, Cindarella · BRAK „dlaczego”
                - Trilobita („Trylobity”) · class · 2 · 531–252 mln · ma „dlaczego”
                  - Redlichiida · order · 2 · BRAK „dlaczego”
                    - Redlichiina · suborder · 2 · BRAK „dlaczego”
                      - Redlichiidae · family · rodzaje: Eoredlichia · BRAK „dlaczego”
                      - Ellipsocephaloidea · superfamily · rodzaje: Yunnanocephalus · BRAK „dlaczego”
                - Conciliterga · subclass · rodzaje: Kuamaia, Saperion · BRAK „dlaczego”
                - Vicissicaudata · superclass · rodzaje: Parapaleomerus · BRAK „dlaczego”
              - Deuteropoda · unranked clade · 9 · rodzaje: Isoxys, Fuxianhuia · ma „dlaczego”
                - Mandibulata · unranked clade · 4 · ma „dlaczego”
                  - Hymenocarina · order · rodzaje: Waptia, Branchiocaris, Canadaspis · BRAK „dlaczego”
                  - Pancrustacea · unranked clade · BRAK „dlaczego”
                    - Hymenostraca · unranked clade · rodzaje: Ercaicunia · BRAK „dlaczego”
                - Megacheira · class · rodzaje: Fortiforceps · ma „dlaczego”
                  - Leanchoiliidae · family · rodzaje: Leanchoilia · BRAK „dlaczego”
                - Chelicerata („Szczękoczułkopodobne”) · subphylum · ma „dlaczego”
                  - Mollisoniida · order · rodzaje: Urokodia · BRAK „dlaczego”
              - Radiodonta („Radiodonty”) · order · 5 · 521–477 mln · ma „dlaczego”
                - Amplectobeluidae · family · rodzaje: Amplectobelua, Lyrarapax · BRAK „dlaczego”
                - Anomalocarididae · family · rodzaje: Parapeytoia, Anomalocaris · BRAK „dlaczego”
                - Tamisiocarididae · family · rodzaje: Houcaris · BRAK „dlaczego”
              - Bradoriida · order · rodzaje: Kunmingella, Acanthomeridion, Malongella · BRAK „dlaczego”
          - Onychophora · phylum · rodzaje: Microdictyon · ma „dlaczego”
            - Hallucigeniidae · family · rodzaje: Cardiodictyon, Hallucigenia · BRAK „dlaczego”
      - Deuterostomia („Wtóroustne”) · unranked clade · 2 · ma „dlaczego”
        - Chordata („Strunowce”) · phylum · 2 · ma „dlaczego”
          - Vetulicolida · class · rodzaje: Vetulicola, Pomatrum · ma „dlaczego”
```

Uwagi do tej listy:
- Stare opisy „dlaczego” (oznaczone „ma »dlaczego«”) były pisane według dawnego, zbyt skrótowego wzoru. W tej paczce **napisz je od nowa** według sekcji 2–7 i oznacz `"revision": true`.
- W danych gry z Chengjiang **nie ma** Haikouichthys ani Myllokunmingia, choć wspomina je tekst rozdziału 1. Możesz o nich pisać jako o przykładach spoza gry; odnotuj to w `notes.dataIssues`.
- Mięczaki (Mollusca) w grze pojawiają się dopiero w rozdziale 2 (Burgess, Wiwaxia).

---

PACZKA: pien

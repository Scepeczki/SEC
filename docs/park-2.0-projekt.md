# Park 2.0: projekt przebudowy

Hybryda propozycji z artifactu „Park Wymarłych — propozycje interfejsu”: archipelag (B) + duża mapa wyspy (A) + tryb budowy (C) + wnętrze wybiegu (D), w jednym ciągłym widoku z płynnym przybliżaniem. Do tego mechanika zbierania klikiem jak w Jurassic World: The Game.

Liczby w tym pliku są startowe. Ostateczne ustawi się w `balance.ts` po symulacjach (`npm run sim`).

---

## 1. Mapa parku: jeden świat, płynne przybliżenie

- Cały park to **jedno morze z wyspami**. Bez osobnych ekranów: kamerą lata się po całości.
- **Przybliżenie od ok. 0,15× do 3×** (kółko myszy, przyciski +/−, gesty na touchpadzie). Przeciąganie myszą (albo WASD/strzałki) przesuwa widok.
  - **Daleko:** widać cały archipelag, sylwetki wysp, nazwy, ikonki „do zebrania” zbiorczo na wyspę (jak propozycja B).
  - **Średnio:** wyspa z budynkami i wybiegami, dymki z monetami i paszą do kliknięcia (A).
  - **Blisko:** szczegóły, zwierzęta chodzą po zagrodach, widać poziomy budynków (ozdoby, dachy).
- Szybkie skoki: pasek wysp w lewym górnym rogu (Wyspa 1 · Start, Wyspa 2…). Kliknięcie płynnie przelatuje kamerą.
- Grafika: widok z góry, lekko z ukosa (3/4), pixel art rysowany proceduralnie jak pole wykopalisk. Teren wyspy rysuje się raz do bufora, a co klatkę dorysowuje się tylko ruchome rzeczy (zwierzęta, dymki, efekty). Rysuje się tylko to, co widać na ekranie.

## 2. Wyspy

| Wyspa | Klimat (biom) | Rozmiar (pola) | Wymaga | Cena | Premia biomu |
|---|---|---|---|---|---|
| 1 · Start | łąka | 56×42 | — | darmowa | wybiegi lądowe +10% |
| 2 · Mokradła | bagna | 64×46 | poz. 5 | 8k | bagna +20% |
| 3 · Laguna Rafowa | rafa | 68×50 | poz. 9 | 40k | laguny +20% |
| 4 · Klify | skały, wiatr | 72×52 | poz. 14 | 250k | woliery +20% |
| 5 · Wyspa Wulkaniczna | wulkan | 84×60 | poz. 20 | 2M | wszystko +10% |
| 6 · Wielki Ląd | mieszany | 104×72 | poz. 28 | 20M | brak, za to dużo miejsca |

- Każdy typ habitatu da się postawić na każdej wyspie. Biom daje tylko premię i inny wygląd (trawa, trzciny, piasek i rafy, skały, czarna ziemia).
- **Teren do oczyszczenia zamiast działek.** Kupiona wyspa ma wolny środek, a resztę pokrywa dżungla, skały i bagno. Oczyszcza się je kawałkami (np. 4×4 pola) za monety. To zastępuje obecne „działki”: rozbudowa nadal kosztuje, ale widać ją fizycznie na mapie.
- Na każdej wyspie stoi **Przystań z bramą** (wejście dla zwiedzających). Wyspy łączy prom, więc niczego nie trzeba budować między wyspami.

## 3. Tryb budowy

- Włącza się przyciskiem „Buduj” albo klawiszem **B** (propozycja C). Na dole pasek kategorii: **Wybiegi · Budynki · Dla zwiedzających · Farmy · Ścieżki · Dekoracje · Teren**.
- Wybierasz rzecz, przy kursorze pojawia się **podgląd**: zielony, gdy da się postawić, czerwony z powodem w dymku („wystaje poza oczyszczony teren”, „zachodzi na ścieżkę”, „za mało monet”).
- **R** obraca, **Esc** anuluje, **X** włącza rozbiórkę (zwrot 50% kosztu, zwierzęta trafiają do Transportera).
- **Przesuwanie jest darmowe:** chwytasz postawiony budynek albo wybieg i przeciągasz. Wybieg przenosi się razem ze zwierzętami.
- **Ścieżki maluje się przeciąganiem** (jak pędzlem). Ścieżki mają kilka rodzajów: żwir, kostka, drewniany pomost (także na wodzie przy brzegu).
- Przyciąganie do siatki, siatka widoczna tylko w trybie budowy.

## 4. Wybiegi (habitaty) i zagrody

Cztery rodzaje jak teraz: **Wybieg** (ląd), **Bagno**, **Laguna**, **Woliera**. Odblokowanie bez zmian: poz. 1 / 3 / 6 / 9.

### Zagrody wewnątrz wybiegu

- Wybieg dzieli się na **zagrody** (parcele) rozdzielone wewnętrznym płotem. Zwierzęta z różnych zagród się nie mieszają.
- Nowy wybieg ma 2 zagrody. Kolejne **dokupuje się** do limitu zależnego od poziomu wybiegu.
- Zagroda ma pojemność w „miejscach”. Zwierzę zajmuje miejsca według rozmiaru, tak jak dziś: malutki i mały 1, średni 2, duży 3, olbrzymi 4.
- Zagroda może być:
  - **jednogatunkowa (stado):** każdy kolejny osobnik tego samego rodzaju daje +10% dochodu zagrody, maks. +30%.
  - **mieszana:** różne rodzaje razem, +5% za każdy rodzaj (zwiedzający lubią różnorodność). Reguła zgodności: **mięsożercy nie dzielą zagrody z innymi rodzajami** (z własnym rodzajem tak). Roślinożercy, rybożercy i planktonożercy mieszają się swobodnie.

### Poziom wybiegu = więcej miejsca w środku

Od 0.3.1 każdy wybieg zajmuje na mapie **8×8 pól na każdym poziomie**. Ulepszenie dokłada zagrody i miejsca w nich oraz zmienia wygląd, ale nie zajmuje więcej ziemi. Zwierzęta są małymi figurkami dopasowanymi do wielkości zagrody.

| Poziom | Maks. zagród | Miejsc w zagrodzie | Wygląd |
|---|---|---|---|
| 1 | 2 | 4 | drewniany płot |
| 2 | 3 | 5 | mocniejszy płot, więcej roślin |
| 3 | 4 | 6 | kamienny mur, poidło |
| 4 | 6 | 8 | mur + wieżyczka widokowa |
| 5 | 8 | 10 | ogrodzenie elektryczne, pełna roślinność |

Badania w zakładce Park dokładają: **Szersze zagrody** (+2 miejsca w każdej zagrodzie), **Dodatkowe przegrody** (+2 zagrody), **Rozległe wybiegi** (poziom 6: 10 zagród po 12 miejsc) i **Rezerwaty** (poziom 7: 12 zagród po 14 miejsc). **Ciężki sprzęt** obniża koszt oczyszczania terenu o 40%.

Wybiegi z zapisów 0.3.0 (wtedy poziom zmieniał wymiar) dostają rozmiar 8×8 w obrębie dawnego miejsca, przy tej samej ścieżce. Mniejsze, dla których zabrakło miejsca, zostają przy starym rozmiarze i rosną przy ulepszeniu, jeśli obok zrobi się miejsce.

### Zadowolenie zwierząt (0–100%)

Mnoży dochód wybiegu w zakresie ×0,75 do ×1,25. Rośnie od:
- poziomu wybiegu,
- dekoracji **wewnątrz** wybiegu (drzewa, skały, staw, kłody),
- dekoracji wokół wybiegu,
- braku ścisku (zagroda zapełniona do 100% daje lekki minus).

## 5. Przenoszenie zwierząt: proste i swobodne

- **Przeciągnij i upuść** wszędzie: zwierzę z mapy, z listy albo z widoku wybiegu na dowolną zagrodę. Podczas przeciągania pasujące zagrody świecą na zielono, a niepasujące na czerwono z powodem („Laguna — to zwierzę lądowe”, „brak miejsca: potrzeba 4, wolne 2”, „mięsożerca, zagroda mieszana”).
- **Transporter** (pasek na dole ekranu, jak schowek): zwierzę można „podnieść” do Transportera, przelecieć na inną wyspę i tam upuścić. Pomieści dowolnie dużo zwierząt, ale zwierzęta w nim nie zarabiają.
- **Lista zwierząt** (panel boczny): wyszukiwarka, filtry (wyspa, habitat, rzadkość, stadium), zaznaczanie wielu naraz, „Pokaż na mapie”, „Przenieś zaznaczone”.
- **Nowo wyklute zwierzę** trafia samo do najlepszej wolnej zagrody: najpierw do zagrody z tym samym rodzajem, potem do pustej. Jeśli nigdzie nie ma miejsca, czeka w Transporterze. **Synteza nie jest już blokowana przez brak miejsca.**

## 6. Budynki: najpierw postaw, potem ulepszaj

Wszystkie obecne stacje stają się **budynkami na mapie**. Działają dopiero po postawieniu, a ulepsza się je klikając budynek (albo jak dotąd z zakładki Stacje, która staje się listą z przyciskiem „Pokaż na mapie”). **Wygląd zmienia się z poziomem** (np. poz. 1 drewno, 5 cegła, 10 szkło i stal, 20 złote zdobienia).

### Stacje (jedna sztuka każdej, działają na cały park)

| Budynek | Wymiar | Uwagi |
|---|---|---|
| Centrum Ekspedycji | 4×3 | stoi od początku |
| Pracownia Preparacji | 3×3 | stoi od początku |
| Sekwenator DNA | 3×3 | stoi od początku |
| Wylęgarnia | 4×3 | stoi od początku |
| Centrum Badawcze | 4×4 | od poz. 3 |
| Laboratorium Mutacji | 3×3 | od poz. 4 |
| Muzeum | 5×4 | od poz. 2 |
| Centrum dla Zwiedzających | 4×3 | od poz. 2, stawia się przy bramie |

### Farmy (można mieć kilka, każda ma własny poziom)

| Farma | Wymiar | Daje |
|---|---|---|
| Hodowla | 4×3 | mięso |
| Szklarnia paleobotaniczna | 3×3 | rośliny |
| Akwakultura | 4×4, przy wodzie | ryby i plankton |

Farma **napełnia własny magazyn**. Gdy coś jest gotowe, nad budynkiem pojawia się dymek z ikoną paszy. **Kliknięcie zbiera** (pasza leci do górnego paska).

### Dla zwiedzających (nowe; można mieć kilka)

| Budynek | Wymiar | Od poz. | Co robi |
|---|---|---|---|
| Kiosk z pamiątkami | 2×2 | 1 | monety |
| Bar z przekąskami | 2×2 | 2 | monety |
| Toalety | 2×2 | 3 | +zadowolenie zwiedzających: sklepy w promieniu zarabiają więcej |
| Restauracja | 4×3 | 6 | monety (dużo) |
| Punkt widokowy | 3×3 | 8 | +urok okolicy |
| Balon / kolejka gondolowa | 4×4 | 12 | duża atrakcja: monety + urok |
| Hotel | 5×4 | 18 | monety + dłuższa praca offline |

Dochód sklepów zależy od **popularności wyspy** (ile zarabiają jej zwierzęta). Dzięki temu sklep na pustej wyspie nic nie da, a balans sam rośnie razem z kolekcją.

## 7. Zbieranie klikiem (jak w JW: The Game)

- **Wybiegi** zbierają utarg z biletów do własnej kasy, **sklepy** monety, **farmy** paszę.
- Każdy ma pojemność (np. 1 h produkcji, więcej po ulepszeniach). Gdy coś się uzbiera, nad obiektem wyskakuje dymek z ikoną, który rośnie i świeci, gdy magazyn jest pełny.
- **Kliknięcie zbiera.** Monety wylatują i lecą do licznika na górze, z dźwiękiem i liczbą „+1,2k”.
- **Zbiera się zawsze pojedynczo, obiekt po obiekcie.** Przy dalekim przybliżeniu nad wyspą widać tylko znacznik „jest coś do zebrania”. Kliknięcie go przybliża kamerę do wyspy, a nie zbiera.
- Badanie **Automatyczne kasy** (już istnieje) zmienia się w automatyczne zbieranie z całego parku, czyli wygodę na później.
- Offline magazyny napełniają się do pełna i czekają.

Obecna wspólna „Kasa” w górnym pasku znika. Jej rolę przejmują kasy poszczególnych wybiegów.

## 8. Ścieżki i dojście

- Zwiedzający chodzą tylko ścieżkami od bramy.
- **Wybieg i sklep muszą stykać się ze ścieżką połączoną z bramą.** Bez tego nie zarabiają, a nad nimi świeci ikonka „brak dojścia”. Stacje i farmy ścieżek nie potrzebują.
- Na ścieżkach chodzą mali zwiedzający (czysto dla ozdoby; ich liczba pokazuje popularność wyspy).

## 9. Dekoracje

- **Natura:** drzewa (kilka gatunków prehistorycznych: araukaria, miłorząb, paproć drzewiasta, sagowiec), krzewy, kwiaty, skały, staw, wodospad.
- **Park:** ławki, latarnie, fontanna, rzeźby dinozaurów, tablice informacyjne, kwietniki, żywopłot.
- **Do wnętrza wybiegów:** kłody, głazy, pnie, wodopój, gniazdo, trzcinowisko (bagno), rafa (laguna), skalna półka (woliera).
- Każda dekoracja ma **urok** działający w promieniu kilku pól. Urok podnosi zadowolenie wybiegów i zarobek sklepów. Suma ma limit, więc zasypanie wszystkiego dekoracjami nie psuje balansu.
- Część dekoracji można zdobyć tylko ze skrzyń epok i kontraktów (powód, żeby je otwierać).

## 10. Widok wybiegu od środka (propozycja D)

Podwójne kliknięcie albo „Wejdź do wybiegu” (Enter):
- Scena z boku z zagrodami obok siebie, rozdzielonymi płotkami. Zwierzęta chodzą, pływają lub latają (jak dziś).
- Pod sceną kolumna dla każdej zagrody z kartami zwierząt. Karty **przeciąga się między zagrodami**.
- Panel: mieszkańcy, zadowolenie i jego źródła, ulepszenie (co da następny poziom), dekoracje wewnętrzne do przeciągnięcia na scenę, kasa wybiegu i przycisk „Zbierz”.
- Kliknięcie zwierzęcia otwiera obecny panel: karmienie, ewolucja, encyklopedia, wypuszczenie.
- Strzałki przechodzą do poprzedniego i następnego wybiegu.

## 11. Układ ekranu Park

- **Cała powierzchnia to mapa.**
- Lewy górny róg: pasek wysp + skrót statystyk (zwierzęta, dochód/s, zadowolenie).
- Prawa strona: **panel zaznaczenia** (wybieg / budynek / zwierzę / wyspa / pole terenu) z akcjami. Pojawia się tylko gdy coś jest zaznaczone.
- Dół: pasek budowy (w trybie budowy) albo Transporter (gdy coś w nim jest).
- Lewy dolny róg: przybliżanie +/−, „wyśrodkuj”.
- „Jak zacząć” zostaje jako zwijana lista zadań na pierwsze minuty.

## 12. Połączenie z resztą gry

- **Laboratorium:** synteza bez blokady miejsca (patrz punkt 5).
- **Kontrakty:** dochodzą nowe rodzaje: „postaw X”, „stado 3 osobników”, „zagroda mieszana z 3 rodzajami”, „zadowolenie 90% na wybiegu”.
- **Skrzynie epok:** mogą dawać dekoracje.
- **Sława:** dochodzi za nowe budynki, ulepszenia i pierwszą zagrodę mieszaną.
- **Badania (Park i Logistyka):** zostają, część zmienia znaczenie, np. „Kolejka gondolowa” odblokowuje budynek zamiast dawać dłuższą kasę.

## 13. Zapisy graczy (migracja)

Stare zapisy przenoszą się same. Przy pierwszym uruchomieniu nowej wersji:
- wszystkie habitaty stają się wybiegami na Wyspie 1 (poziom dobrany tak, żeby zmieściły się te same zwierzęta),
- wszystkie zbudowane stacje stają na mapie z tymi samymi poziomami,
- gra sama układa je w schludne rzędy, prowadzi ścieżki do bramy i oczyszcza tyle terenu, ile potrzeba (za darmo),
- pieniądze wydane na działki wracają jako monety,
- dalej gracz może wszystko poprzestawiać.

## 14. Kolejność budowy

1. **Logika** (bez grafiki): wyspy, siatka, kolizje, ścieżki i połączenia, zagrody, przenoszenie, Transporter, magazyny i zbieranie, migracja zapisów, testy.
2. **Mapa:** renderer, kamera, przybliżanie, archipelag, zaznaczanie, panel boczny, zbieranie klikiem z animacją.
3. **Tryb budowy:** pasek, podgląd, obrót, przesuwanie, rozbiórka, malowanie ścieżek, oczyszczanie terenu.
4. **Wnętrze wybiegu:** zagrody, przeciąganie, lista zwierząt, zadowolenie, dekoracje wewnątrz.
5. **Grafika:** pixel art każdego budynku z wyglądem zależnym od poziomu, dekoracje, zwiedzający, efekty, dźwięki.
6. **Balans** (symulator), samouczek, CHANGELOG, wydanie **0.3.0**.

Po każdym etapie gra działa i przechodzi testy.

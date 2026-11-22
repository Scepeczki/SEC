# Wykopaliska 2.0: reakcje łańcuchowe

Kopanie przestaje być samym klikaniem. Każda warstwa to mała łamigłówka: część kamieni ma **modyfikatory**, a rozbity kamień z modyfikatorem odpala kolejne. Wszystko, co pęknie z jednego Twojego rozbicia, to jedna **reakcja (combo)**. Im dłuższa, tym większy mnożnik nagród.

Gracz sam decyduje, jak bardzo zależy mu na rozwiązaniu warstwy. Planujący buduje długie łańcuchy i bije rekordy, łącznie z całą warstwą jednym uderzeniem. Inny gracz rozbija modyfikatory, jak leci, i też czuje postęp.

Liczby w tym pliku są startowe. Wszystkie siedzą w [src/game/tools.ts](../src/game/tools.ts), [src/game/mods.ts](../src/game/mods.ts) i [src/game/dig.ts](../src/game/dig.ts).

## 1. Zasady

- Kamień ma wytrzymałość, więc pędzlem rozbija się go kilkoma pociągnięciami. **Reakcja łamie kamienie od razu**, bez względu na wytrzymałość. Głębiej skała jest twardsza, więc reakcje stają się coraz cenniejsze.
- Reakcja rozchodzi się **falami**. Fala 0 to kamienie rozbite pędzlem, a fala 1 to to, co one odpaliły. Na ekranie każda fala pęka po kolei (90 ms), z dźwiękiem coraz wyższym.
- **Podgląd:** po najechaniu na kamień plansza pokazuje, co pęknie, jeśli go rozbijesz. Kolor zależy od fali, a w dymku widać liczbę pól, fal i mnożnik. Podgląd jest zawsze dokładny, bo Rezonans działa deterministycznie.
- Znaleziska (kości, minerały, bursztyn) wypadają także z reakcji. Modyfikatory pojawiają się tylko na zwykłej skale, nigdy na polu ze znaleziskiem.

## 2. Modyfikatory w skale (gałąź „Skała”)

Nowa warstwa zaczyna się z modyfikatorami, a ich częstość rośnie z poziomem węzła.

| Modyfikator | Co robi |
|---|---|
| **Iskra** (strzałka) | niszczy 2 pola w kierunku strzałki (Długa iskra: 3–4) |
| **Ładunek** | wybuch 3×3 (zwieńczenie: zaokrąglone 5×5) |
| **Zwornik** | rozbity jako ostatni kamień w swoim wierszu zawala całą kolumnę |
| **Żyła** | rozsadza każdy kamień, który dotyka pustki połączonej z tym polem. Im więcej wykopane, tym więcej zabiera |
| **Rezonans** | odpala 1–2 najbliższe inne kamienie z modyfikatorami |
| **Kryształ** | sam nic nie niszczy, ale pęknięty w reakcji podwaja jej mnożnik |

## 3. Własne modyfikatory (gałąź „Ręka geologa”)

Kilka użyć na warstwę. Klawisze 2–6, a Esc albo prawy przycisk myszy anuluje.

| Narzędzie | Użycie |
|---|---|
| **Ładunek** | podłóż pod dowolny kamień bez modyfikatora |
| **Połącz** | dwa dowolne kamienie: gdy pęknie jeden, pęka drugi (przerzuca reakcję przez całą warstwę) |
| **Obróć** | obraca strzałkę o 90° |
| **Przesuń** | przenosi modyfikator na inny kamień |
| **Kopiuj** | powiela modyfikator (oryginał zostaje) |

**Oszczędna ręka** oddaje po jednym użyciu po dużym combo. **Architekt warstwy** daje +1 użycie każdego narzędzia. Złoty błysk może dać darmowy ładunek.

## 4. Zasady combo (gałąź „Reakcje”)

- **Próg:** combo liczy się od 4 pól, a z „Niższym progiem” od 3 albo 2.
- **Mnożnik:** każde pole ponad próg dodaje 10% (do 35% z „Mnożnikiem reakcji”), najwyżej do 15 pól ponad próg. Kryształ podwaja mnożnik (najwyżej dwa kryształy), a zwieńczenie mnoży go jeszcze ×1,5 przy combo 20+.
- Mnożnik działa na **odłamki** oraz monety i badania z drobnych skamieniałości i minerałów odkopanych w tej reakcji.
- **Dwutakt:** combo trwa przez 2–3 ręczne rozbicia, a kolejne rozbicie dolicza się do tej samej reakcji.
- **Łup z reakcji:** przy 10+ dostajesz monety, przy 15+ badania, przy 25+ mutagen albo minerał.
- **Wstrząs:** po combo 12+ pozostałe kamienie tracą część wytrzymałości, ale same nie pękają.
- **Gwiazdki:** warstwa wykopana małą liczbą ręcznych rozbić dostaje 1–3 gwiazdki. Gwiazdki zwiększają nagrodę za warstwę i szansę na lepszą skrzynię epoki.
- **Rekordy:** najdłuższe combo, najmniej ruchów na warstwę i warstwy jednym uderzeniem. Za warstwę jednym uderzeniem zwieńczenie daje złotą skrzynię.

## 5. Kopanie ręczne, georadar, ekipy

- **Kopanie:** siła pędzla, krytyki, szeroki pędzel (2 pola, potem 2×2), większa warstwa (12×8, 14×9), pędzel mechaniczny.
- **Georadar** i **Ekipy** zostają bez zmian. Wykupione poziomy przechodzą ze starych zapisów.
- Ekipy w trybie **Pomocnicy** kruszą tylko zwykłą skałę i nie ruszają modyfikatorów, połączeń ani znalezisk, więc nie psują Twojej reakcji. W trybie **Automat** odpalają modyfikatory, ale bez nagród za combo.
- Młot, ładunek prochowy jako osobne narzędzie, seria, Gorączka i tlenie zniknęły. Ich rolę przejęły reakcje. Wszystko, co gracz wydał na stare węzły, wraca jako odłamki i punkty badań.

## 6. Tempo: fale zamiast płaskiej krzywej

- **Szybki start:** pierwsze dwa poziomy każdego węzła są tanie, więc na początku (i przy każdej nowej gałęzi) kupuje się często. Wyższe poziomy drożeją coraz mocniej.
- **Rytm epoki (5 warstw):** pierwsza warstwa po skrzyni jest uboga (×0,7 odłamków), dwie są zwykłe, czwarta bogatsza (×1,5), a piąta to **warstwa skarbów** (×4, dwa razy więcej modyfikatorów, więcej minerałów). Zaraz po niej przychodzi skrzynia epoki z pewną porcją odłamków (brązowa 2, srebrna 4, złota 8 warstw zarobku).
- **Dotacja na wyprawę:** każde nowe stanowisko daje porcję odłamków, czyli większy wystrzał co kilka poziomów parku.
- **Hamulce:** mnożnik combo rośnie najwyżej przez 15 pól ponad próg. Na płytkich warstwach skała jest miękka, głębiej twardnieje, a od −18 m pojawia się **krzemień** (do 22% kamieni), którego reakcja nie kruszy (oprócz wybuchu). Dzięki temu głębokie warstwy dalej są łamigłówką.
- Kształt sprawdzony symulatorem: `WINSEC=120 npm run sim -- 1 3 40 2` drukuje zakupy na okno aktywnej gry.

## 7. Kolejność ewolucyjna

- Stanowiska otwierają się **od najstarszego**: Chengjiang (kambr) → Burgess → Fezouata → Gogo → Cleveland → Mazon Creek → Karoo → Ischigualasto → Krasiejów → Chinle → Holzmaden → … → Hell Creek → Nemegt → Green River → Messel → White River → Pampasy.
- Nowa gra zaczyna się w kambryjskim morzu, więc park startuje z **laguną** i **akwakulturą**. Habitaty otwierają się w kolejności, w jakiej życie je zdobywało: morze (poz. 1), woda słodka (9), ląd (11), powietrze (12).
- Zakładka **Epoka** na wykopaliskach (i karta stanowiska na mapie) opisuje etap ewolucji, nowości ewolucyjne, grupy drzewa życia spotykane tu po raz pierwszy (wyliczane z danych), ciekawostkę i wymieranie. Teksty są w [src/data/epochs.ts](../src/data/epochs.ts).
- Rodzaje z pełnym genomem pojawiają się w skale **6–7 razy rzadziej** (`fullGenomeWeight`), żeby częściej trafiać nowe i niedokończone gatunki.

## 8. Co dalej

- 1162 rodzaje z danych nie występują jeszcze na żadnym stanowisku (luki: sylur, wczesny perm, wczesny trias, paleocen, miocen, pliocen). Nowe stanowiska w tych lukach wypełnią drzewo.
- Kolejne minigry poza kopaniem (np. sekwenator DNA z propozycji interfejsu).

# Rodzaje bez stanowiska – propozycja (zmiany-danych-02)

Zasada: stanowisko symuluje epokę, więc rodzaj trafia na stanowisko, którego okno czasu pokrywa się z jego zakresem, przy zgodnym środowisku. Teksty Bibliotekarza nadal mówią, skąd naprawdę pochodzą skamieniałości.

- Rodzajów bez stanowiska: 1286 (1162 z gry + 124 dodanych w poprawkach 01)
- Da się przypisać do istniejących stanowisk: 1035 (w tym 43 do rzucenia okiem na środowisko i 17 wybranych ręcznie z komentarzem)
- Nie pasuje żadne istniejące stanowisko (luka w czasie albo środowisku): 251

## Proponowane nowe stanowiska (zapełniają luki)

| id | stanowisko | okno (mln lat) | rodzajów |
|---|---|---|---|
| cincinnati | Cincinnati (USA) – późny ordowik | 455–443 | 26 |
| bertie | Formacja Bertie (Nowy Jork) – sylur, wielkoraki | 433–419 | 37 |
| rhynie | Czert z Rhynie (Szkocja) – pierwsze ekosystemy lądowe | 412–400 | 10 |
| east_kirkton | East Kirkton (Szkocja) – wczesny karbon | 350–325 | 14 |
| joggins | Joggins (Kanada) – lasy węglowe | 325–295 | 31 |
| red_beds | Czerwone warstwy Teksasu – wczesny perm | 299–265 | 23 |
| luoping | Luoping (Chiny) – morze środkowego triasu | 247–238 | 4 |
| elliot | Formacja Elliot (RPA) – wczesna jura | 205–180 | 20 |
| cedar_mountain | Formacja Cedar Mountain (Utah) – wczesna kreda | 140–98 | 9 |
| nacimiento | Formacja Nacimiento (Nowy Meksyk) – paleocen | 66–55 | 2 |
| santa_cruz | Formacja Santa Cruz (Argentyna) – wczesny miocen | 29–15 | 53 |
| pisco | Formacja Pisco (Peru) – miocen, morze | 30–5 | 3 |
| ashfall | Siwaliki / Ashfall – późny miocen–pliocen, lądy | 15–2 | 11 |

Małe (Luoping, Nacimiento, Pisco) można pominąć albo połączyć z sąsiednimi – wtedy ich rodzaje czekają dalej. Bez stanowiska zostaje 8 rodzajów (m.in. Dickinsonia, Latimeria, Panderichthys) – opisane w polu `note`.

## Format pliku
Każdy rekord w `rodzaje`: genus, fad, lad, clade, envGuess (+ z jakiego kladu zgadnięte i pewność), status, site (propozycja), alternatives, note, a dla czekających – proposedNewSite.
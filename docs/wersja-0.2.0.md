# SEC 0.2.0: podsumowanie zmian

Wersja 0.2.0 zmienia nazwę gry i rozbudowuje kolekcję. Dochodzi 446 nowych gatunków, 9 stanowisk i 540 minerałów, a skała na polu kopania jest dużo bardziej zróżnicowana.

| | 0.1.0 | 0.2.0 |
|---|---:|---:|
| Gatunki w kolekcji | 1809 | **2255** |
| Stanowiska wykopalisk | 18 | **27** |
| Minerały | 13 | **553** (13 wspólnych + 20 na każde stanowisko) |

## Nazwa i ikona

- Gra nazywa się teraz **SEC — Self-Organizing Entropic Complex**.
- Nowa ikona to pixelowy amonit, czyli spirala logarytmiczna z iskrami „entropii”. Ikonę rysuje skrypt `scripts/make-icon.mjs`.
- Zapis przenosi się sam: przy pierwszym uruchomieniu gra kopiuje pliki z `Dokumenty\Park Wymarłych` do `Dokumenty\SEC`. Stary folder zostaje nietknięty.

## Nowe gatunki (+446)

Gatunki pochodzą z Paleobiology Database. Część dołączyła z nowych grup, część z prawdziwej fauny stanowisk.

| Gałąź drzewa życia | Było | Jest |
|---|---:|---:|
| Morza paleozoiku | 438 | 659 |
| Ssaki | 259 | 347 |
| Gady i archozaury | 209 | 271 |
| Dinozaury | 495 | 536 |
| Pterozaury | 56 | 69 |
| Synapsydy | 126 | 136 |
| Gady morskie | 126 | 131 |
| Pierwsze czworonogi | 100 | 106 |

**Nietypowe i rzadkie** (nowe grupy):
- **Kambryjskie dziwadła:** Kerygmachela, Pahvantia, Stanleycaris, Paranomalocaris, Vetulicola, Microdictyon, Cardiodictyon, Fuxianhuia, Primicaris.
- **Konodonty**, czyli tajemnicze, węgorzowate pierwsze kręgowce: Polygnathus, Palmatolepis, Panderodus.
- **Olbrzymie owady i wije paleozoiku:** Stenodictya, Lithomantis, Homaloneura, Eoarthropleura, Amynilyspes.
- **Skorpiony morskie:** Hibbertopterus, Acutiramus, Onychopterella.
- **Rekiny z „piłą zębową” i inne dziwne:** Fadenia, Falcatus, Janassa, Orthacanthus, Xenacanthus.

**Dinozaury z nowych stanowisk:** Citipati, Khaan, Zanabazar, Shuvuuia, Byronosaurus, Mei, Dilong, Caudipteryx, Sinocalliopteryx, Eoraptor, Alioramus, Dysalotosaurus, Janenschia, Tendaguria.

**Ssaki:** Darwinius, Notharctus, Smilodectes, Mesohippus, Miohippus, Dinictis, Stegomastodon.

## Nowe stanowiska (9)

| Stanowisko | Kraj | Epoka | Zwierzęta w kolekcji | Odblokowanie |
|---|---|---|---:|---:|
| Formacja Chinle (Ghost Ranch) | USA | trias | 58 | poz. 7 |
| Formacja Djadochta | Mongolia | kreda | 38 | poz. 13 |
| Formacja Green River | USA | eocen | 62 | poz. 17 |
| Iły oksfordzkie i kimerydzkie | Wielka Brytania | jura | 67 | poz. 21 |
| Chengjiang | Chiny | kambr | 38 | poz. 25 |
| Tendaguru | Tanzania | jura | 29 | poz. 29 |
| Badlands White River | USA | oligocen | 55 | poz. 33 |
| Formacja Gogo | Australia | dewon | 34 | poz. 37 |
| Łupki Fezouata | Maroko | ordowik | 28 | poz. 43 |

Każde stanowisko ma własne warstwy skalne wzorowane na prawdziwej formacji. Wszystkie 27 stanowisk odblokowuje się teraz co 2 poziomy parku, od 1 do 53, z nowymi przeplecionymi między starymi. Zapisy zachowują już odblokowane stanowiska.

## Minerały (+540)

- Każde stanowisko ma **20 własnych, prawdziwych minerałów**, których nie ma nigdzie indziej: 8 pospolitych, 6 rzadkich, 4 bardzo rzadkie i 2 legendarne.
- Minerały dobrano do geologii miejsca. Na przykład Morrison ma minerały uranu i wanadu, Green River sole z wysychającego jeziora, a Kem Kem i Fezouata minerały kobaltu, arsenu i wanadu.
- **Głębsze są ukryte:** pospolite pojawiają się od powierzchni, a legendarne dopiero od ok. −120 m. W zakładce *Minerały* widać kłódkę i głębokość, od której dany minerał występuje.
- Na mapie świata karta stanowiska pokazuje postęp, np. „Minerały stanowiska 3/20”.
- Dane pochodzą z Wikidata (CC0): polska nazwa i wzór chemiczny. Kolor i kształt kryształu wyliczane są ze wzoru (np. miedź daje zieleń lub błękit, żelazo rdzawy brąz, kobalt róż).

## Różnorodność skały

Każda warstwa losuje 2–4 rodzaje dodatków dobranych do rodzaju skały:

| Dodatek | Gdzie najczęściej |
|---|---|
| Soczewka innej skały | wszędzie, z sąsiednich warstw stanowiska |
| Rdzawe plamy limonitu | piaskowce, iły, less |
| Żyły kalcytu | wapienie, łupki |
| Otoczaki | piaskowce, tufy |
| Konkrecje | łupki, kreda, iły |
| Okruchy muszli | wapienie, kreda |
| Ślady norek i korzeni | iły, less, kreda |
| Warstwowanie przekątne | piaskowce |
| Dendryty manganowe | wapienie |
| Wkładki popiołu | tufy, iły |

Do tego każda warstwa ma lekko inny odcień, cieplejszy albo chłodniejszy. Dymek nad polem podaje nazwę dodatku, np. „Formacja Brule · otoczaki”.

## Poprawki

- Napisy na karcie „Zdobyto skrzynię” już na siebie nie nachodzą.
- Oś czasu na mapie: podpisy zawsze leżą nad kreskami innych stanowisk.
- Lista stanowisk jest posortowana według poziomu odblokowania. Doszedł region Australia.

# Wzór opisu rodzaju (GENUS_LORE)

Każdy rodzaj w grze ma krótki opis w czterech polach. Gra pokazuje je w lekcji zwierzęcia: `look` na pierwszym slajdzie (obok portretu i osi czasu), `life` na slajdzie „Jak żył”, `diff` na slajdzie „Na tle krewnych” (obok drogi przez drzewo i najbliższych krewnych w grze), `fact` jako „Ciekawostka” na końcu.

| pole | co | długość |
|---|---|---|
| `look` | jak wyglądał: wielkość, kształt, najważniejsze cechy budowy | 1–2 zdania, 20–35 słów |
| `life` | jak żył: gdzie, co jadł, jak się poruszał, z kim żył | 1–2 zdania, 15–30 słów |
| `diff` | czym różni się od najbliższych krewnych **w grze** (nazwij ich) | 1–2 zdania, 15–30 słów |
| `fact` | opcjonalnie: ciekawostka, historia odkrycia, rekord | 1–2 zdania, do 35 słów |

Zasady jak w prompcie drzewa: po polsku, bez żargonu (albo z wyjaśnieniem), liczby z „ok.”, spory oznaczone jako spory.

**Goście epoki:** w `look` albo `fact` napisz krótko, skąd naprawdę pochodzą skamieniałości (np. „Znany z łupków Soom w RPA”). Gracz wykopuje go na stanowisku, które reprezentuje epokę, więc powinien wiedzieć, że to nie jest prawdziwe miejsce znaleziska.

## Przykłady z gry

```json
{
  "Hallucigenia": {
    "look": "Lobopod o długości 1–5 cm: robakowate ciało z 7–8 parami sztywnych kolców na grzbiecie, nóżkami z pazurkami i małą głową z parą oczek i pierścieniem zębów.",
    "life": "Prawdopodobnie trzymał się gąbek tylnymi nóżkami, a przednimi, cienkimi, zbierał pokarm.",
    "diff": "Od Cardiodictyonu i Microdictyonu różni się długimi kolcami zamiast płytek.",
    "fact": "Hallucigenię rysowano najpierw do góry nogami: kolce brano za nogi, a nogi za macki na grzbiecie. Głowę pomylono z ogonem."
  }
}
```

```json
{
  "Ottoia": {
    "look": "Robak długości ok. 8 cm z wywracaną trąbką obsadzoną haczykami i kolcami.",
    "life": "Drapieżnik ryjący w mule. W jego jelitach znaleziono resztki innych zwierząt, nawet osobników własnego gatunku.",
    "diff": "Najliczniejszy robak Burgess. W odróżnieniu od Selkirkii nie miał rurki.",
    "fact": "Jest bardzo podobna do dzisiejszych niezmogowców (Priapulida), które wciąż żyją w mule morskiego dna."
  }
}
```

```json
{
  "Metaspriggina": {
    "look": "Rybka bez szczęk długości ok. 6 cm, z dwojgiem dużych oczu, zygzakowatymi mięśniami i siedmioma parami łuków skrzelowych.",
    "life": "Pływała w toni u stóp klifu Burgess. Duże oczy sugerują, że aktywnie pływała i wypatrywała drapieżników.",
    "diff": "Lepiej zachowana od starszych rybek z Chengjiang. Jej pierwsza para łuków skrzelowych różni się od pozostałych – to zapowiedź przyszłej szczęki.",
    "fact": "Okazy opisane w 2014 r. z Marble Canyon zachowały oczy, nozdrza i łuki skrzelowe."
  }
}
```

## Format wyniku

Plik `opisy-rodzajow-NN.json`: jeden obiekt, klucz = nazwa rodzaju dokładnie jak w grze.

```json
{
  "Rodzaj": { "look": "…", "life": "…", "diff": "…", "fact": "…" },
  "InnyRodzaj": { "look": "…", "life": "…", "diff": "…" }
}
```

## Goście epoki w rozdziałach 1–3 bez opisu

### Chengjiang (9)

- Olenellus · 521–487 mln lat · Olenellidae
- Redlichia · 521–497 mln lat · Redlichiidae
- Kerygmachela · 521–515 mln lat · Radiodonta
- Paranomalocaris · 521–512 mln lat · Anomalocarididae
- Guanshancaris · 521–507 mln lat · Amplectobeluidae
- Tamisiocaris · 521–515 mln lat · Tamisiocarididae
- Archaeocyathus · 521–505 mln lat · Archaeocyathidae
- Halkieria · 539–507 mln lat · Halkieriidae
- Helicoplacus · 515–510 mln lat · Helicoplacidae

### Łupki z Burgess (15)

- Paradoxides · 516–497 mln lat · Paradoxididae
- Kingaspidoides · 516–497 mln lat · Ellipsocephalidae
- Fuchouia · 507–497 mln lat · Dolichometopidae
- Cheilocephalus · 507–487 mln lat · Cheilocephalidae
- Corynexochus · 516–487 mln lat · Corynexochidae
- Pagodia · 505–487 mln lat · Kaolishaniidae
- Tricrepicephalus · 507–487 mln lat · Tricrepicephalidae
- Coosella · 507–487 mln lat · Marjumiidae
- Crepicephalus · 505–487 mln lat · Crepicephalidae
- Amecephalus · 515–487 mln lat · Alokistocaridae
- Mexicella · 510–487 mln lat · Ptychopariida
- Aphelaspis · 507–487 mln lat · Aphelaspidae
- Blackwelderia · 505–494 mln lat · Damesellidae
- Buccaspinea · 505–497 mln lat · Hurdiidae
- Pahvantia · 505–497 mln lat · Hurdiidae

### Łupki Fezouata (36)

- Hibbertia · 471–443 mln lat · Harpetidae
- Illaenus · 489–423 mln lat · Illaenidae
- Bumastus · 486–420 mln lat · Styginidae
- Panderia · 472–443 mln lat · Panderiidae
- Pseudocalymene · 487–458 mln lat · Leiostegiidae
- Kingstonia · 507–481 mln lat · Kingstoniidae
- Shumardia · 497–445 mln lat · Shumardiidae
- Irvingella · 497–487 mln lat · Elviniidae
- Stenopilus · 497–483 mln lat · Plethopeltidae
- Cliffia · 497–487 mln lat · Phylacteridae
- Proceratopyge · 505–477 mln lat · Ceratopygidae
- Ptychaspis · 497–487 mln lat · Ptychaspididae
- Prosaukia · 497–487 mln lat · Dikelocephalidae
- Symphysurina · 490–471 mln lat · Symphysurinidae
- Cyclopyge · 486–443 mln lat · Cyclopygidae
- Taihungshania · 486–458 mln lat · Taihungshaniidae
- Dellea · 497–487 mln lat · Dokimokephalidae
- Saratogia · 497–487 mln lat · Idahoiidae
- Pterocephalia · 497–487 mln lat · Pterocephaliidae
- Taenicephalus · 497–487 mln lat · Parabolinoididae
- Parabolinella · 497–468 mln lat · Olenidae
- Ketyna · 495–485 mln lat · Eulomidae
- Hystricurus · 492–457 mln lat · Hystricuridae
- Bathyurus · 489–446 mln lat · Bathyuridae
- Ischyrotoma · 487–457 mln lat · Dimeropygidae
- Telephina · 471–443 mln lat · Telephinidae
- Aulacopleura · 477–382 mln lat · Aulacopleuridae
- Ovalocephalus · 479–443 mln lat · Pliomeridae
- Encrinurus · 477–413 mln lat · Encrinuridae
- Sphaerexochus · 477–423 mln lat · Cheiruridae
- Panderodus · 487–382 mln lat · Panderodontidae
- Pseudooneotodus · 487–393 mln lat · Prioniodinida
- Lingulella · 521–443 mln lat · Obolidae
- Rhabdinopora · 497–457 mln lat · Anisograptidae
- Didymograptus · 489–443 mln lat · Dichograptidae
- Maclurites · 489–443 mln lat · Macluritidae

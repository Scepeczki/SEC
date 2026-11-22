// Detailed educational texts: what appeared at each fork of the tree of life, and what every genus was like
// and how it differs from its relatives. Keyed by the Latin (PBDB) name.
//
// Coverage (first pass): the first 100 genera of the game in evolutionary order, i.e. the fauna of Chengjiang,
// Burgess, Fezouata plus the first ammonite of Gogo, and every fork on their way from "Zwierzęta".
// Anything without a hand-written entry gets a text assembled from the data (see genusLore / cladeLore).

import { CLADES, GENERA, SITES, SITE_BY_ID } from './db';
import { CLADE_INFO } from './cladeInfo';
import { periodLabel } from './geotime';
import type { Genus } from './types';

export interface GenusLore {
  /** what it looked like */
  look: string;
  /** how it lived */
  life: string;
  /** how it differs from its closest relatives on the tree */
  diff: string;
  fact?: string;
}

export interface CladeLore {
  /** the novelty that appears at this fork (short) */
  appeared: string;
  /** what the group is, 2–4 sentences */
  desc: string;
  /** how its branches differ from each other */
  split?: string;
}

// ---------------------------------------------------------------- forks (clades)

export const CLADE_LORE: Record<string, CladeLore> = {
  Animalia: {
    appeared: 'ciało z wielu wyspecjalizowanych komórek, które samo zdobywa pokarm',
    desc: 'Zwierzęta to wielokomórkowce, które nie produkują pokarmu jak rośliny, tylko go zjadają. Najstarsze pewne ślady mają ponad 550 mln lat (fauna ediakarska), ale masowo pojawiają się dopiero w kambrze, kiedy nabierają twardych części, które łatwo się fosylizują.',
    split: 'Pierwsze odgałęzienia to gąbki, żebropławy i parzydełkowce (meduzy, koralowce), które nie mają symetrii dwubocznej. Kilka z nich spotkasz w grze, ale większość zwierząt należy do drugiej gałęzi: dwubocznie symetrycznych.',
  },
  Bilateria: {
    appeared: 'symetria dwuboczna: przód z głową, tył, strona lewa i prawa',
    desc: 'Ciało, które ma przód i tył, porusza się w jednym kierunku. Z przodu skupiają się zmysły i układ nerwowy, czyli zaczątek głowy. To przełom, który pozwolił aktywnie szukać pokarmu i uciekać przed drapieżnikami.',
    split: 'Najwcześniej odchodzą drobne, proste robaki (Xenacoelomorpha). Reszta to Eubilateria, z dwiema wielkimi liniami: pierwoustymi i wtóroustymi.',
  },
  Eubilateria: {
    appeared: 'drożny przewód pokarmowy: usta z jednej strony, odbyt z drugiej',
    desc: 'Pokarm przechodzi przez ciało w jedną stronę jak po taśmie, więc różne odcinki jelita mogą się specjalizować: jeden rozdrabnia, drugi trawi, trzeci wchłania. Ciało buduje się z trzech listków zarodkowych, z których powstają mięśnie, narządy i skóra.',
    split: 'Rozwidla się na pierwouste (stawonogi, mięczaki, pierścienice) i wtórouste (szkarłupnie i strunowce). Różnią się tym, jak w zarodku powstają usta.',
  },
  Protostomia: {
    appeared: 'usta powstają z pierwszego otworu zarodka (pragęby)',
    desc: 'Pierwouste to zdecydowana większość dzisiejszych gatunków zwierząt: owady, pająki, skorupiaki, ślimaki, małże, ośmiornice i robaki. Układ nerwowy biegnie u nich zwykle po stronie brzusznej ciała.',
    split: 'Dzielą się na linienne (rosną, zrzucając pancerz: stawonogi i nicienie) i Spiralia (rosną bez linienia: mięczaki, pierścienice, ramienionogi).',
  },
  Ecdysozoa: {
    appeared: 'linienie: twarda zewnętrzna osłona, którą trzeba zrzucić, żeby urosnąć',
    desc: 'Linienne mają oskórek, który chroni, ale nie rośnie razem ze zwierzęciem. Dlatego co jakiś czas zrzucają go i wytwarzają nowy, większy. W skamieniałościach często zachowały się właśnie wylinki, a nie martwe zwierzęta.',
    split: 'Obok nicieni i niezmogowców najważniejszą gałęzią jest Panarthropoda: zwierzęta z parzystymi nogami.',
  },
  Panarthropoda: {
    appeared: 'parzyste odnóża wzdłuż ciała',
    desc: 'Panarthropoda to stawonogi i ich najbliżsi krewni: pazurnice i niesporczaki. W kambrze żyły dziesiątki form pośrednich, np. „robaki z nogami” (lobopodia) albo opabinia z pięcioma oczami. Pokazują krok po kroku, jak z miękkiego robaka powstał stawonóg.',
    split: 'Gałąź pazurnic (Onychophora) zachowała miękkie, nieczłonowane nóżki. Gałąź stawonogów dostała twardy pancerz i odnóża ze stawami.',
  },
  Onychophora: {
    appeared: 'miękkie, krępe nóżki zakończone pazurkami (lobopodia)',
    desc: 'Pazurnice i ich kambryjscy krewni, lobopodia. Dziś żyje ok. 200 gatunków w wilgotnych lasach tropików. W kambrze były morskie i często uzbrojone w kolce lub płytki na grzbiecie.',
    split: 'W kambrze rozdzielają się na formy z płytkami (Microdictyon) i formy z długimi kolcami na grzbiecie (halucygenie).',
  },
  Hallucigeniidae: {
    appeared: 'długie, sztywne kolce na grzbiecie jako obrona',
    desc: 'Lobopodia, które zamiast zbroi z płytek nosiły pary ostrych kolców. Przednie nóżki były cienkie i służyły raczej do chwytania pokarmu, tylne z pazurkami trzymały się podłoża, np. gąbek.',
  },
  Arthropoda: {
    appeared: 'twardy pancerz z chityny i członowane odnóża ze stawami',
    desc: 'Stawonogi to największy typ zwierząt w historii Ziemi. Pancerz chroni i jest szkieletem, do którego przyczepiają się mięśnie. Odnóża ze stawami mogą się specjalizować: jedne chodzą, inne pływają, chwytają, kroją albo czują. W kambrze stawonogi stanowiły większość zwierząt w morzu.',
    split: 'Najwcześniej odchodzą radiodonty (z chwytnymi wyrostkami przed pyskiem). Reszta to Deuteropoda: stawonogi z prawdziwą głową, z której wyrastają wszystkie dalsze grupy.',
  },
  Radiodonta: {
    appeared: 'para chwytnych wyrostków przed okrągłym pyskiem z płytek zębowych',
    desc: 'Radiodonty były pierwszymi dużymi drapieżnikami na Ziemi. Pływały, falując płatami po bokach ciała, wypatrywały ofiar dużymi oczami na słupkach, chwytały je kolczastymi wyrostkami i wpychały do okrągłego pyska. Z czasem część z nich zamieniła polowanie na cedzenie planktonu.',
    split: 'Rodziny różnią się przede wszystkim budową przednich wyrostków: u anomalokarydów to chwytne ramiona, u amplektobelidów szczypce, u hurdiidów grabie z długimi kolcami, a u tamisiokarydów gęste sita do planktonu.',
  },
  Anomalocarididae: {
    appeared: 'smukłe, opływowe ciało szybkiego pływaka i ramiona z krótkimi kolcami',
    desc: 'Klasyczne radiodonty z głową bez wielkiej tarczy, za to z długim tułowiem z wieloma parami płatów pływnych i ogonem w kształcie wachlarza. To zwinni drapieżcy otwartej wody.',
  },
  Amplectobeluidae: {
    appeared: 'przednie wyrostki z jednym wielkim kolcem, który działał jak szczypce',
    desc: 'Radiodonty o wyrostkach przerobionych na szczypce: jeden powiększony kolec zamykał się z końcem wyrostka i trzymał ofiarę jak pęseta. Były zwykle mniejsze od anomalokarysa.',
  },
  Tamisiocarididae: {
    appeared: 'wyrostki z gęstymi, cienkimi kolcami jak sito',
    desc: 'Radiodonty filtrujące: zamiast chwytać zdobycz, przeczesywały wodę gęstymi grzebieniami i zbierały drobne zwierzęta planktonowe. To jedne z najstarszych dużych filtratorów w historii.',
  },
  Hurdiidae: {
    appeared: 'wielka tarcza na głowie i wyrostki jak grabie z długimi, równymi kolcami',
    desc: 'Hurdiidy miały ogromny pancerz głowy, czasem dłuższy niż reszta ciała. Ich wyrostki przesiewały osad i wodę. Ta rodzina przetrwała najdłużej i w ordowiku dała prawdziwe olbrzymy filtrujące.',
  },
  Deuteropoda: {
    appeared: 'zrośnięta tarcza głowowa i odnóża przegubowe na całym ciele',
    desc: 'Deuteropoda to stawonogi „właściwe”: ich głowa jest osobną, twardą częścią, a każde odnóże ma stawy. Pierwsza para odnóży głowy zamieniła się w czułki albo w chwytne wyrostki. Należą tu wszystkie stawonogi żyjące dziś.',
    split: 'Rozdzielają się na żuwaczkowce (Mandibulata: skorupiaki, owady, wije), szczękoczułkowce (pająki, skorpiony, wielkoraki) i kambryjskie Megacheira z „wielkimi odnóżami”.',
  },
  Megacheira: {
    appeared: 'jedna para wielkich, chwytnych odnóży przed pyskiem („wielkie odnóże”)',
    desc: 'Drobne kambryjskie stawonogi, których pierwsza para odnóży zamieniła się w kolczaste chwytaki. Ich układ nerwowy bywa podobny do układu szczękoczułkowców, dlatego uważa się je za krewnych pająków i skorpionów.',
  },
  Leanchoiliidae: {
    appeared: 'chwytaki zakończone długimi biczykami',
    desc: 'Megacheira, których kolce chwytaków przedłużyły się w długie, giętkie biczyki. Mogły służyć do macania dna i wyszukiwania ofiar w mętnej wodzie.',
  },
  Mandibulata: {
    appeared: 'żuwaczki: para twardych szczęk do gryzienia i rozdrabniania',
    desc: 'Żuwaczkowce to skorupiaki, owady i wije. Żuwaczki pozwoliły rozdrabniać pokarm, zanim trafi do pyska, co otworzyło drogę do nowych diet. Dziś to najliczniejsza grupa zwierząt na Ziemi.',
    split: 'W kambrze najważniejsze są Hymenocarina z dwuklapowym pancerzem i pierwsi krewni skorupiaków (Pancrustacea).',
  },
  Hymenocarina: {
    appeared: 'pancerz z dwóch klap okrywający przód ciała, jak u małża',
    desc: 'Kambryjskie żuwaczkowce przypominające krewetki w muszli. Klapy pancerza chroniły głowę i skrzela, a umięśniony odwłok wystawał na zewnątrz. Część pływała w toni, część żerowała przy dnie.',
  },
  Pancrustacea: {
    appeared: 'skorupiakowy plan budowy, z którego później wyjdą także owady',
    desc: 'Pancrustacea to skorupiaki i owady razem. Badania DNA pokazały, że owady to w gruncie rzeczy lądowa gałąź skorupiaków. Kambryjscy przedstawiciele byli drobni i żyli w morzu.',
  },
  Hymenostraca: {
    appeared: 'drobny, dwuklapowy pancerz u skorupiakopodobnych stawonogów',
    desc: 'Grupa małych kambryjskich stawonogów z cienkim, dwuklapowym pancerzem. Uważa się je za wczesnych krewnych skorupiaków.',
  },
  Chelicerata: {
    appeared: 'szczękoczułki: szczypcowate odnóża przed pyskiem zamiast czułków',
    desc: 'Szczękoczułkowce to pająki, skorpiony, roztocza, skrzypłocze i wymarłe wielkoraki. Nie mają czułków. Pokarm chwytają i rozrywają szczękoczułkami, a ciało dzieli się na głowotułów i odwłok.',
  },
  Mollisoniida: {
    appeared: 'ciało z dwóch tarcz (przedniej i tylnej) i pierwsze prawdziwe szczękoczułki',
    desc: 'Kambryjscy krewni szczękoczułkowców. Przypominały małe żółwie z tarczą głowową i ogonową. U mollisonii zachowały się najstarsze znane szczękoczułki.',
  },
  Bradoriida: {
    appeared: 'maleńki, dwuklapowy pancerzyk zamykający całe zwierzę',
    desc: 'Bradoriidy miały zwykle kilka milimetrów i wyglądały jak nasionka. Były jednymi z najliczniejszych zwierząt kambru i występują w skałach na całym świecie. Przypominają dzisiejsze małżoraczki, ale nie są z nimi blisko spokrewnione.',
  },
  Artiopoda: {
    appeared: 'płaska grzbietowa tarcza, czułki i jednakowe, dwugałęziste odnóża',
    desc: 'Artiopoda to trylobity i ich krewni bez twardego, zwapniałego pancerza. Płaskie ciało przylegało do dna, a pod tarczą kryły się dziesiątki podobnych do siebie odnóży: jedna gałąź do chodzenia, druga ze skrzelami.',
    split: 'Gałęzie różnią się pancerzem: trylobity wbudowały w niego kalcyt (dlatego mamy ich tysiące), nektaspidy i Conciliterga miały pancerz miękki, a Vicissicaudata zmienione, beznogie zakończenie ciała.',
  },
  Nektaspidida: {
    appeared: 'miękki pancerz z mało albo zero segmentów tułowia',
    desc: 'Krewni trylobitów, których pancerz nie był zwapniały, więc znamy je tylko ze stanowisk zachowujących miękkie ciała. Ciało pokrywały dwie wielkie tarcze: głowowa i ogonowa.',
  },
  Naraoiidae: {
    appeared: 'tylko dwie tarcze: głowowa i ogonowa, bez żadnych segmentów pomiędzy',
    desc: 'Naraoiidy wyglądają jak trylobity bez tułowia. Ta prosta budowa sprawdziła się wyjątkowo długo: przetrwały od kambru aż do syluru.',
  },
  Petalopleura: {
    appeared: 'wycięcia na brzegu tarczy, przez które wystawały oczy',
    desc: 'Artiopoda z długim tułowiem z wielu segmentów i oczami na krótkich szypułkach wysuniętymi spod tarczy przez boczne wcięcia.',
  },
  Conciliterga: {
    appeared: 'szeroka, płaska tarcza, nachodzące na siebie segmenty',
    desc: 'Duże, płaskie artiopoda o owalnym zarysie, przypominające tarczę rycerza. Ich miękki pancerz zachował się tylko w łupkach typu Chengjiang.',
  },
  Vicissicaudata: {
    appeared: 'zmienione zakończenie ciała: ostatnie segmenty bez nóg, z płetwami lub kolcem',
    desc: 'Artiopoda, u których tył ciała zamienił się w narząd sterujący albo obronny. Należą tu m.in. drapieżna Sidneyia i Emeraldella z długim „ogonem”.',
  },
  Trilobita: {
    appeared: 'pancerz zwapniały kalcytem i oczy z kryształów kalcytu',
    desc: 'Trylobity to pierwsze stawonogi, których pancerz zawierał minerał. Dzięki temu zachowały się w ogromnych ilościach i znamy ponad 20 000 gatunków. Ich nazwa pochodzi od trzech podłużnych płatów: osiowego i dwóch bocznych. Żyły prawie 300 mln lat, od kambru do końca permu.',
    split: 'Kambryjskie Redlichiida mają wiele segmentów i maleńki ogon. Późniejsze rzędy (Corynexochida, Ptychopariida, Asaphida, Phacopida) wydłużają tarczę ogonową, uczą się zwijać w kulkę i budują różne oczy.',
  },
  Redlichiida: {
    appeared: 'najstarszy plan trylobita: dużo segmentów, malutki ogon, wielkie półksiężycowe oczy',
    desc: 'Redlichiidy to najstarsze trylobity. Miały wiele segmentów tułowia, często zakończonych kolcami, a tarcza ogonowa była mała jak guziczek. Wymarły w środkowym kambrze.',
  },
  Redlichiina: { appeared: 'szeroka tarcza głowowa z długimi kolcami policzkowymi', desc: 'Podrząd obejmujący większość wczesnokambryjskich trylobitów z Chin, Syberii i Australii.' },
  Redlichiidae: { appeared: 'duże oczy w kształcie półksiężyca biegnące wzdłuż głowy', desc: 'Klasyczne wczesne trylobity, od których pochodzi nazwa całego rzędu. Występowały głównie na kontynencie Gondwana.' },
  Ellipsocephaloidea: { appeared: 'małe, gładkie, krępe ciało i mniejsze oczy', desc: 'Drobne redlichiidy o prostej budowie, bardzo liczne we wczesnym kambrze.' },
  Libristoma: {
    appeared: 'płytka pod pyskiem (hypostom) odłączona od reszty głowy',
    desc: 'Ogromna grupa trylobitów, z której wyszły prawie wszystkie rzędy późniejszego paleozoiku. Ich wspólną cechą jest budowa spodu głowy: płytka osłaniająca pysk nie była zrośnięta z przodem pancerza.',
    split: 'Gałęzie to m.in. Ptychopariida (proste, uniwersalne), Asaphida (z wielkim ogonem) i Trinucleida (ślepe, z ozdobnym rondem).',
  },
  Ptychopariida: {
    appeared: 'uniwersalny, „zwykły” trylobit: średnie oczy, średni ogon, sporo segmentów',
    desc: 'Ptychopariidy to najbardziej typowe trylobity: niewyspecjalizowane, małe, bardzo liczne w kambrze. Często zbierane, bo występują w ogromnych ilościach.',
  },
  Ptychopariacea: { appeared: 'głowa z wyraźnym rondem z przodu', desc: 'Nadrodzina drobnych ptychopariidów, bardzo częstych w środkowym kambrze.' },
  Alokistocaridae: { appeared: 'szeroka głowa i krótki, zaokrąglony ogon', desc: 'Rodzina ptychopariidów, do której należą najpopularniejsze kambryjskie trylobity kolekcjonerskie, jak Elrathia.' },
  Agnostida: {
    appeared: 'miniaturyzacja: dwie tarcze tej samej wielkości i tylko 2–3 segmenty',
    desc: 'Agnostidy miały zwykle mniej niż centymetr. Tarcza głowowa i ogonowa były prawie identyczne, a większość nie miała oczu. Zwijały się jak małże. Prawdopodobnie część z nich żyła w planktonie, dlatego rozprzestrzeniły się po wszystkich oceanach.',
  },
  Agnostina: { appeared: 'zupełny brak oczu i tylko dwa segmenty tułowia', desc: 'Typowe agnostidy: ślepe, maleńkie, bardzo szeroko rozprzestrzenione. Służą geologom do datowania skał kambru.' },
  Corynexochida: {
    appeared: 'wydłużony, rozszerzający się ku przodowi środek głowy (glabella)',
    desc: 'Duże, mocno zbudowane trylobity, często z kolczastą tarczą ogonową. To u nich (u Olenoides) najlepiej zachowały się odnóża i czułki trylobitów.',
  },
  Corynexochina: { appeared: 'duża tarcza ogonowa z kolcami po bokach', desc: 'Główna linia corynexochidów, w kambrze jedna z najważniejszych grup trylobitów.' },
  Dorypygidae: { appeared: 'tarcza ogonowa z wachlarzem 5–7 par kolców', desc: 'Kolczaste corynexochidy z dużym ogonem. Kolce utrudniały połknięcie drapieżnikom.' },
  Oryctocephalinae: { appeared: 'dołki w bruzdach na środku głowy', desc: 'Drobne trylobity rozsiane po całym świecie. Jeden gatunek wyznacza oficjalną granicę piętra kambru (wuliuanu).' },
  Leiostegioidea: { appeared: 'gładka, mało urzeźbiona głowa', desc: 'Corynexochidy schyłku kambru i początku ordowiku.' },
  Leiostegiidae: { appeared: 'szeroka, wygładzona tarcza głowowa', desc: 'Rodzina wczesnoordowickich trylobitów, częsta w Afryce Północnej i Ameryce Południowej.' },
  Asaphida: {
    appeared: 'wielka tarcza ogonowa, często tak duża jak głowa',
    desc: 'Asafidy postawiły na duży ogon, który mógł szczelnie przykryć ciało przy zwijaniu się. Ich larwy prawdopodobnie żyły w planktonie, co pomogło im rozprzestrzenić się po świecie. W ordowiku były jedną z najważniejszych grup trylobitów.',
  },
  Asaphoidea: { appeared: 'wygładzony pancerz i duże oczy', desc: 'Najważniejsza nadrodzina asafidów, z największymi trylobitami ordowiku.' },
  Asaphidae: { appeared: 'gładki, „wylany” pancerz z zatartymi bruzdami', desc: 'Duże, gładkie trylobity, które często zakopywały się w osadzie. Należy tu Isotelus, jeden z największych trylobitów (ponad 70 cm).' },
  Isotelinae: { appeared: 'olbrzymi wzrost i płaska, szeroka tarcza ogonowa', desc: 'Podrodzina gigantów wśród trylobitów, z rodzajami Isotelus i Kierarges.' },
  Remopleurididae: { appeared: 'ogromne oczy owinięte wokół głowy i „języczek” z przodu', desc: 'Remopleuridy miały oczy zajmujące niemal całe boki głowy. Prawdopodobnie aktywnie pływały nad dnem.' },
  Cyclopygoidea: { appeared: 'bardzo duże oczy i lekki pancerz', desc: 'Asafidy z wielkimi oczami. Część z nich (cyklopygidy) przeszła do życia w toni wodnej.' },
  Nileidae: { appeared: 'gładki, wypukły pancerz i duże oczy', desc: 'Nileidy to gładkie, „wyślizgane” trylobity, które potrafiły szczelnie się zwijać.' },
  Trinucleida: { appeared: 'utrata oczu i szerokie rondo wokół głowy', desc: 'Trylobity ślepe, z rondem (często dziurkowanym) wokół głowy i długimi kolcami policzkowymi. Żyły na miękkim, mulistym dnie, gdzie wzrok się nie przydawał.' },
  Raphiophoridae: { appeared: 'długi kolec wyrastający z czoła', desc: 'Ślepe trylobity z długim kolcem na przodzie głowy i równie długimi kolcami policzkowymi. Najbardziej znany to Ampyx.' },
  Olenida: { appeared: 'cienki pancerz i szerokie, płaskie ciało dla życia w ubogiej w tlen wodzie', desc: 'Olenidy żyły na dnie, gdzie brakowało tlenu, a szerokie ciało dawało dużą powierzchnię do oddychania. Możliwe, że żywiły się bakteriami siarkowymi, z którymi żyły w symbiozie.' },
  Olenidae: { appeared: 'wiele cienkich segmentów i malutki ogon', desc: 'Klasyczne olenidy, liczne w późnym kambrze w skałach osadzonych w beztlenowych basenach.' },
  Eulomidae: { appeared: 'głęboko bruzdowana glabella i drobne oczy', desc: 'Niewielka rodzina z przełomu kambru i ordowiku.' },
  Phacopida: {
    appeared: 'nowe rodzaje oczu i doskonałe zwijanie się w kulkę',
    desc: 'Phacopida to trylobity, które przetrwały najdłużej, od ordowiku do dewonu. Wiele z nich miało oczy schizochroalne: duże, osobne soczewki z kalcytu, jedyne w swoim rodzaju w świecie zwierząt.',
    split: 'Phacopina mają oczy z dużych soczewek, Calymenina są krępe i często bez wielkich oczu, a Cheirurina mają kolczaste, „palczaste” ogony.',
  },
  Phacopina: { appeared: 'oczy schizochroalne: osobne, duże soczewki z kalcytu', desc: 'Każda soczewka ich oka była osobnym kryształem z własną rogówką. Takie oczy mogły dobrze widzieć w półmroku.' },
  Phacopoidea: { appeared: 'wypukła, „guziczkowata” glabella', desc: 'Nadrodzina facopidów z charakterystycznie nabrzmiałym środkiem głowy.' },
  Pterygometopidae: { appeared: 'wyjątkowo wysokie oczy z wieloma soczewkami', desc: 'Ordowickie facopidy z dużymi, wysokimi oczami.' },
  Dalmanitidae: { appeared: 'kolec na końcu ogona i oczy z wielu soczewek', desc: 'Dalmanitidy miały trójkątną tarczę ogonową, często zakończoną długim kolcem, oraz duże oczy schizochroalne.' },
  Calymenina: { appeared: 'krępe ciało, wyraźnie płatowa glabella, mocne zwijanie', desc: 'Kalymeny to „przysadziste” trylobity płytkich mórz. Często znajduje się je zwinięte w kulkę.' },
  Calymenidae: { appeared: 'glabella w kształcie dzwonu z płatami po bokach', desc: 'Klasyczne kalymeny, przez około 100 mln lat jedne z najpospolitszych trylobitów.' },
  Colpocoryphinae: { appeared: 'gładka, wydłużona sylwetka z zatartymi bruzdami', desc: 'Kalymeny o wygładzonym pancerzu, częste w ordowiku Gondwany (dzisiejsza Afryka Północna i Europa Zachodnia).' },
  Cheirurina: { appeared: 'ogon z kilku par kolców jak palce', desc: 'Cheiruridy miały mocno urzeźbioną głowę i tarczę ogonową złożoną z kolców.' },
  Cheiruridae: { appeared: 'ziarnista, dziurkowana głowa i palczasty ogon', desc: 'Główna rodzina cheirurid, licznych w całym ordowiku.' },
  Mollusca: {
    appeared: 'miękkie ciało z mięsistą nogą, płaszczem i tarką (radulą) w pysku',
    desc: 'Mięczaki to ślimaki, małże, głowonogi i kilka mniejszych grup. Płaszcz wydziela muszlę, a radula zeskrobuje pokarm. W kambrze pojawiają się zarówno formy z muszlą, jak i pokryte łuskami, jak Wiwaxia.',
    split: 'Linia głowonogów zamieniła nogę w macki i lejek do pływania odrzutowego. Inne linie (np. Wiwaxia) zostały przy pełzaniu po dnie.',
  },
  Cephalopoda: {
    appeared: 'muszla z komorami wypełnionymi gazem i pływanie odrzutowe',
    desc: 'Głowonogi jako pierwsze mięczaki oderwały się od dna. Komory w muszli połączone rurką (syfonem) działały jak zbiorniki balastowe, a woda wyrzucana z lejka dawała napęd. W ordowiku były największymi drapieżnikami mórz.',
    split: 'Wczesne głowonogi miały proste, stożkowe muszle (ortokony). Później z jednej linii wyszły zwinięte amonity, a z innej łodziki i dzisiejsze ośmiornice.',
  },
  Orthoceratoidea: { appeared: 'długa, prosta muszla jak stożek', desc: 'Ortocerasy to głowonogi z prostą, smukłą muszlą. Pływały poziomo, a muszla mogła mieć od kilku centymetrów do kilku metrów.' },
  Ammonoidea: {
    appeared: 'muszla zwinięta w płaską spiralę, z falistymi przegrodami',
    desc: 'Amonity pojawiły się w dewonie i przetrwały do końca kredy. Ich przegrody tworzyły na muszli coraz bardziej zawiłe linie (szwy). Zmieniały się tak szybko, że geolodzy datują nimi skały z dokładnością do setek tysięcy lat.',
  },
  Ammonitida: { appeared: 'zawiłe, karbowane linie szwów', desc: 'Szeroka grupa amonitów. Zawiłe przegrody wzmacniały muszlę i pozwalały schodzić głębiej.' },
  Gephurocerataceae: { appeared: 'wąska, ostro zakończona muszla szybkiego pływaka', desc: 'Dewońskie goniatyty z muszlą o ostrym brzegu. Prawie całkowicie zniknęły w wymieraniu późnodewońskim.' },
  Deuterostomia: {
    appeared: 'usta powstają jako drugi otwór zarodka',
    desc: 'Wtórouste to szkarłupnie (rozgwiazdy, jeżowce), półstrunowce i strunowce, w tym my. W kambrze były jeszcze rzadkie i drobne, a ich dziwne formy (np. wetulikolie) do dziś sprawiają kłopot badaczom.',
    split: 'Szkarłupnie zbudowały szkielet z płytek wapiennych i symetrię pięcioramienną. Strunowce postawiły na strunę grzbietową i mięśnie do pływania.',
  },
  Chordata: {
    appeared: 'struna grzbietowa, szczeliny skrzelowe i ogon za odbytem',
    desc: 'Strunowce mają elastyczny pręt wzdłuż grzbietu, nad nim przewód nerwowy, a w gardle szczeliny skrzelowe. Ich pierwsi przedstawiciele, jak Pikaia, przypominali małe węgorzyki. Z tej linii wyjdą wszystkie ryby, płazy, gady, ptaki i ssaki.',
  },
  Vetulicolida: {
    appeared: 'ciało z dwóch części: przednia ze skrzelami, tylna jak ogon',
    desc: 'Wetulikolie to zagadka kambru. Przednia część ciała z otworami skrzelowymi wygląda jak gardziel strunowca, tylna jak segmentowany ogon. Nie miały oczu ani nóg. Najczęściej uważa się je za wczesne wtórouste.',
  },
  Kerygmachelidae: {
    appeared: 'boczne płaty do pływania obok krótkich nóżek',
    desc: 'Lobopodia z płatami to kambryjskie zwierzęta pośrednie między robakami na nóżkach a stawonogami. Obok krótkich, miękkich nóżek miały po bokach płaty, którymi wiosłowały, a z przodu chwytne wyrostki. Kerygmachela z Grenlandii pokazuje, jak mógł wyglądać przodek radiodontów i stawonogów.',
  },
};

// ---------------------------------------------------------------- genera

export const GENUS_LORE: Record<string, GenusLore> = {
  // ---- Chengjiang (Chiny, ok. 518 mln lat)
  Isoxys: {
    look: 'Kilkucentymetrowy stawonóg schowany w cienkim pancerzu z dwóch klap. Z przodu i z tyłu pancerza wyrastały długie, ostre kolce, a spod niego wystawały wielkie, kuliste oczy i para chwytnych odnóży.',
    life: 'Pływał w toni wodnej i wypatrywał drobnych zwierząt. Kolce chroniły go przed połknięciem przez większych drapieżników.',
    diff: 'Inne dwuklapowe stawonogi z tego czasu (Waptia, Canadaspis) miały czułki i żerowały przy dnie. Isoxys miał zamiast tego chwytaki i ogromne oczy, czyli był pływającym łowcą.',
  },
  Naraoia: {
    look: 'Owalny, płaski stawonóg długości 2–4 cm, okryty tylko dwiema miękkimi tarczami: głowową i ogonową. Z przodu miał długie czułki, pod tarczami kilkanaście par odnóży.',
    life: 'Pełzał po dnie i zjadał drobne zwierzęta i padlinę. W jego jelicie zachowały się ślady mułu.',
    diff: 'Wygląda jak trylobit bez tułowia i bez wapiennego pancerza. Od bliskiej Misszhouii różni się krótszą, bardziej okrągłą tarczą ogonową.',
    fact: 'To jeden z najdłużej żyjących rodzajów kambru: ten prosty plan budowy przetrwał aż do syluru, ponad 100 mln lat.',
  },
  Kunmingella: {
    look: 'Maleńki, kilkumilimetrowy stawonóg w dwuklapowym pancerzyku, wyglądający jak ziarenko fasoli.',
    life: 'Żył w ogromnych ilościach przy dnie i zbierał drobiny pokarmu. W Chengjiang to jedna z najczęstszych skamieniałości.',
    diff: 'Od innych bradoriid, Malongelli i Liangshanelli, różni się budową i urzeźbieniem klap. Najważniejsze jest jednak to, że zachowały się u niego miękkie części: odnóża i jaja.',
    fact: 'Znaleziono osobniki z jajami przyczepionymi do odnóży, czyli matki, które nosiły potomstwo. To jeden z najstarszych dowodów opieki nad jajami.',
  },
  Waptia: {
    look: 'Krewetkopodobny stawonóg do 8 cm z pancerzem z dwóch klap na przodzie ciała, parą długich czułków i umięśnionym odwłokiem zakończonym rozwidlonym ogonem.',
    life: 'Pływał nad dnem, wiosłując odwłokiem, i zbierał drobny pokarm.',
    diff: 'W porównaniu z Canadaspis i Branchiocaris ma dłuższy, wyraźnie segmentowany odwłok i rozwidlony ogon, więc lepiej pływał.',
    fact: 'Znaleziono Waptie z jajami pod pancerzem, a nawet z zarodkami w środku jaj. To najstarszy znany przykład opieki nad potomstwem.',
  },
  Leanchoilia: {
    look: 'Smukły stawonóg długości kilku centymetrów, z tarczą głowową i dwiema parami oczu. Najbardziej rzucały się w oczy przednie „wielkie odnóża” zakończone trzema długimi biczykami.',
    life: 'Pływał i polował na drobne zwierzęta przy dnie, macając wodę biczykami.',
    diff: 'Od Alalcomenaeusa różni się znacznie dłuższymi biczykami na chwytakach. Od Fortiforcepsa tym, że chwytaki są wiotkie, a nie masywne.',
    fact: 'U Leanchoilii zachowały się ślady mózgu i nerwów. Ich układ przypomina układ nerwowy pająków i skorpionów.',
  },
  Eoredlichia: {
    look: 'Jeden z najstarszych trylobitów: około 5 cm długości, z szeroką głową, wielkimi oczami w kształcie półksiężyca, kilkunastoma segmentami tułowia i malutkim ogonem.',
    life: 'Chodził po dnie płytkiego morza, prawdopodobnie jako drapieżnik i padlinożerca.',
    diff: 'W porównaniu z Yunnanocephalusem jest większy, ma większe oczy i dłuższe kolce na głowie. Od późniejszych trylobitów różni się maleńkim ogonem i dużą liczbą segmentów.',
    fact: 'U Eoredlichii z Chengjiang zachowały się nawet odnóża i czułki, co przy trylobitach zdarza się bardzo rzadko.',
  },
  Branchiocaris: {
    look: 'Stawonóg z dużym pancerzem z dwóch klap, długim odwłokiem i parą krótkich przednich odnóży z pazurkami.',
    life: 'Pływał przy dnie i chwytał drobny pokarm.',
    diff: 'Od Waptii różni się krótszymi czułkami i dużymi przednimi chwytakami. Od Canadaspis tym, że pancerz zakrywa mniejszą część ciała.',
  },
  Misszhouia: {
    look: 'Płaski, wydłużony krewny trylobitów, ok. 3 cm, z miękką tarczą głowową i wyraźnie dłuższą tarczą ogonową.',
    life: 'Pełzał po dnie i zbierał pokarm z osadu.',
    diff: 'To bliska krewna Naraoii, ale ma smuklejsze ciało i znacznie dłuższą tarczę ogonową (stąd nazwa gatunku: „długoogonowa”).',
    fact: 'Nazwa honoruje panią Zhou Guiqing, która pomagała w badaniach Chengjiang.',
  },
  Amplectobelua: {
    look: 'Radiodont długości ok. 20 cm z dużymi oczami na słupkach i parą przednich wyrostków, na których jeden wielki kolec zamykał się jak szczypce.',
    life: 'Chwytał drobne zwierzęta szczypcami i podawał do okrągłego pyska.',
    diff: 'Od anomalokarysa różni się szczypcami zamiast prostych chwytaków. Od bliskiego Lyrarapaxa jest większy.',
  },
  Yunnanocephalus: {
    look: 'Mały, około 2-centymetrowy trylobit o gładkiej, krępej sylwetce, z małymi oczami i krótkimi kolcami na głowie.',
    life: 'Żył masowo na dnie i zbierał drobne cząstki pokarmu.',
    diff: 'W porównaniu z Eoredlichią jest drobniejszy, ma mniejsze oczy i prostszy, gładki pancerz. To jeden z najpospolitszych trylobitów Chengjiang.',
  },
  Primicaris: {
    look: 'Kilkumilimetrowe stworzenie z okrągłą, płaską tarczą, parą czułków i kilkoma parami odnóży. Wygląda jak larwa.',
    life: 'Unosiło się w wodzie albo pełzało przy dnie.',
    diff: 'Wielu badaczy uważa, że to nie osobny gatunek, tylko młodociane stadium któregoś z krewnych trylobitów, np. nektaspidów. Brak tułowia i okrągły kształt przypominają larwy.',
  },
  Houcaris: {
    look: 'Średniej wielkości radiodont z przednimi wyrostkami z gęsto ustawionymi, cienkimi kolcami.',
    life: 'Przeczesywał wodę wyrostkami i zbierał drobne zwierzęta planktonowe.',
    diff: 'Od anomalokarysa różni się wyrostkami przerobionymi na sita. Długo uważano go za gatunek anomalokarysa (Anomalocaris saron), dopóki nie okazało się, że należy do filtrujących tamisiokarydów.',
  },
  Vetulicola: {
    look: 'Kilkucentymetrowe zwierzę z dwóch części: przód jak twarde pudełko z pięcioma parami otworów skrzelowych po bokach, tył jak segmentowany ogon.',
    life: 'Pływał, machając ogonem, i przepuszczał wodę przez gardziel, filtrując z niej pokarm.',
    diff: 'Od bliskiego Pomatrum różni się twardym, sztywnym przodem z płytek. Nie miał oczu ani odnóży, czym różni się od wszystkich stawonogów obok.',
    fact: 'Przez lata uznawano go to za stawonoga, to za strunowca. Szczeliny skrzelowe przemawiają za tym, że jest dalekim kuzynem naszej linii.',
  },
  Fuxianhuia: {
    look: 'Stawonóg do 11 cm z szeroką tarczą głowową, długim tułowiem z kilkudziesięciu segmentów i ogonem zakończonym kolcem.',
    life: 'Chodził po dnie, przeczesując osad krótkimi przednimi odnóżami.',
    diff: 'To jeden z najbardziej prymitywnych prawdziwych stawonogów: ma wiele jednakowych segmentów i proste odnóża, podczas gdy Leanchoilia czy Waptia mają już wyspecjalizowane części ciała.',
    fact: 'U Fuxianhuii zachował się mózg, jeden z najstarszych w historii. Znaleziono też dorosłego z kilkoma młodymi, co sugeruje opiekę rodzicielską.',
  },
  Retifacies: {
    look: 'Płaski, około 9-centymetrowy krewny trylobitów z miękką tarczą pokrytą siateczką drobnych wypukłości i z długim kolcem na ogonie.',
    life: 'Pełzał po dnie jako drapieżnik lub padlinożerca.',
    diff: 'Nazwa znaczy „siateczkowata twarz”: żaden inny krewny trylobitów z Chengjiang nie ma tak urzeźbionego pancerza. Od Naraoii różni się też tułowiem z wieloma segmentami.',
  },
  Xandarella: {
    look: 'Wydłużony stawonóg z miękką tarczą, długim tułowiem z wielu segmentów i oczami wystającymi z boku głowy przez wcięcia w tarczy.',
    life: 'Żył przy dnie i jadł drobny pokarm.',
    diff: 'Od Cindarelli, swojej najbliższej krewnej, różni się mniejszymi oczami i większą liczbą segmentów pod tarczą.',
  },
  Cindarella: {
    look: 'Długi, wąski stawonóg z wielkimi oczami złożonymi wystającymi spod tarczy i ogonem z kolcami.',
    life: 'Aktywnie poruszał się nad dnem i wypatrywał pokarmu albo zagrożeń.',
    diff: 'W porównaniu z Xandarellą ma większe oczy i smuklejsze ciało. Jej oczy należały do najbardziej złożonych w kambrze.',
    fact: 'Każde oko Cindarelli miało ok. 2000 soczewek, co świadczy o zbrojeniu się w zmysły w czasie eksplozji kambryjskiej.',
  },
  Combinivalvula: {
    look: 'Drobny stawonóg w dwuklapowym pancerzyku z urzeźbioną powierzchnią.',
    life: 'Żył przy dnie i zbierał drobne cząstki pokarmu.',
    diff: 'Należy do licznych w Chengjiang „małżopodobnych” stawonogów. Od bradoriid różni się budową i ornamentem klap.',
  },
  Microdictyon: {
    look: 'Kilkucentymetrowy „robak z nogami” (lobopod) z parami ażurowych, siateczkowatych płytek po bokach ciała, nad każdą parą nóżek.',
    life: 'Wspinał się po dnie i gąbkach i zjadał drobne organizmy.',
    diff: 'Od Hallucigenii i Cardiodictyonu różni się zbroją: zamiast kolców ma płaskie płytki z siateczki.',
    fact: 'Pojedyncze płytki Microdictyonu znajduje się w skałach kambru na całym świecie. Długo nie wiedziano, do jakiego zwierzęcia należą.',
  },
  Canadaspis: {
    look: 'Krewetkopodobny stawonóg do 5 cm z pancerzem z dwóch klap zakrywającym głowę i tułów oraz z wystającym, segmentowanym odwłokiem.',
    life: 'Chodził po dnie i zbierał pokarm z osadu, pomagając sobie przednimi odnóżami z kolcami.',
    diff: 'Od Waptii różni się większym pancerzem i krótszym odwłokiem, bo bardziej chodził, niż pływał. Jest jednym z najstarszych znanych żuwaczkowców.',
  },
  Kuamaia: {
    look: 'Szeroki, płaski, owalny stawonóg do kilkunastu centymetrów z miękką tarczą obrzeżoną drobnymi kolcami.',
    life: 'Polował na dnie na drobne zwierzęta.',
    diff: 'Od bliskiego Saperionu różni się drobnymi kolcami na brzegu tarczy i nieco węższym kształtem.',
  },
  Ercaicunia: {
    look: 'Mały stawonóg z cienkim pancerzem z dwóch klap i wieloma parami odnóży.',
    life: 'Pływał przy dnie i filtrował drobny pokarm.',
    diff: 'To jeden z najstarszych przedstawicieli linii skorupiaków. Od innych dwuklapowców, np. Canadaspis, różni się budową odnóży bliższą skorupiakom.',
  },
  Cardiodictyon: {
    look: 'Malutki lobopod, około 1,5 cm, z kilkoma parami nóżek i drobnymi płytkami na grzbiecie.',
    life: 'Pełzał po dnie i żerował na drobnych organizmach.',
    diff: 'Od Microdictyonu jest mniejszy i ma mniejsze płytki, a od Hallucigenii różni się brakiem długich kolców.',
    fact: 'W 2022 r. odkryto u niego zachowany mózg. Okazało się, że jego głowa nie była segmentowana, w przeciwieństwie do głowy stawonogów.',
  },
  Pseudoiulia: {
    look: 'Długi, wąski stawonóg z wieloma krótkimi segmentami, przypominający krocionoga (stąd nazwa: „fałszywy krocionóg”).',
    life: 'Żył przy dnie, pełzając na wielu parach drobnych odnóży.',
    diff: 'Wygląda jak wij, ale nie jest z wijami spokrewniony. To przykład, jak podobny kształt powstaje niezależnie w różnych liniach.',
  },
  Fortiforceps: {
    look: 'Smukły stawonóg z masywnymi chwytakami z przodu głowy (nazwa: „mocne szczypce”).',
    life: 'Drapieżnik łapiący drobne zwierzęta przy dnie.',
    diff: 'W porównaniu z Leanchoilią ma krótsze, ale znacznie mocniejsze chwytaki, bez długich biczyków.',
  },
  Urokodia: {
    look: 'Mały stawonóg z tarczą głowową i wąskim, segmentowanym tułowiem zakończonym tarczą ogonową.',
    life: 'Żył przy dnie i prawdopodobnie zjadał drobne zwierzęta.',
    diff: 'Należy do mollisoniidów, wczesnych krewnych szczękoczułkowców. Od Mollisonii z Burgess różni się smuklejszym, dłuższym tułowiem.',
  },
  Pomatrum: {
    look: 'Kilkucentymetrowe zwierzę z dwóch części: miękkiego, workowatego przodu z otworami skrzelowymi i segmentowanego ogona.',
    life: 'Filtrował wodę przez otwory skrzelowe. W jego jelicie znaleziono osad, więc mógł też zbierać pokarm z dna.',
    diff: 'Od Vetulicoli różni się miękkim przodem bez twardych płyt.',
  },
  Acanthomeridion: {
    look: 'Kilkucentymetrowy stawonóg z płaską tarczą obrzeżoną ostrymi kolcami po bokach (nazwa: „kolczasty odcinek”).',
    life: 'Żył przy dnie, a kolce chroniły go przed drapieżnikami.',
    diff: 'Ma na głowie szwy podobne do szwów trylobitów, wzdłuż których pękał pancerz przy linieniu. Pokazuje to, że ten pomysł powstał więcej niż raz.',
  },
  Hallucigenia: {
    look: 'Lobopod o długości 1–5 cm: robakowate ciało z 7–8 parami sztywnych kolców na grzbiecie, nóżkami z pazurkami i małą głową z parą oczek i pierścieniem zębów.',
    life: 'Prawdopodobnie trzymał się gąbek tylnymi nóżkami, a przednimi, cienkimi, zbierał pokarm.',
    diff: 'Od Cardiodictyonu i Microdictyonu różni się długimi kolcami zamiast płytek.',
    fact: 'Hallucigenię rysowano najpierw do góry nogami: kolce brano za nogi, a nogi za macki na grzbiecie. Głowę pomylono z ogonem.',
  },
  Saperion: {
    look: 'Duży, płaski stawonóg o owalnej, gładkiej tarczy z miękkiego pancerza.',
    life: 'Pełzał po dnie i polował lub zbierał padlinę.',
    diff: 'Od Kuamaii różni się gładkim brzegiem tarczy bez kolców i szerszym kształtem.',
  },
  Malongella: {
    look: 'Maleńki stawonóg w dwuklapowym pancerzyku, długości kilku milimetrów.',
    life: 'Żył masowo przy dnie, zbierając drobiny pokarmu.',
    diff: 'Bradoriida, krewna Kunmingelli. Różni się kształtem klap i ich urzeźbieniem.',
  },
  Pectocaris: {
    look: 'Stawonóg z dużym pancerzem z dwóch klap i wieloma parami odnóży pokrytych gęstą szczeciną jak grzebienie.',
    life: 'Machał odnóżami, kierował wodę pod pancerz i odcedzał z niej pokarm grzebieniami.',
    diff: 'Od innych dwuklapowców z Chengjiang różni się wyspecjalizowanymi, grzebieniastymi odnóżami. To wczesny filtrator.',
  },
  Jianfengia: {
    look: 'Smukły, wielosegmentowy stawonóg z parą kolczastych chwytaków z przodu głowy.',
    life: 'Polował przy dnie na drobne zwierzęta.',
    diff: 'Jeden z megacheirów. Od Fortiforcepsa i Leanchoilii różni się bardzo długim tułowiem z wielu segmentów.',
  },
  Parapeytoia: {
    look: 'Kilkunastocentymetrowy stawonóg z chwytnymi wyrostkami przed pyskiem, podobnymi do wyrostków radiodontów.',
    life: 'Drapieżnik, prawdopodobnie przydenny.',
    diff: 'Opisano go jako radiodonta z nogami, co byłoby wyjątkiem. Nowsze badania sugerują, że to raczej megacheir z dużymi chwytakami. Okaz jest słabo zachowany, więc spór trwa.',
  },
  Shankouia: {
    look: 'Płaski stawonóg z dużą tarczą głowową i segmentowanym tułowiem.',
    life: 'Żył przy dnie i zbierał pokarm.',
    diff: 'Należy do licznych w Chengjiang krewnych trylobitów bez zwapniałego pancerza. Od Naraoii różni się tułowiem z wieloma segmentami.',
  },
  Parapaleomerus: {
    look: 'Jeden z większych stawonogów Chengjiang: szeroka, owalna, bardzo płaska tarcza z wieloma segmentami.',
    life: 'Pełzał po dnie.',
    diff: 'Od Sidneyi i Emeraldelli, swoich krewnych z Vicissicaudata, różni się szerokim, krótkim ciałem bez długiego ogona.',
  },
  Anomalocaris: {
    look: 'Największy drapieżnik kambru: do ok. 40 cm długości, z parą wielkich oczu na słupkach, dwoma kolczastymi chwytakami przed okrągłym pyskiem i płatami pływnymi wzdłuż boków.',
    life: 'Pływał falującymi ruchami płatów i chwytał miękkie zwierzęta. Ostatnie badania sugerują, że twardych trylobitów raczej nie gryzł.',
    diff: 'Od Amplectobelui różni się chwytakami bez szczypiec. Od Hurdii i Peytoi brakiem wielkiej tarczy na głowie. Był najbardziej opływowy z radiodontów.',
    fact: 'Jego części opisano najpierw jako trzy zwierzęta: chwytak jako krewetkę, pysk jako meduzę, a tułów jako gąbkę. Nazwa „anomalokarys” znaczy „dziwna krewetka”.',
  },
  Lyrarapax: {
    look: 'Mały radiodont, ok. 15 cm, z chwytakami zakończonymi szczypcami i płatami pływnymi.',
    life: 'Zwinny drapieżnik toni wodnej.',
    diff: 'Krewny Amplectobelui, ale mniejszy i z gęstszymi kolcami na chwytakach.',
    fact: 'U Lyrarapaxa zachował się mózg. Pokazał, że chwytaki radiodontów wyrastają z innego odcinka głowy niż czułki owadów.',
  },

  // ---- Burgess (Kanada, ok. 508 mln lat)
  Liangshanella: {
    look: 'Malutki, kilkumilimetrowy stawonóg w dwuklapowym pancerzyku.',
    life: 'Żył masowo przy dnie płytkich mórz.',
    diff: 'Bradoriida jak Kunmingella, ale przetrwała znacznie dłużej: od wczesnego kambru aż do ordowiku.',
  },
  Ehmaniella: {
    look: 'Mały, kilkucentymetrowy trylobit o prostej budowie: średnie oczy, sporo segmentów i niewielki ogon.',
    life: 'Chodził po dnie i zbierał pokarm z osadu.',
    diff: 'Typowy ptychopariid. Od Elrathii różni się węższą głową i wyraźniejszym rondem z przodu.',
  },
  Wiwaxia: {
    look: 'Kilkucentymetrowe, owalne zwierzę jak ślimak bez muszli, pokryte łuskami ułożonymi w rzędach, z dwiema podłużnymi rzędami długich kolców na grzbiecie.',
    life: 'Pełzało po dnie i zdrapywało glony i mikroby radulą, czyli tarką w pysku.',
    diff: 'Najbliższa krewna mięczaków w grze. Zamiast muszli miała zbroję z łusek, a kolce chroniły ją przed drapieżnikami.',
    fact: 'Wiwaxia ma radulę, typową dla mięczaków. To jeden z argumentów, że jest bliską krewną ślimaków.',
  },
  Marrella: {
    look: 'Stawonóg około 2 cm z tarczą głowową, z której wyrastały dwie pary długich, zakrzywionych kolców do tyłu. Miał dwie pary czułków i ok. 25 segmentów z odnóżami.',
    life: 'Pływała nad dnem i zbierała drobne cząstki pokarmu z mułu.',
    diff: 'Nie przypomina żadnej innej grupy. Kolce na głowie i lekka budowa odróżniają ją od pełzających artiopodów i ciężkich trylobitów.',
    fact: 'To najliczniejsze zwierzę łupków z Burgess: znaleziono ponad 25 000 okazów. Była też pierwszą skamieniałością, którą Walcott opisał z tego stanowiska w 1909 r.',
  },
  Pentagnostus: {
    look: 'Maleńki, kilkumilimetrowy trylobit z dwiema prawie identycznymi tarczami i tylko dwoma segmentami pomiędzy. Nie miał oczu.',
    life: 'Prawdopodobnie unosił się w wodzie albo żył tuż nad dnem. Mógł się zamykać jak małż.',
    diff: 'Od Pagetii różni się zupełnym brakiem oczu. Od zwykłych trylobitów rozmiarem i tym, że jego głowa i ogon wyglądają prawie tak samo.',
  },
  Yohoia: {
    look: 'Mały, smukły stawonóg z parą chwytaków z czterema kolcami na końcu i długim ciałem z ogonem w kształcie łopatki.',
    life: 'Pływał przy dnie i łapał drobne zwierzęta chwytakami.',
    diff: 'Megacheir jak Leanchoilia, ale jego chwytaki kończą się krótkimi kolcami zamiast długich biczyków.',
  },
  Laggania: {
    look: 'Radiodont z szerokim, owalnym tułowiem, płatami pływnymi wzdłuż boków i okrągłym pyskiem.',
    life: 'Prawdopodobnie przeczesywał osad lub wodę wyrostkami i zbierał miękkie zwierzęta.',
    diff: 'Okazało się, że to ta sama istota co Peytoia. Nazwę Laggania nadano tułowiowi, a Peytoia okrągłemu pyskowi.',
    fact: 'Jeden radiodont dostał w ten sposób dwie nazwy. W nauce zostaje starsza, czyli Peytoia, a „Laggania” jest tu w grze jako osobny wpis z danych.',
  },
  Sidneyia: {
    look: 'Duży stawonóg, do 16 cm, z szeroką tarczą głowową, segmentowanym tułowiem i ogonem z płaskimi płetwami.',
    life: 'Drapieżnik przydenny. W jego jelitach znaleziono rozkruszone muszle i pancerze, więc miażdżył twarde ofiary podstawami odnóży.',
    diff: 'Od Emeraldelli różni się szerokim wachlarzem ogonowym zamiast długiego biczyka i znacznie większym rozmiarem.',
    fact: 'Walcott nazwał ją na cześć syna, Sidneya, który znalazł pierwszy okaz.',
  },
  Hurdia: {
    look: 'Radiodont do 50 cm z ogromną tarczą na głowie, wystającą do przodu jak dziób, płatami pływnymi i grabiowatymi wyrostkami.',
    life: 'Przeczesywał dno lub wodę i zbierał drobne zwierzęta.',
    diff: 'Wielka tarcza głowowa odróżnia ją od anomalokarysa. Od Peytoi różni się dłuższym, bardziej wysuniętym pancerzem głowy.',
  },
  Burgessia: {
    look: 'Kilkucentymetrowy stawonóg z okrągłym, przezroczystym pancerzem, spod którego widać odnóża i rozgałęzione gruczoły trawienne, oraz z długim kolcem ogonowym.',
    life: 'Pływał i pełzał przy dnie, zbierając drobny pokarm.',
    diff: 'Od Marrelli różni się okrągłym pancerzem bez kolców na głowie i długim kolcem na ogonie.',
  },
  Elrathina: {
    look: 'Drobny trylobit długości 1–2 cm, z dużą głową, małymi oczami i niewielkim ogonem.',
    life: 'Żył masowo na mulistym dnie.',
    diff: 'Jeden z najpospolitszych trylobitów Burgess. Od Elrathii jest mniejszy i ma drobniejszy ogon.',
  },
  Perspicaris: {
    look: 'Stawonóg z dwuklapowym pancerzem i parą dużych oczu na słupkach (nazwa: „przenikliwie widzący”).',
    life: 'Pływał w toni wodnej.',
    diff: 'Od Canadaspis różni się dużymi oczami na słupkach i życiem w toni zamiast przy dnie.',
  },
  Molaria: {
    look: 'Mały, owalny stawonóg z tarczą głowową, kilkoma segmentami i długim kolcem ogonowym.',
    life: 'Pełzał i pływał przy dnie.',
    diff: 'Od Burgessii różni się segmentowanym tułowiem, a od Habelii brakiem kolców na grzbiecie.',
  },
  Plenocaris: {
    look: 'Drobny stawonóg z dwuklapowym pancerzem i długim, segmentowanym odwłokiem wystającym z tyłu.',
    life: 'Pływał przy dnie.',
    diff: 'Od Perspicarisa różni się dłuższym odwłokiem i małymi oczami. To jeden z mniej znanych hymenokaryn.',
  },
  Habelia: {
    look: 'Kilkucentymetrowy stawonóg z tarczą głowową, tułowiem z guzkami i kolcami i długim kolcem ogonowym.',
    life: 'Drapieżnik przydenny. Miał wyspecjalizowane odnóża wokół pyska, którymi rozdrabniał zdobycz.',
    diff: 'Należy do krewnych szczękoczułkowców. Od Molarii różni się kolcami na ciele i rozbudowanymi odnóżami przy pysku.',
  },
  Alalcomenaeus: {
    look: 'Stawonóg do 6 cm z parą chwytaków z biczykami, kilkoma parami oczu i ogonem w kształcie łopatki.',
    life: 'Polował na drobne zwierzęta przy dnie.',
    diff: 'Bliski krewny Leanchoilii, ale z krótszymi biczykami na chwytakach i bardziej spłaszczonym ciałem.',
    fact: 'Jego zachowany układ nerwowy jest prawie taki sam jak u dzisiejszych pająków i skorpionów.',
  },
  Emeraldella: {
    look: 'Stawonóg do 6 cm z bardzo długimi czułkami, tarczą głowową, tułowiem z wieloma segmentami i długim biczykiem na końcu ciała.',
    life: 'Chodził po dnie i polował lub zbierał padlinę.',
    diff: 'Od Sidneyi różni się smuklejszym ciałem i długim ogonem w kształcie biczyka zamiast wachlarza.',
  },
  Pagetia: {
    look: 'Maleńki trylobit długości kilku milimetrów, z dwiema podobnymi tarczami i tylko dwoma segmentami pomiędzy.',
    life: 'Żył na dnie albo tuż nad nim.',
    diff: 'W przeciwieństwie do Pentagnostusa i Geragnostusa miał oczy. To dlatego, że należy do innej linii miniaturowych trylobitów (eodiscidów).',
  },
  Kootenia: {
    look: 'Trylobit do 5 cm z mocną głową i tarczą ogonową z wachlarzem 5–7 par kolców.',
    life: 'Chodził po dnie i polował na drobne zwierzęta.',
    diff: 'Od Olenoidesa różni się szerszym ogonem z krótszymi kolcami.',
  },
  Olenoides: {
    look: 'Trylobit do 9 cm z dużą głową, ok. 7 segmentami tułowia i kolczastym ogonem. Miał długie czułki z przodu i parę czułków (cerci) na końcu ogona.',
    life: 'Drapieżnik i padlinożerca. Kolczaste podstawy odnóży rozdrabniały zdobycz.',
    diff: 'Od Kootenii różni się dłuższymi kolcami ogona i węższą sylwetką. To trylobit z najlepiej zachowanymi odnóżami i czułkami.',
    fact: 'Właśnie u Olenoides z Burgess po raz pierwszy zobaczono, jak wyglądały nogi i czułki trylobitów.',
  },
  Tuzoia: {
    look: 'Duży stawonóg z dwuklapowym pancerzem do 18 cm, pokrytym siateczką i zakończonym kolcami.',
    life: 'Pływał w toni wodnej, a pancerz z kolcami chronił go przed atakami.',
    diff: 'Jeden z największych dwuklapowców kambru. Od Isoxysa różni się większym rozmiarem i siateczkowatym urzeźbieniem pancerza.',
  },
  Pikaia: {
    look: 'Bocznie spłaszczone zwierzę długości 4–5 cm, podobne do węgorzyka, z mięśniami ułożonymi w segmenty (miomery) i parą krótkich macek na głowie.',
    life: 'Pływało, wyginając ciało w fale, i zbierało pokarm z wody.',
    diff: 'Jedyny w grze tak wczesny strunowiec z Burgess. W przeciwieństwie do wetulikolii ma strunę grzbietową i segmentowane mięśnie jak u ryb.',
    fact: 'Pikaia bywa nazywana „pradziadkiem kręgowców”: jest jedną z najstarszych krewnych naszej linii.',
  },
  Elrathia: {
    look: 'Trylobit do ok. 4 cm z szeroką, półokrągłą głową, ok. 13 segmentami tułowia i małym, zaokrąglonym ogonem.',
    life: 'Żył na mulistym dnie, gdzie było mało tlenu.',
    diff: 'Typowy ptychopariid. Od Ehmanielli różni się szerszą głową i większą liczbą segmentów.',
    fact: 'Elrathia kingii z Utah to prawdopodobnie najczęściej sprzedawana skamieniałość trylobita na świecie.',
  },
  Oryctocephalites: {
    look: 'Mały trylobit z głową z dołkami w bruzdach i ogonem z kolcami po bokach.',
    life: 'Żył na dnie.',
    diff: 'Od Oryctocephalusa różni się krótszymi kolcami na ogonie i budową bruzd na głowie.',
  },
  Mollisonia: {
    look: 'Stawonóg długości kilku centymetrów z okrągłą tarczą głowową i tarczą ogonową, między którymi było kilka segmentów.',
    life: 'Polował na dnie i rozrywał ofiary szczękoczułkami.',
    diff: 'Od Urokodii różni się krótszym, szerszym ciałem. Ma pierwsze w historii szczękoczułki, czyli cechę pająków i skorpionów.',
    fact: 'Nazwa gatunku plenovenatrix znaczy „pełny łowca”. To najstarszy znany szczękoczułkowiec.',
  },
  Oryctocephalus: {
    look: 'Trylobit długości 1–3 cm z dołkami w bruzdach na głowie i długimi kolcami na ogonie.',
    life: 'Żył przy dnie w wielu morzach świata.',
    diff: 'Od Oryctocephalitesa różni się dłuższymi kolcami ogona.',
    fact: 'Pierwsze pojawienie się gatunku Oryctocephalus indicus wyznacza oficjalny początek piętra wuliuan w kambrze.',
  },
  Caryosyntrips: {
    look: 'Radiodont znany prawie wyłącznie z przednich wyrostków: prostych, z rzędami kolców po wewnętrznej stronie.',
    life: 'Jego wyrostki działały jak nożyce: obie zamykały się na sobie i ścinały zdobycz.',
    diff: 'Inne radiodonty chwytały albo cedziły. Caryosyntrips tnie. Nazwa znaczy „łamacz orzechów”.',
  },
  Opabinia: {
    look: 'Kilkucentymetrowe zwierzę z pięcioma oczami na głowie i długą, giętką trąbą zakończoną chwytakiem. Ciało miało płaty pływne po bokach i ogon z płetwami.',
    life: 'Pływała przy dnie i chwytała drobne zwierzęta trąbą, a potem podawała je do pyska.',
    diff: 'To krewna radiodontów, ale zamiast dwóch chwytaków ma jedną trąbę. Od anomalokarysa jest też dużo mniejsza.',
    fact: 'Kiedy w 1972 r. pokazano rekonstrukcję opabinii na konferencji, sala wybuchła śmiechem, bo brano to za żart.',
  },
  Chanciaopsis: {
    look: 'Trylobit długości kilku centymetrów o typowej budowie ptychopariida.',
    life: 'Żył na dnie.',
    diff: 'Od Elrathii różni się kształtem głowy i ogona. Należy do tej samej rodziny alokistokaryd.',
  },
  Peytoia: {
    look: 'Radiodont do ok. 40 cm z szerokim tułowiem, płatami pływnymi i wyrostkami z długimi kolcami przed okrągłym pyskiem.',
    life: 'Przeczesywał wodę i dno wyrostkami, wyłapując miękkie zwierzęta.',
    diff: 'Krewna Hurdii, ale z mniejszą tarczą na głowie. Od anomalokarysa różni się szerszym ciałem i wyrostkami przystosowanymi do zgarniania, a nie chwytania.',
    fact: 'Jej okrągły pysk opisano najpierw jako meduzę i nadano mu nazwę Peytoia. Ta nazwa została w końcu dla całego zwierzęcia.',
  },
  Ogygopsis: {
    look: 'Trylobit do 12 cm z dużą tarczą ogonową prawie tak wielką jak głowa.',
    life: 'Żył na dnie płytkiego morza.',
    diff: 'Od Olenoidesa i Kootenii różni się gładkim ogonem bez kolców.',
    fact: 'Na stoku Mount Stephen w Kanadzie jego skorupy leżą tak licznie, że stanowisko nazwano „łóżkiem trylobitów”.',
  },
  Zacanthoides: {
    look: 'Kolczasty trylobit z długimi kolcami policzkowymi, kolcami na końcach segmentów i długim kolcem na grzbiecie.',
    life: 'Żył na dnie, a kolce chroniły go przed drapieżnikami.',
    diff: 'Najbardziej kolczasty trylobit Burgess. Od Olenoidesa różni się małym ogonem i kolcem na grzbiecie.',
  },
  Ptychoparella: {
    look: 'Trylobit długości kilku centymetrów o prostej budowie ptychopariida.',
    life: 'Żył na dnie.',
    diff: 'Od Elrathiny jest większy i ma mocniej zaznaczoną budowę głowy.',
  },

  // ---- Fezouata (Maroko, ok. 478 mln lat)
  Asaphellus: {
    look: 'Gładki trylobit do 10 cm z dużą, zaokrągloną tarczą ogonową i wygładzonymi bruzdami.',
    life: 'Żył na dnie i potrafił zakopywać się w osadzie.',
    diff: 'Od Basilicusa różni się mniejszymi rozmiarami i jeszcze gładszym pancerzem.',
    fact: 'To najpospolitszy trylobit z Fezouaty.',
  },
  Ampyx: {
    look: 'Mały, ślepy trylobit z długim kolcem wyrastającym z czoła i dwoma długimi kolcami policzkowymi.',
    life: 'Chodził po mulistym dnie, gdzie nie potrzebował oczu.',
    diff: 'Od innych trylobitów Fezouaty różni się brakiem oczu i trzema długimi kolcami.',
    fact: 'W Fezouacie znaleziono Ampyksy ułożone w kolejkę jeden za drugim, kolcami do siebie. To najstarszy dowód zbiorowej wędrówki zwierząt.',
  },
  Bathycheilus: {
    look: 'Krępy trylobit o typowej budowie kalymeny.',
    life: 'Żył na dnie płytkiego morza.',
    diff: 'Od Prionocheilusa różni się kształtem głowy i ogona.',
  },
  Colpocoryphe: {
    look: 'Średniej wielkości trylobit o gładkiej, wydłużonej sylwetce z zatartymi bruzdami.',
    life: 'Żył na dnie płytkich mórz Gondwany.',
    diff: 'Od Plaesiacomii różni się kształtem głowy i ogona. Obie należą do tej samej podrodziny.',
  },
  Toletanaspis: {
    look: 'Trylobit z oczami z dużych soczewek i trójkątną tarczą ogonową.',
    life: 'Żył na dnie i dobrze widział w półmroku.',
    diff: 'Od Ormathopsa różni się budową ogona.',
  },
  Apatokephalus: {
    look: 'Trylobit z wielkimi oczami owiniętymi wokół głowy.',
    life: 'Aktywnie pływał nad dnem.',
    diff: 'Od asafidów różni się wielkimi oczami i budową głowy. To jedyny remopleuridid w grze.',
  },
  Euloma: {
    look: 'Mały trylobit z głęboko bruzdowaną środkową częścią głowy.',
    life: 'Żył na dnie.',
    diff: 'Od Leptoplastidesa różni się głębszymi bruzdami i krótszym tułowiem.',
  },
  Prionocheilus: {
    look: 'Krępy trylobit o budowie kalymeny.',
    life: 'Żył na dnie płytkiego morza.',
    diff: 'Od Bathycheilusa różni się kształtem głowy.',
  },
  Neseuretus: {
    look: 'Trylobit do ok. 8 cm o masywnej budowie z wyraźnie płatową glabellą.',
    life: 'Żył w płytkiej wodzie przy piaszczystym brzegu.',
    diff: 'Od Pradoelli, swojej krewnej, jest większy.',
    fact: 'Neseuretus występuje w tych samych skałach co ślady Cruziana, czyli rowki wyryte w piasku przez pełzające trylobity.',
  },
  Pradoella: {
    look: 'Kalymena z dzwonowatą glabellą i krępym ciałem.',
    life: 'Żyła na dnie.',
    diff: 'Od Neseuretusa jest mniejsza i ma inne proporcje głowy.',
  },
  Destombesiceras: {
    look: 'Wczesny głowonóg z prostą, stożkowatą muszlą podzieloną na komory.',
    life: 'Pływał, regulując wyporność w komorach muszli, i polował na drobne zwierzęta.',
    diff: 'Od Polymeresa różni się budową komór.',
  },
  Bavarilla: {
    look: 'Kalymena o krępej budowie i drobnych oczach.',
    life: 'Żyła na dnie.',
    diff: 'Od Prionocheilusa różni się kształtem ogona.',
  },
  Symphysurus: {
    look: 'Gładki, wypukły trylobit z dużymi oczami.',
    life: 'Żył przy dnie i potrafił się szczelnie zwijać w kulkę.',
    diff: 'Od Asaphellusa różni się mocno wypukłym ciałem i większymi oczami.',
  },
  Polymeres: {
    look: 'Głowonóg z prostą, stożkowatą muszlą.',
    life: 'Pływał i polował na drobne zwierzęta.',
    diff: 'Od Destombesicerasa różni się budową syfonu, czyli rurki łączącej komory.',
  },
  Ceraurinella: {
    look: 'Trylobit z ziarnistą głową i tarczą ogonową z kolców.',
    life: 'Żył na dnie.',
    diff: 'Od Foulonii różni się dłuższymi kolcami ogona.',
  },
  Agerina: {
    look: 'Trylobit z szeroką, gładką głową.',
    life: 'Żył na dnie.',
    diff: 'Corynexochid, ale bez kolców na ogonie, którymi wyróżniają się kambryjscy krewni jak Olenoides.',
  },
  Foulonia: {
    look: 'Cheirurid z urzeźbioną głową i ogonem z kolców.',
    life: 'Żyła na dnie.',
    diff: 'Od Ceraurinelli różni się kształtem głowy i krótszymi kolcami ogona.',
  },
  Geragnostus: {
    look: 'Maleńki, ślepy trylobit z dwiema niemal identycznymi tarczami.',
    life: 'Prawdopodobnie unosił się w wodzie albo żył tuż nad dnem.',
    diff: 'Od Pentagnostusa różni się budową tarcz. To jeden z ostatnich agnostidów.',
  },
  Basilicus: {
    look: 'Duży, gładki trylobit z wielką tarczą ogonową.',
    life: 'Żył na dnie i potrafił zakopywać się w osadzie.',
    diff: 'Od Asaphellusa jest większy. Od Kierargesa różni się kształtem ogona.',
  },
  Leptoplastides: {
    look: 'Mały trylobit z cienkim pancerzem i wieloma segmentami.',
    life: 'Żył na dnie ubogim w tlen.',
    diff: 'Od Euloma różni się dłuższym tułowiem z większą liczbą segmentów.',
  },
  Bathmoceras: {
    look: 'Głowonóg z prostą muszlą i nietypowymi przegrodami między komorami.',
    life: 'Pływał w toni wodnej.',
    diff: 'Od Rioceras różni się budową syfonu i przegród.',
  },
  Rioceras: {
    look: 'Głowonóg z prostą, stożkowatą muszlą.',
    life: 'Pływał i polował.',
    diff: 'Od Bathmocerasa różni się budową syfonu.',
  },
  Anacheirurus: {
    look: 'Wczesny cheirurid z ogonem z kolców.',
    life: 'Żył na dnie.',
    diff: 'Od Ceraurinelli jest starszy i ma prostszą budowę.',
  },
  Kierarges: {
    look: 'Duży, gładki trylobit z szeroką tarczą ogonową.',
    life: 'Żył na dnie.',
    diff: 'Krewny Isotelusa z podrodziny gigantów. Od Basilicusa różni się szerszym ogonem.',
  },
  Pterygometopus: {
    look: 'Trylobit z wysokimi oczami z wielu soczewek.',
    life: 'Żył na dnie i dobrze widział w półmroku.',
    diff: 'Od Ormathopsa różni się wyższymi oczami.',
  },
  Ormathops: {
    look: 'Trylobit z oczami schizochroalnymi i trójkątną tarczą ogonową.',
    life: 'Żył na dnie.',
    diff: 'Od Toletanaspisa różni się kształtem głowy.',
  },
  Plaesiacomia: {
    look: 'Gładki, wydłużony trylobit z zatartymi bruzdami.',
    life: 'Żył na dnie płytkich mórz Gondwany.',
    diff: 'Od Colpocoryphe różni się kształtem ogona.',
  },
  Aegirocassis: {
    look: 'Olbrzymi radiodont długości ok. 2 m, z wielką tarczą na głowie i dwoma rzędami płatów wzdłuż ciała.',
    life: 'Spokojnie pływał i cedził plankton wyrostkami z gęstymi szczecinkami, jak dzisiejsze fiszbinowce.',
    diff: 'Największy z radiodontów. Od Hurdii różni się ogromnymi rozmiarami i wyrostkami do filtrowania zamiast zgarniania.',
    fact: 'Miał dwa rzędy płatów: górny i dolny. To wskazówka, jak powstały dwugałęziste odnóża stawonogów: jedna gałąź do pływania, druga do oddychania.',
  },
  // ---- Gogo (Australia, ok. 380 mln lat)
  Manticoceras: {
    look: 'Amonit (goniatyt) z płasko zwiniętą muszlą o ostrym brzegu i falistych liniach przegród.',
    life: 'Szybko pływał w toni i polował na drobne zwierzęta.',
    diff: 'Od późniejszych amonitów różni się prostszymi, falistymi przegrodami zamiast zawiłych.',
    fact: 'Prawie zupełnie zniknął w wymieraniu późnodewońskim, które przetrzebiło rafy i morza.',
  },
  // ---- added with the Librarian's data batch 1 (chapters 1–2)
  Haikouichthys: {
    look: 'Rybka bez szczęk długości ok. 2,5 cm: wydłużone ciało z płetwą grzbietową, mięśnie ułożone w zygzaki, kilka łuków skrzelowych i para oczu.',
    life: 'Pływała przy dnie płytkiego morza i zasysała drobne cząstki pokarmu. Była za mała, by polować na większe zwierzęta.',
    diff: 'Od Myllokunmingii różni się szczegółami płetw i skrzeli. Obie należą do najstarszych znanych kręgowców.',
    fact: 'Ma ślady chrzęstnej czaszki i oczu – to jedna z najstarszych znanych głów kręgowca (ok. 518 mln lat).',
  },
  Myllokunmingia: {
    look: 'Rybka bez szczęk długości ok. 3 cm, z płetwą grzbietową, mięśniami w kształcie litery V i kilkoma workami skrzelowymi.',
    life: 'Żyła w toni płytkiego morza Chengjiang i zbierała drobny pokarm z wody.',
    diff: 'Bliska krewna Haikouichthysa. Razem tworzą rodzinę Myllokunmingiidae, najstarszych kręgowców.',
    fact: 'Opisano ją w 1999 r. razem z Haikouichthysem. To odkrycie przesunęło początek kręgowców do wczesnego kambru.',
  },
  Zhongjianichthys: {
    look: 'Drobna, smukła rybka bez szczęk długości 2–3 cm, z parą oczu i szeregiem worków skrzelowych.',
    life: 'Pływała tuż nad dnem i zbierała drobny pokarm.',
    diff: 'Smuklejsza od Haikouichthysa i Myllokunmingii, bez wyraźnej płetwy grzbietowej.',
  },
  Haikouella: {
    look: 'Zwierzę długości 2–4 cm podobne do rybki bez płetw: struna grzbietowa, szereg łuków skrzelowych, mięśnie w odcinkach i duże gardło.',
    life: 'Filtrowała wodę przez gardło ze szczelinami skrzelowymi i zatrzymywała drobiny pokarmu.',
    diff: 'Nie ma wyraźnej czaszki ani płetw jak Haikouichthys. Czy to strunowiec bliski kręgowcom, czy daleki krewny – badacze się spierają.',
    fact: 'Znane są tysiące okazów. To jedna z najliczniejszych „prawie-ryb” Chengjiang.',
  },
  Yunnanozoon: {
    look: 'Miękkie, wydłużone zwierzę długości ok. 4 cm z blokami mięśni w odcinkach i szeregiem łuków skrzelowych.',
    life: 'Filtrator: przepuszczał wodę przez gardło i zatrzymywał drobne cząstki pokarmu.',
    diff: 'Bardzo podobny do Haikouelli. Jedni widzą w nim strunowca, inni półstrunowca – jego pozycja jest sporna.',
  },
  Metaspriggina: {
    look: 'Rybka bez szczęk długości ok. 6 cm, z dwojgiem dużych oczu, zygzakowatymi mięśniami i siedmioma parami łuków skrzelowych.',
    life: 'Pływała w toni u stóp klifu Burgess. Duże oczy sugerują, że aktywnie pływała i wypatrywała drapieżników.',
    diff: 'Lepiej zachowana od starszych rybek z Chengjiang. Jej pierwsza para łuków skrzelowych różni się od pozostałych – to zapowiedź przyszłej szczęki.',
    fact: 'Okazy opisane w 2014 r. z Marble Canyon zachowały oczy, nozdrza i łuki skrzelowe.',
  },
  Eldonia: {
    look: 'Płaski krążek średnicy do ok. 10 cm ze zwiniętym w spiralę jelitem i pęczkiem macek przy pyszczku.',
    life: 'Prawdopodobnie leżała na dnie albo unosiła się w wodzie i łapała mackami drobny pokarm.',
    diff: 'Wygląda jak meduza, ale budowa jelita i macek łączy ją raczej z wtóroustymi (grupa Cambroernida).',
    fact: 'Przez dziesięciolecia uważano ją za strzykwę albo meduzę.',
  },
  Leptomitus: {
    look: 'Gąbka w kształcie długiej, wąskiej rurki, o ściankach z cienkich igieł krzemionkowych ułożonych wzdłuż.',
    life: 'Stała w mule i przepompowywała wodę przez ścianki, odfiltrowując bakterie i drobiny.',
    diff: 'Od Choi różni się kształtem: smukła rurka zamiast niskiej kopułki z długimi igłami.',
  },
  Choia: {
    look: 'Niska, kopulasta gąbka średnicy kilku cm, z długimi igłami krzemionkowymi sterczącymi promieniście na boki.',
    life: 'Leżała na dnie. Długie igły mogły utrzymywać ją na miękkim mule i zniechęcać zjadaczy.',
    diff: 'W odróżnieniu od rurkowatego Leptomitusa przypomina jeżyka. To jedna z najczęstszych gąbek Burgess.',
  },
  Vauxia: {
    look: 'Krzaczasta gąbka wysoka na kilka cm, z rozgałęzionych rurek o siateczkowatych ściankach.',
    life: 'Przyczepiona do dna filtrowała wodę. Na jej gałązkach siadały czasem drobne zwierzęta.',
    diff: 'Jej szkielet nie miał twardych igieł, tylko elastyczną siateczkę. Uważa się ją za wczesną krewną dzisiejszych gąbek rogowych.',
  },
  Diandongia: {
    look: 'Ramienionóg o dwóch okrągłych muszelkach szerokości 1–2 cm, z drobnymi promienistymi żeberkami.',
    life: 'Przytwierdzony mięsistą nóżką do dna filtrował wodę wieńcem macek (lofoforem) ukrytym między muszelkami.',
    diff: 'Zachowały się jego miękkie części: nóżka i macki. Widać, że już wtedy ramienionogi żyły tak jak dzisiejsze.',
  },
  Longtancunella: {
    look: 'Mały ramienionóg o owalnych, gładkich muszelkach szerokości ok. 1 cm, z krótką nóżką.',
    life: 'Często przyczepiał się nóżką do muszli innych osobników i żył w skupiskach.',
    diff: 'Od Diandongii różni się gładszą muszlą i życiem w gromadzie.',
  },
  Heliomedusa: {
    look: 'Ramienionóg o niemal okrągłych muszelkach średnicy do ok. 3 cm, z delikatnymi szczecinkami na brzegach.',
    life: 'Prawdopodobnie leżał swobodnie na dnie i filtrował wodę.',
    diff: 'Długo uważano go za meduzę – stąd nazwa. Dopiero dobrze zachowane okazy pokazały dwie muszle ramienionoga.',
  },
  Maotianshania: {
    look: 'Cienki robak długości kilku cm, z ciałem z drobnych pierścieni.',
    life: 'Żył w mule dna i zbierał z niego drobny pokarm.',
    diff: 'To robak bez nóg z grupy niezmogowców i ich krewnych. W odróżnieniu od Selkirkii nie mieszkał w rurce.',
  },
  Selkirkia: {
    look: 'Robak długości kilku cm mieszkający w stożkowatej, twardej rurce, z której wystawała kolczasta, wywracana trąbka.',
    life: 'Siedział w rurce wbitej w muł i łapał drobne zwierzęta, wysuwając trąbkę.',
    diff: 'Od Ottoii różni się domkiem: Ottoia ryła swobodnie w mule, Selkirkia nosiła rurkę.',
  },
  Ottoia: {
    look: 'Robak długości ok. 8 cm z wywracaną trąbką obsadzoną haczykami i kolcami.',
    life: 'Drapieżnik ryjący w mule. W jego jelitach znaleziono resztki innych zwierząt, nawet osobników własnego gatunku.',
    diff: 'Najliczniejszy robak Burgess. W odróżnieniu od Selkirkii nie miał rurki.',
    fact: 'Jest bardzo podobna do dzisiejszych niezmogowców (Priapulida), które wciąż żyją w mule morskiego dna.',
  },
  Burgessochaeta: {
    look: 'Robak wieloszczetowy długości do ok. 5 cm, z kilkunastoma odcinkami i pękami szczecinek po bokach.',
    life: 'Żył w mule i zbierał drobny pokarm z dna parą czułków przy głowie.',
    diff: 'Od Canadii różni się prostszymi szczecinkami, które nie zakrywały grzbietu.',
  },
  Canadia: {
    look: 'Pierścienica długości ok. 3 cm z pękami szczecin na każdym odcinku. Szczeciny zakrywały grzbiet jak łuski.',
    life: 'Pełzała po dnie w poszukiwaniu pokarmu.',
    diff: 'Szczeciny Canadii były płaskie i nachodziły na siebie – tego nie ma Burgessochaeta.',
    fact: 'Drobna struktura szczecin sugeruje, że Canadia mogła mienić się kolorami jak masa perłowa.',
  },
  Xianguangia: {
    look: 'Polip podobny do ukwiału, wysoki na kilka cm, z walcowatym ciałem i wieńcem pierzastych macek.',
    life: 'Siedział przytwierdzony do dna i chwytał mackami drobne zwierzęta z wody.',
    diff: 'Jeden z najstarszych znanych polipów parzydełkowców. Jego dokładne pokrewieństwo z koralowcami jest dyskutowane.',
  },
  Maotianoascus: {
    look: 'Galaretowaty żebropław średnicy kilku cm z rzędami grzebyków z rzęsek biegnącymi wzdłuż ciała.',
    life: 'Pływał, poruszając rzędami grzebyków, i łapał drobne zwierzęta.',
    diff: 'Od meduz różni się tym, że nie ma parzydełek i porusza się rzęskami, a nie skurczami dzwonu.',
  },
  Nectocaris: {
    look: 'Spłaszczone zwierzę długości kilku cm z płetwami wzdłuż boków, dwojgiem dużych oczu i parą długich macek.',
    life: 'Pływał, falując płetwami, i prawdopodobnie łapał mackami drobne zwierzęta.',
    diff: 'Jego pozycja jest sporna: jedni widzą w nim wczesnego głowonoga, krewnego kałamarnic, inni odrębną, wymarłą linię.',
  },
  Odontogriphus: {
    look: 'Płaskie, owalne zwierzę długości do ok. 12 cm, bez muszli i kolców, z tarką (radulą) w pyszczku.',
    life: 'Pełzał po dnie i zeskrobywał tarką maty bakteryjne.',
    diff: 'Przypomina Wiwaxię bez łusek i kolców. Obie mają podobną tarkę, co łączy je z mięczakami.',
  },
  Gogia: {
    look: 'Szkarłupień na krótkiej łodyżce: kielich z nieregularnych płytek i kilka długich, cienkich ramion.',
    life: 'Przytwierdzony do dna wystawiał ramiona do prądu i łowił drobiny pokarmu.',
    diff: 'To eokrynoid – starszy, prostszy krewny liliowców. Jego płytki nie układały się jeszcze w regularny wzór.',
  },
  Spartobranchus: {
    look: 'Robak jelitodyszny długości kilku cm z ryjkiem, kołnierzem i długim tułowiem, mieszkający w rurkach.',
    life: 'Siedział w rurce na dnie i zbierał drobne cząstki pokarmu.',
    diff: 'To półstrunowiec, krewny graptolitów. Jego rurki pokazują, skąd mógł się wziąć domek graptolitów.',
    fact: 'Opisano go w 2013 r. na podstawie ponad tysiąca okazów z Burgess.',
  },
  Sanctacaris: {
    look: 'Stawonóg długości ok. 9 cm z szeroką tarczą na głowie, pięcioma parami chwytnych odnóży z przodu i płaskim ogonem.',
    life: 'Drapieżnik pływający przy dnie. Odnóżami tworzył „koszyk”, w który łapał ofiary.',
    diff: 'Uważa się go za jednego z najstarszych krewnych szczękoczułkowców (pająków, skorpionów), choć szczegóły są sporne.',
  },
};

// ---------------------------------------------------------------- lookups with fallbacks

/** genus ids that have hand-written lore */
export const LORE_GENERA = new Set<number>([...GENERA.values()].filter((g) => GENUS_LORE[g.name]).map((g) => g.id));

const HABITAT = { land: 'na lądzie', freshwater: 'w słodkiej wodzie', marine: 'w morzu', air: 'w powietrzu' } as const;
const FOOD = { meat: 'mięso', plants: 'rośliny', fish: 'ryby', plankton: 'plankton' } as const;
const SIZE = { XS: 'bardzo mały', S: 'mały', M: 'średni', L: 'duży', XL: 'ogromny' } as const;

export function genusLore(g: Genus): GenusLore {
  const hand = GENUS_LORE[g.name];
  if (hand) return hand;
  const fam = g.family ? `z rodziny ${g.family}` : g.order ? `z rzędu ${g.order}` : '';
  return {
    look: `${SIZE[g.size][0].toUpperCase()}${SIZE[g.size].slice(1)} przedstawiciel ${fam || 'swojej grupy'}.`,
    life: `Żył ${HABITAT[g.habitat]} w okresie ${periodLabel(g.fromMa, g.toMa)}, jadł ${FOOD[g.food]}.`,
    diff: 'Szczegółowy opis tego rodzaju dopiero powstaje.',
  };
}

export function cladeLore(id: number): CladeLore | undefined {
  const c = CLADES.get(id);
  if (!c) return undefined;
  const hand = CLADE_LORE[c.name];
  if (hand) return hand;
  const inf = CLADE_INFO[c.name];
  if (inf) return { appeared: inf.trait, desc: inf.desc };
  return undefined;
}

/** sites where a genus can be dug, by id */
export function genusSites(id: number): string[] {
  return SITES.filter((s) => s.fauna.some((f) => f.genusId === id)).map((s) => s.id);
}

export { SITE_BY_ID };

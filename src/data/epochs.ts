// Educational layer: every dig site is one stage of the history of life. Sites open oldest first (content.ts),
// so walking through them is walking up the tree of life. Texts are short on purpose: one idea per stage.

import { CLADES, GENERA, SITES, ancestorIds } from './db';
import type { CladeNode } from './types';
import { SITE_UNLOCK } from '../game/content';

export interface Epoch {
  /** short name of the evolutionary stage */
  title: string;
  /** what this stage is about (2–3 sentences) */
  story: string;
  /** evolutionary innovations you meet here */
  innovations: string[];
  /** one memorable fact */
  fact: string;
  /** a mass extinction that closes (or follows) this stage */
  extinction?: string;
}

export const EPOCHS: Record<string, Epoch> = {
  // ---- sites added with the Librarian's batch 2 (filling the gaps in time)
  cincinnati: {
    title: 'Morza późnego ordowiku',
    story: 'Płytkie, ciepłe morze zalewa środek Ameryki Północnej. Dno pokrywają ławice ramienionogów, mszywiołów i liliowców, między nimi pełzają trylobity, a w toni polują łodziki. To szczyt Wielkiego Ordowickiego Różnicowania.',
    innovations: ['rafy mszywiołów i koralowców', 'łąki liliowców', 'wielkie łodziki o prostych muszlach'],
    fact: 'Skały Cincinnati są tak pełne skamieniałości, że mieszkańcy znajdują trylobity i ramienionogi w ogródkach i przy drogach.',
    extinction: 'Wymieranie ordowickie (ok. 445 mln lat temu): zlodowacenie Gondwany obniżyło poziom mórz i zabiło ok. 85% gatunków morskich.',
  },
  bertie: {
    title: 'Królestwo wielkoraków',
    story: 'W sylurze płytkie, słone laguny przykrywają okolice dzisiejszego jeziora Erie. Rządzą w nich wielkoraki, krewni skorpionów, a na brzegach pojawiają się pierwsze rośliny i stawonogi zaglądające na ląd.',
    innovations: ['wielkoraki – największe stawonogi', 'pierwsze skorpiony', 'ryby ze szczękami w rozkwicie'],
    fact: 'Eurypterus remipes z formacji Bertie jest skamieniałością stanową Nowego Jorku.',
  },
  rhynie: {
    title: 'Pierwsze ekosystemy lądowe',
    story: 'Wczesny dewon. W Szkocji wrzące źródła zalewają mokradła krzemionką i zamieniają w kamień całe małe ekosystemy lądowe: niskie rośliny bez liści, grzyby, roztocza, pajęczaki i drobne owady.',
    innovations: ['rośliny naczyniowe', 'pierwsze owady i pajęczaki na lądzie', 'współpraca roślin z grzybami'],
    fact: 'W czercie z Rhynie zachowały się nawet komórki roślin i grzybnia w ich korzeniach – po ok. 410 mln lat.',
  },
  east_kirkton: {
    title: 'Czworonogi schodzą z wody',
    story: 'Wczesny karbon. Wśród wulkanów Szkocji leży jezioro z gorącymi źródłami. Na jego brzegach żyją jedne z pierwszych w pełni lądowych czworonogów, a w ściółce skorpiony i wije.',
    innovations: ['czworonogi żyjące na lądzie', 'przodkowie gadów i płazów', 'pierwsze lasy'],
    fact: 'Z East Kirkton opisano Westlothianę, przez lata nazywaną „najstarszym gadem” – dziś wiadomo, że to bliski krewny przodków gadów.',
  },
  joggins: {
    title: 'Pierwsze gady wśród widłaków',
    story: 'Późny karbon. Na bagnach rosną lasy olbrzymich widłaków i skrzypów, z których powstanie węgiel. Wśród nich żyją płazy, wije i pierwsze gady, które składają jaja na lądzie.',
    innovations: ['jajo owodniowe', 'pierwsze gady', 'lasy olbrzymich widłaków'],
    fact: 'Hylonomusa znaleziono w pniach skamieniałych drzew. Małe zwierzęta wpadały do pustych pni i nie mogły się wydostać.',
  },
  red_beds: {
    title: 'Świat Dimetrodona',
    story: 'Wczesny perm. Teksas leży na równiku wielkiego kontynentu Pangea. W porze suchej rzeki wysychają. Żyją tu płazy, wczesne gady i pelykozaury z żaglami na grzbietach – dalecy przodkowie ssaków.',
    innovations: ['synapsydy (linia ssaków) zaczynają dominować', 'pierwsze duże roślinożerne kręgowce lądowe', 'żagle do regulacji temperatury?'],
    fact: 'Dimetrodon nie był dinozaurem. Był bliżej spokrewniony z Tobą niż z jakimkolwiek dinozaurem.',
  },
  elliot: {
    title: 'Świt dinozaurów w Gondwanie',
    story: 'Przełom triasu i jury. Po wymieraniu triasowym dinozaury zajmują puste miejsca. W południowej Afryce żyją wczesne zauropodomorfy, drobne drapieżne teropody, krokodylokształtne i pierwsze ssakokształtne.',
    innovations: ['wczesne zauropodomorfy', 'opieka nad gniazdem', 'drobne ssakokształtne'],
    fact: 'Gniazdo Massospondylusa z Elliot zawiera embriony sprzed ok. 190 mln lat – jedne z najstarszych znanych zarodków dinozaurów.',
    extinction: 'Wymieranie triasowe (ok. 201 mln lat temu): wulkanizm przy pękającej Pangei zniszczył wielu krewnych krokodyli. Dinozaury przetrwały.',
  },
  cedar_mountain: {
    title: 'Wczesna kreda Ameryki',
    story: 'Wczesna kreda. Równiny Utah przecinają rzeki. Żyją tu raptory, wczesne ankylozaury i iguanodonty, a pod koniec tego czasu pojawiają się rośliny kwiatowe.',
    innovations: ['rośliny kwiatowe', 'wielkie dromeozaury', 'pancerne ankylozaury'],
    fact: 'Utahraptor miał na stopie pazur długości ponad 20 cm.',
  },
  santa_cruz: {
    title: 'Wyspa Ameryki Południowej',
    story: 'Wczesny miocen. Ameryka Południowa jest odciętą wyspą, tak jak dziś Australia. Wyewoluowały tu własne kopytne, drapieżne torbacze, leniwce, gliptodonty i ptaki terroru.',
    innovations: ['własne kopytne Ameryki Południowej', 'drapieżne torbacze', 'ptaki terroru'],
    fact: 'Skamieniałości z Santa Cruz zbierał w 1834 r. Karol Darwin w czasie podróży „Beagle”.',
  },
  siwaliki: {
    title: 'U stóp Himalajów',
    story: 'Od miocenu po pliocen rzeki z wypiętrzających się Himalajów zasypują doliny mułem. Żyją tu małpy człekokształtne, przodkowie słoni, żyrafy, hipopotamy i duże koty.',
    innovations: ['małpy człekokształtne Azji', 'trawy i sawanny', 'nowoczesne słonie'],
    fact: 'Sivapithecus z Siwalików jest przodkiem lub bliskim krewnym orangutanów.',
  },
  chengjiang: {
    title: 'Eksplozja kambryjska',
    story: 'W ciągu kilkunastu milionów lat w morzach pojawiają się niemal wszystkie główne typy zwierząt. Chengjiang zachował nawet ich miękkie ciała: oczy, jelita, skrzela.',
    innovations: ['twarde pancerze i muszle', 'oczy złożone', 'pierwsi drapieżcy', 'pierwsze strunowce, z których wyjdą kręgowce'],
    fact: 'Haikouichthys i Myllokunmingia z Chengjiang to jedne z najstarszych znanych kręgowców. Miały kilka centymetrów długości i nie miały szczęk.',
  },
  burgess: {
    title: 'Dziwy kambryjskiego morza',
    story: 'Łupki z Burgess pokazują, jak bardzo eksperymentowała ewolucja: zwierzęta z pięcioma oczami, z kolcami na grzbiecie, z chwytnymi ramionami przy pysku. Wiele z tych linii nie zostawiło potomków.',
    innovations: ['segmentowane ciała stawonogów', 'odnóża do chodzenia i pływania', 'struna grzbietowa (Pikaia)'],
    fact: 'Hallucigenię długo rysowano do góry nogami: kolce brano za nogi, a nogi za macki na grzbiecie.',
  },
  fezouata: {
    title: 'Wielkie różnicowanie ordowickie',
    story: 'Na początku ordowiku liczba rodzajów w morzach mnoży się kilkukrotnie. Fezouata pokazuje, że kambryjskie „dziwadła” przetrwały dłużej, niż sądzono, i urosły.',
    innovations: ['planktonożerne olbrzymy', 'pierwsze rafy z mszywiołów', 'głowonogi łodzikowate'],
    fact: 'Aegirocassis z Fezouaty miał około 2 m długości. Był krewnym anomalokarysa, ale nie polował: cedził plankton jak dzisiejsze wieloryby.',
    extinction: 'Wymieranie ordowickie (ok. 445 mln lat temu): zlodowacenie zabiło około 85% gatunków morskich. To pierwsze z „wielkiej piątki” wymierań.',
  },
  gogo: {
    title: 'Wiek ryb',
    story: 'W dewonie ryby stają się panami mórz. Rafa Gogo zachowała je w trójwymiarowych konkrecjach, czasem z mięśniami i nerwami. Wśród nich są ryby mięśniopłetwe, przodkowie wszystkich czworonogów.',
    innovations: ['szczęki', 'ryby pancerne (plakodermy)', 'płetwy z kośćmi jak w kończynach', 'zapłodnienie wewnętrzne'],
    fact: 'Materpiscis z Gogo to ryba-matka z embrionem i śladem pępowiny. To najstarszy znany dowód żyworodności u kręgowców.',
  },
  cleveland: {
    title: 'Pancerni giganci dewonu',
    story: 'U schyłku dewonu morze należy do wielkich plakodermów i pierwszych rekinów. Ryby mięśniopłetwe w tym czasie wychodzą już na ląd.',
    innovations: ['wielkie drapieżne ryby', 'pierwsze rekiny (Cladoselache)', 'w tym samym czasie: pierwsze czworonogi na lądzie'],
    fact: 'Dunkleosteus nie miał zębów: tnące krawędzie tworzyły kostne płyty szczęk, które ostrzyły się o siebie przy każdym kłapnięciu.',
    extinction: 'Wymieranie dewońskie (ok. 372 i 359 mln lat temu) zakończyło epokę plakodermów. Ryby pancerne zniknęły całkowicie.',
  },
  mazon_creek: {
    title: 'Lasy węglowe i podbój lądu',
    story: 'W karbonie bagienne lasy z paproci i widłaków tworzą dzisiejszy węgiel. W powietrzu jest więcej tlenu niż dziś, więc owady i wije rosną do olbrzymich rozmiarów. Płazy mają się świetnie, a obok nich pojawiają się pierwsze owodniowce.',
    innovations: ['jajo owodniowe (niezależność od wody)', 'pierwsze latające zwierzęta: owady', 'płazy i pierwsze gady'],
    fact: 'Potwór z Tully (Tullimonstrum) z Mazon Creek to stanowa skamieniałość Illinois. Do dziś nie wiadomo na pewno, czy był kręgowcem.',
  },
  karoo: {
    title: 'Gady ssakokształtne',
    story: 'W permie lądem rządzą synapsydy, czyli linia, z której wyjdą ssaki. Karoo pokazuje ich drogę od gorgonopsów z szablastymi kłami po cynodonty, coraz bardziej podobne do ssaków.',
    innovations: ['zęby zróżnicowane na siekacze, kły i trzonowce', 'podniebienie wtórne (oddychanie podczas jedzenia)', 'prawdopodobnie futro i stałocieplność u cynodontów'],
    fact: 'Lystrosaurus przetrwał największe wymieranie w historii i na początku triasu stanowił nawet 90% kręgowców lądowych w niektórych miejscach.',
    extinction: 'Wymieranie permskie (ok. 252 mln lat temu), „Wielkie Umieranie”: zginęło około 90% gatunków morskich i 70% lądowych.',
  },
  ischigualasto: {
    title: 'Narodziny dinozaurów',
    story: 'Ischigualasto w Argentynie skrywa jedne z najstarszych dinozaurów. Są jeszcze rzadkie i niewielkie, a dolinę zdominowały rynchozaury, cynodonty i krewniacy krokodyli.',
    innovations: ['dinozaury: kończyny pod tułowiem, wyprostowana postawa', 'dwunożność', 'pierwsze teropody i zauropodomorfy'],
    fact: 'Eoraptor miał około metra długości. Przez lata uważano go za jednego z pierwszych teropodów, dziś częściej za wczesnego krewnego zauropodów.',
  },
  krasiejow: {
    title: 'Polski trias',
    story: 'Krasiejów pod Opolem to jedno z najważniejszych triasowych stanowisk świata. Jezioro pełne było metopozaurów, wielkich płazów o płaskich głowach. W Lisowicach żył największy drapieżnik europejskiego triasu.',
    innovations: ['dinozauromorfy, najbliżsi krewni dinozaurów (Silesaurus)', 'olbrzymie płazy temnospondyle', 'fitozaury podobne do krokodyli'],
    fact: 'Lisowicia bojani z Lisowic to dicynodont wielkości słonia. Drapieżny Smok wawelski z tego samego stanowiska mierzył około 5–6 m.',
  },
  chinle: {
    title: 'Dinozaury wchodzą na scenę',
    story: 'W późnym triasie Ameryki dinozaury są już liczne, ale wciąż ustępują fitozaurom i etozaurom. Ghost Ranch kryje setki szkieletów małego teropoda Coelophysis.',
    innovations: ['szybkie, lekkie teropody', 'puste kości (zapowiedź ptaków)', 'opancerzone etozaury'],
    fact: 'Czaszka Coelophysis poleciała w kosmos: w 1998 roku zabrał ją na pokład wahadłowiec Endeavour.',
    extinction: 'Wymieranie triasowe (ok. 201 mln lat temu) usunęło większość krewnych krokodyli. Dinozaury zajęły ich miejsce na całą jurę i kredę.',
  },
  holzmaden: {
    title: 'Gady wracają do morza',
    story: 'Wczesna jura. Ichtiozaury i plezjozaury to gady, których przodkowie żyli na lądzie, a teraz całe życie spędzają w morzu. Łupki z Holzmaden zachowały nawet ich zarys ciała.',
    innovations: ['żyworodność gadów morskich', 'płetwy z kończyn', 'kształt ciała jak u delfina (konwergencja)'],
    fact: 'W Holzmaden znaleziono ichtiozaurzyce z młodymi w brzuchu, a nawet w trakcie porodu. Młode wychodziły ogonem naprzód, jak u delfinów.',
  },
  oxford_clay: {
    title: 'Morskie potwory jury',
    story: 'Ciepłe płytkie morze nad dzisiejszą Anglią. Polują w nim plezjozaury o krótkiej szyi (pliozaury), ichtiozaury i krokodyle, które przystosowały się do życia wyłącznie w morzu.',
    innovations: ['pliozaury: wielkie głowy, potężne szczęki', 'krokodyle z ogonem jak płetwa (metriorynchy)', 'rozkwit amonitów i belemnitów'],
    fact: 'Iły oksfordzkie od ponad 150 lat wydobywano na cegły. Przy okazji robotnicy znaleźli tysiące szkieletów morskich gadów.',
  },
  morrison: {
    title: 'Era olbrzymów',
    story: 'Późna jura to czas największych zwierząt lądowych w historii. Zauropody o długich szyjach przemierzają równiny, a polują na nie allozaury. W cieniu olbrzymów żyją małe ssaki.',
    innovations: ['worki powietrzne w kościach: lekki szkielet olbrzymów', 'płyty i kolce stegozaurów', 'wielkie drapieżne teropody'],
    fact: 'O skamieniałości z Morrison toczyła się „wojna o kości” (1877–1892). Dwaj paleontolodzy, Cope i Marsh, nasyłali na siebie szpiegów i niszczyli stanowiska rywala.',
  },
  tendaguru: {
    title: 'Olbrzymy Gondwany',
    story: 'Tendaguru w Tanzanii ma faunę bardzo podobną do Morrison, mimo że leży na innym kontynencie. Kontynenty wciąż były połączone, a zwierzęta wędrowały między nimi.',
    innovations: ['zauropody o wysoko uniesionej szyi (brachiozaury)', 'kolczaste stegozaury', 'pterozaury nad lagunami'],
    fact: 'Szkielet giraffatytana z Tendaguru w muzeum w Berlinie to najwyższy zmontowany szkielet dinozaura na świecie: ponad 13 m.',
  },
  solnhofen: {
    title: 'Pierwszy ptak',
    story: 'W lagunach jurajskich Niemiec drobny wapień zachował pióra, błony lotne i nawet ślady ostatnich kroków zwierząt. Tutaj znaleziono archeopteryksa, w połowie gada, w połowie ptaka.',
    innovations: ['pióra lotne', 'skrzydła z pazurami', 'aktywny lot u pterozaurów i pierwszych ptaków'],
    fact: 'Pierwszego archeopteryksa opisano w 1861 roku, dwa lata po „O powstawaniu gatunków” Darwina. Stał się jednym z najsłynniejszych dowodów ewolucji.',
  },
  yixian: {
    title: 'Pierzaste dinozaury',
    story: 'Wulkaniczne popioły w Chinach zachowały dinozaury z piórami, ptaki z dziobami i ssaki polujące na młode dinozaury. Obok rosną jedne z pierwszych roślin kwiatowych.',
    innovations: ['pióra u dinozaurów, które nie latały', 'cztery skrzydła (Microraptor)', 'dzioby bez zębów u ptaków', 'pierwsze kwiaty'],
    fact: 'U Sinosauropteryx udało się odczytać kolor: rudawy grzbiet i ogon w jasne i ciemne pręgi. To pierwszy dinozaur, którego barwę poznaliśmy.',
  },
  santana: {
    title: 'Złoty wiek pterozaurów',
    story: 'Kredowa laguna w Brazylii roiła się od pterozaurów z wielkimi grzebieniami. Ryby zachowały się w kamiennych bułach tak dobrze, że widać ich mięśnie.',
    innovations: ['grzebienie pterozaurów do popisów', 'pterozaury bez zębów', 'spinozaury łowiące ryby'],
    fact: 'Pterozaury jako pierwsze kręgowce opanowały aktywny lot, o ponad 70 mln lat wcześniej niż ptaki i 150 mln lat przed nietoperzami.',
  },
  kem_kem: {
    title: 'Rzeka drapieżników',
    story: 'Około 95 mln lat temu w dzisiejszym Maroku płynął system rzek pełen olbrzymich ryb. Polowały na nie spinozaury, a na lądzie karcharodontozaury.',
    innovations: ['dinozaur półwodny (Spinosaurus)', 'olbrzymie ryby: piłonosy i latimerie', 'krokodyle o wielu kształtach'],
    fact: 'Naukowcy nazwali Kem Kem „najniebezpieczniejszym miejscem w historii Ziemi”: wielkich drapieżników było tu więcej niż roślinożerców.',
  },
  niobrara: {
    title: 'Morze środkowej Ameryki',
    story: 'W kredzie płytkie morze przecinało Amerykę Północną na pół. Rządziły nim mozazaury, czyli jaszczurki, które wróciły do wody, oraz wielkie ryby drapieżne.',
    innovations: ['mozazaury: łuskonośne giganci mórz', 'ptaki nurkujące z zębami (Hesperornis)', 'pteranodon bez zębów'],
    fact: 'W brzuchu ryby Xiphactinus znaleziono całą połkniętą rybę długości prawie 2 m. Drapieżnik prawdopodobnie zginął przez zbyt duży obiad.',
  },
  dinosaur_park: {
    title: 'Rozkwit kaczodziobych i rogatych',
    story: 'Najbogatsze dinozaurowe stanowisko świata. Hadrozaury z grzebieniami i ceratopsy z kryzami pasą się wśród roślin kwiatowych, a polują na nie tyranozaury.',
    innovations: ['baterie zębowe: setki zębów do mielenia roślin', 'grzebienie jak instrumenty dęte', 'kryzy i rogi do popisów'],
    fact: 'Pusty grzebień parazaurolofa działał jak puzon. Model komputerowy pozwolił usłyszeć jego niski, buczący zew.',
  },
  djadokhta: {
    title: 'Dinozaury pustyni Gobi',
    story: 'Wydmy późnokredowej Mongolii zasypywały zwierzęta w całości, czasem w trakcie walki albo wysiadywania jaj. Widać tu zachowania bardzo podobne do ptasich.',
    innovations: ['wysiadywanie jaj w gnieździe', 'pierzaste drapieżniki (welociraptory)', 'małe ceratopsy bez rogów'],
    fact: '„Walczące dinozaury” to welociraptor i protoceratops zastygłe w walce. Zasypała je zapewne osuwająca się wydma.',
  },
  hell_creek: {
    title: 'Ostatnie dni dinozaurów',
    story: 'Ostatni milion lat kredy. Tyranozaur i triceratops to jedne z ostatnich dinozaurów, które nie były ptakami. Wkrótce uderzy planetoida.',
    innovations: ['szczyt wielkości tyranozaurów', 'ssaki, ptaki, krokodyle i żółwie, które przetrwają katastrofę'],
    fact: 'Na granicy kredy i paleogenu leży cienka warstwa z irydem, pierwiastkiem rzadkim na Ziemi i częstym w planetoidach. Na jej podstawie odkryto przyczynę wymierania.',
    extinction: 'Wymieranie kredowe (66 mln lat temu): planetoida Chicxulub kończy erę dinozaurów. Przetrwały tylko ptaki, czyli dinozaury, które latały.',
  },
  nemegt: {
    title: 'Polska w Gobi',
    story: 'Wilgotna dolina rzeczna późnej kredy Mongolii: tarbozaury, terizinozaury z metrowymi pazurami i zagadkowy deinocheir. Wiele tych zwierząt odkryły polsko-mongolskie wyprawy.',
    innovations: ['olbrzymie pazury roślinożerców (terizinozaury)', 'strusiopodobne ornitomimy', 'azjatyccy krewni tyranozaura'],
    fact: 'Polsko-mongolskimi wyprawami (1963–1971) kierowała Zofia Kielan-Jaworowska. Znaleziono wtedy m.in. ręce deinocheira, a resztę jego szkieletu dopiero 50 lat później.',
  },
  green_river: {
    title: 'Świat po dinozaurach',
    story: 'Wczesny eocen. Ziemia jest cieplejsza niż kiedykolwiek od wymarcia dinozaurów, w Wyoming rosną palmy. Ssaki szybko zajmują puste nisze, a pierwsze nietoperze uczą się latać.',
    innovations: ['szybka radiacja ssaków', 'nietoperze: aktywny lot ssaków', 'naczelne, konie i walenie na wczesnych etapach'],
    fact: 'Onychonycteris z Green River umiał już latać, ale miał pazury na wszystkich palcach skrzydła. Badacze spierają się, czy umiał już echolokować.',
  },
  messel: {
    title: 'Okno w eoceński las',
    story: 'Jezioro w kraterze wulkanicznym pod Darmstadt zachowało całe zwierzęta: z sierścią, piórami, kolorami żuków, a nawet z ostatnim posiłkiem w żołądku.',
    innovations: ['wczesne konie wielkości psa', 'wczesne naczelne', 'pełna różnorodność ptaków i nietoperzy'],
    fact: 'Darwinius „Ida” z Messel to tak kompletny szkielet naczelnego, że widać sierść i zawartość żołądka: owoce i liście.',
  },
  white_river: {
    title: 'Ochłodzenie i trawy',
    story: 'Na przełomie eocenu i oligocenu klimat się ochładza, a lasy ustępują otwartym przestrzeniom. Ssaki przystosowują się do biegania po równinach.',
    innovations: ['konie z trzema palcami (Mesohippus)', 'dłuższe nogi do biegu', 'pierwsze „fałszywe szablozębne” (nimrawidy)'],
    fact: 'Badlands White River dają jedną z najpełniejszych serii skamieniałości koni. Na nich uczy się, jak koń z leśnego zwierzęcia stał się biegaczem stepu.',
  },
  pampas: {
    title: 'Megafauna epoki lodowcowej',
    story: 'Ostatnie 2 mln lat. Gdy powstał Przesmyk Panamski, zwierzęta obu Ameryk wymieszały się. Pampasy pełne były olbrzymich leniwców, gliptodontów i smilodonów.',
    innovations: ['olbrzymie leniwce naziemne', 'gliptodonty: pancerz jak u żółwia u ssaka', 'Wielka Wymiana Amerykańska'],
    fact: 'Kości megaterium i toksodona z pampasów zbierał Karol Darwin w czasie podróży na „Beagle”. Pomogły mu zrozumieć, że gatunki się zmieniają.',
    extinction: 'Wymieranie plejstoceńskie (ok. 50–10 tys. lat temu): zniknęła większość dużych ssaków, przez zmiany klimatu i polowania ludzi.',
  },
};

// ---------------------------------------------------------------- "new on the tree": clades that first appear at a site

/** sites in the order they open (oldest first) */
export const SITE_ORDER = Object.keys(SITE_UNLOCK);
const siteOrder = SITE_ORDER;

/** named (Polish) clades a genus belongs to, nearest first */
const namedAncestors = (genusId: number): CladeNode[] => {
  const g = GENERA.get(genusId);
  if (!g) return [];
  return ancestorIds(g.parent).map((id) => CLADES.get(id)!).filter((c) => c.namePl).reverse();
};

const newCache = new Map<string, { clade: CladeNode; genera: number }[]>();

/**
 * named groups of the tree of life that the player meets for the first time at this site
 * (none of their genera live at any earlier site), biggest first
 */
export function newCladesAt(siteId: string): { clade: CladeNode; genera: number }[] {
  const hit = newCache.get(siteId);
  if (hit) return hit;
  const k = siteOrder.indexOf(siteId);
  const seen = new Set<number>();
  for (const id of siteOrder.slice(0, Math.max(0, k))) {
    for (const f of SITES.find((x) => x.id === id)?.fauna ?? []) for (const c of namedAncestors(f.genusId)) seen.add(c.id);
  }
  const count = new Map<number, number>();
  for (const f of SITES.find((x) => x.id === siteId)?.fauna ?? []) {
    for (const c of namedAncestors(f.genusId)) if (!seen.has(c.id)) count.set(c.id, (count.get(c.id) ?? 0) + 1);
  }
  // keep the most telling groups: skip a group when its only child group here says the same thing
  const out = [...count.entries()].map(([id, n]) => ({ clade: CLADES.get(id)!, genera: n }))
    .filter((x) => x.clade.leafCount >= 2)
    .sort((a, b) => b.genera - a.genera || a.clade.leafCount - b.clade.leafCount);
  newCache.set(siteId, out);
  return out;
}

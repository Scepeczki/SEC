// Data pipeline configuration: selection groups (quotas) and dig sites.

export interface Group {
  id: string;
  /** PBDB base_name expression (comma = union, ^ = exclude) */
  base: string;
  quota: number;
}

// Order matters: earlier groups claim genera first (dedupe).
export const GROUPS: Group[] = [
  // --- Paleozoic seas & invertebrates
  { id: 'trilobites', base: 'Trilobita', quota: 70 },
  { id: 'eurypterids', base: 'Eurypterida', quota: 32 },
  { id: 'radiodonts', base: 'Radiodonta', quota: 16 },
  { id: 'cambrian_odd', base: 'Lobopodia,Megacheira,Marrellomorpha,Vetulicolia', quota: 16 },
  { id: 'giant_insects', base: 'Meganisoptera,Palaeodictyoptera', quota: 8 },
  { id: 'myriapods', base: 'Arthropleurida', quota: 4 },
  { id: 'ammonites', base: 'Ammonoidea', quota: 45 },
  { id: 'nautiloids', base: 'Nautiloidea', quota: 18 },
  { id: 'belemnites', base: 'Belemnitida', quota: 8 },
  { id: 'jawless', base: 'Pteraspidomorphi,Osteostraci,Anaspida,Thelodonti,Galeaspida', quota: 18 },
  { id: 'placoderms', base: 'Placodermi', quota: 30 },
  { id: 'acanthodians', base: 'Acanthodii', quota: 6 },
  { id: 'odd_sharks', base: 'Eugeneodontida,Symmoriiformes,Petalodontiformes', quota: 12 },
  { id: 'sharks', base: 'Chondrichthyes', quota: 40 },
  { id: 'bony_fish', base: 'Actinopterygii', quota: 35 },
  { id: 'lobefins', base: 'Sarcopterygii^Tetrapodomorpha', quota: 18 },
  // --- early tetrapods
  { id: 'tetrapodomorphs', base: 'Tetrapodomorpha^Amniota^Temnospondyli^Lepospondyli^Lissamphibia', quota: 30 },
  { id: 'temnospondyls', base: 'Temnospondyli', quota: 45 },
  { id: 'lepospondyls', base: 'Lepospondyli', quota: 14 },
  // --- synapsids
  { id: 'synapsids', base: 'Synapsida^Mammaliaformes', quota: 115 },
  // --- marine reptiles (before generic reptiles so they claim their genera)
  { id: 'ichthyosaurs', base: 'Ichthyosauromorpha', quota: 35 },
  { id: 'sauropterygians', base: 'Sauropterygia', quota: 50 },
  { id: 'mosasaurs', base: 'Mosasauridae', quota: 30 },
  { id: 'thalattosaurs', base: 'Thalattosauria', quota: 5 },
  // --- pterosaurs
  { id: 'pterosaurs', base: 'Pterosauria', quota: 55 },
  // --- dinosaurs
  { id: 'theropods', base: 'Theropoda^Aves', quota: 160 },
  { id: 'sauropodomorphs', base: 'Sauropodomorpha', quota: 100 },
  { id: 'ornithischians', base: 'Ornithischia', quota: 150 },
  { id: 'dinosauriforms', base: 'Dinosauriformes^Dinosauria', quota: 6 },
  { id: 'birds', base: 'Aves', quota: 45 },
  // --- other reptiles
  { id: 'parareptiles', base: 'Parareptilia', quota: 15 },
  { id: 'crocodylomorphs', base: 'Crocodylomorpha', quota: 50 },
  { id: 'pseudosuchians', base: 'Pseudosuchia^Crocodylomorpha', quota: 35 },
  { id: 'turtles', base: 'Testudinata', quota: 15 },
  { id: 'archosauromorphs', base: 'Archosauromorpha^Archosauria', quota: 18 },
  { id: 'lepidosaurs', base: 'Lepidosauromorpha^Mosasauridae', quota: 20 },
  // --- Cenozoic mammals (by order for diversity)
  { id: 'proboscideans', base: 'Mammalia:Proboscidea', quota: 20 },
  { id: 'perissodactyls', base: 'Perissodactyla', quota: 30 },
  { id: 'cetaceans', base: 'Cetacea', quota: 15 },
  { id: 'artiodactyls', base: 'Artiodactyla^Cetacea', quota: 30 },
  { id: 'carnivorans', base: 'Carnivora', quota: 28 },
  { id: 'creodonts', base: 'Hyaenodonta,Oxyaenidae', quota: 8 },
  { id: 'mesonychids', base: 'Mesonychia', quota: 5 },
  { id: 'xenarthrans', base: 'Xenarthra', quota: 15 },
  { id: 'sa_ungulates', base: 'Notoungulata,Litopterna,Astrapotheria,Pyrotheria', quota: 12 },
  { id: 'marsupials', base: 'Metatheria', quota: 15 },
  { id: 'primates', base: 'Primates', quota: 8 },
  { id: 'rodents', base: 'Rodentia', quota: 10 },
  { id: 'sirenians', base: 'Sirenia,Desmostylia', quota: 6 },
  { id: 'odd_mammals', base: 'Dinocerata,Embrithopoda,Pantodonta,Hyracoidea,Multituberculata,Tillodontia,Taeniodonta', quota: 18 },
];

export interface SiteConfig {
  id: string;
  name: string;
  strat: string[];
  country: string;
  /** PBDB country code filter (avoids homonymous formations elsewhere) */
  cc: string;
  description: string;
  /** max number of extra collectibles forced into the collection from this site */
  forceTop: number;
  /** extra collectible genera known from the site but missing in PBDB occurrences */
  extra?: string[];
}

// First six = vertical slice order.
export const SITES: SiteConfig[] = [
  {
    id: 'morrison', name: 'Formacja Morrison', strat: ['Morrison'], country: 'USA', cc: 'US',
    description: 'Późnojurajskie równiny zalewowe zachodu Ameryki Północnej — królestwo olbrzymich zauropodów, allozaurów i stegozaurów.',
    forceTop: 25,
  },
  {
    id: 'hell_creek', name: 'Formacja Hell Creek', strat: ['Hell Creek'], country: 'USA', cc: 'US',
    description: 'Ostatnie chwile ery dinozaurów: Tyrannosaurus, Triceratops i Edmontosaurus tuż przed wielkim wymieraniem.',
    forceTop: 25,
  },
  {
    id: 'krasiejow', name: 'Krasiejów i Lisowice', strat: ['Drawno Beds', 'Grabowa'], country: 'Polska', cc: 'PL',
    description: 'Polski późny trias: jeziora pełne metopozaurów, fitozaury, aetozaury, drapieżny Smok i olbrzymi dicynodont Lisowicia ze Śląska.',
    forceTop: 25,
    extra: ['Smok', 'Lisowicia'],
  },
  {
    id: 'solnhofen', name: 'Wapienie Solnhofen', strat: ['Solnhofen'], country: 'Niemcy', cc: 'DE',
    description: 'Późnojurajska laguna o niezwykłej konserwacji — Archaeopteryx, pterozaury, kraby i ryby zachowane w najdrobniejszych szczegółach.',
    forceTop: 25,
  },
  {
    id: 'burgess', name: 'Łupki z Burgess', strat: ['Burgess Shale'], country: 'Kanada', cc: 'CA',
    description: 'Środkowy kambr: dziwaczny świat pierwszych zwierząt — Anomalocaris, Opabinia, Hallucigenia i tysiące stawonogów.',
    forceTop: 25,
  },
  {
    id: 'niobrara', name: 'Formacja Niobrara', strat: ['Niobrara'], country: 'USA', cc: 'US',
    description: 'Kredowe Zachodnie Morze Wewnętrzne — mozazaury, plezjozaury, rekiny i nad wodą szybujące pteranodony.',
    forceTop: 25,
  },
  // ---- later content
  {
    id: 'yixian', name: 'Formacja Yixian', strat: ['Yixian'], country: 'Chiny', cc: 'CN',
    description: 'Wczesnokredowe jeziora Liaoningu: upierzone dinozaury, pierwsze ptaki i ssaki zasypane popiołem wulkanicznym.',
    forceTop: 25,
  },
  {
    id: 'ischigualasto', name: 'Ischigualasto', strat: ['Ischigualasto'], country: 'Argentyna', cc: 'AR',
    description: 'Dolina Księżyca — jedne z najstarszych dinozaurów świata obok rynchozaurów i cynodontów.',
    forceTop: 25,
  },
  {
    id: 'karoo', name: 'Basen Karoo', strat: ['Beaufort'], country: 'RPA', cc: 'ZA',
    description: 'Permskie i triasowe równiny Gondwany — gorgonopsy, dicynodonty i ślady największego wymierania w dziejach.',
    forceTop: 25,
  },
  {
    id: 'cleveland', name: 'Łupki Cleveland', strat: ['Cleveland'], country: 'USA', cc: 'US',
    description: 'Późnodewońskie morze — tu polował pancerny Dunkleosteus i pierwsze rekiny.',
    forceTop: 25,
  },
  {
    id: 'holzmaden', name: 'Łupki posidoniowe (Holzmaden)', strat: ['Posidonia Shale'], country: 'Niemcy', cc: 'DE',
    description: 'Wczesnojurajskie morze z ichtiozaurami zachowanymi wraz z zarysem ciała, plezjozaurami i amonitami.',
    forceTop: 25,
  },
  {
    id: 'dinosaur_park', name: 'Formacja Dinosaur Park', strat: ['Dinosaur Park'], country: 'Kanada', cc: 'CA',
    description: 'Jedno z najbogatszych dinozaurowych stanowisk świata — ceratopsy, hadrozaury i tyranozaurydy.',
    forceTop: 25,
  },
  {
    id: 'nemegt', name: 'Formacja Nemegt', strat: ['Nemegt'], country: 'Mongolia', cc: 'MN',
    description: 'Gobi pod koniec kredy — Tarbosaurus, Deinocheirus i Therizinosaurus. Klasyczne stanowisko polskich wypraw Zofii Kielan-Jaworowskiej.',
    forceTop: 25,
  },
  {
    id: 'kem_kem', name: 'Kem Kem', strat: ['Kem Kem', 'Ifezouane', 'Aoufous'], country: 'Maroko', cc: 'MA',
    description: 'Kredowe rzeki Sahary pełne wielkich drapieżników — Spinosaurus, Carcharodontosaurus i olbrzymie ryby.',
    forceTop: 25,
  },
  {
    id: 'santana', name: 'Formacja Santana', strat: ['Santana', 'Romualdo', 'Crato'], country: 'Brazylia', cc: 'BR',
    description: 'Wczesnokredowa laguna z barwnymi pterozaurami i trójwymiarowo zachowanymi rybami.',
    forceTop: 25,
  },
  {
    id: 'messel', name: 'Kopalnia Messel', strat: ['Messel'], country: 'Niemcy', cc: 'DE',
    description: 'Eoceńskie jezioro wulkaniczne — wczesne koniowate, prymaty i ptaki z zachowaną zawartością żołądków.',
    forceTop: 25,
  },
  {
    id: 'mazon_creek', name: 'Mazon Creek', strat: ['Francis Creek'], country: 'USA', cc: 'US',
    description: 'Karbońskie delty i bagna w konkrecjach — wije, ryby i dziwne stworzenia, jak potwór Tully.',
    forceTop: 25,
  },
  {
    id: 'pampas', name: 'Pampasy plejstoceńskie', strat: ['Luján', 'Ensenada'], country: 'Argentyna', cc: 'AR',
    description: 'Plejstoceńska megafauna Ameryki Południowej — Megatherium, gliptodonty, Toxodon i koty szablozębne.',
    forceTop: 25,
  },
  // ---- 0.2.0
  {
    id: 'chinle', name: 'Formacja Chinle (Ghost Ranch)', strat: ['Chinle', 'Petrified Forest'], country: 'USA', cc: 'US',
    description: 'Późnotriasowe rzeki Nowego Meksyku i Arizony — stada drobnych celofyzów, fitozaury, aetozaury i skamieniałe lasy.',
    forceTop: 25,
  },
  {
    id: 'djadokhta', name: 'Formacja Djadochta', strat: ['Djadokhta'], country: 'Mongolia', cc: 'MN',
    description: 'Płonące Klify Gobi: Velociraptor, Protoceratops i owiraptory na gniazdach, zasypane przez piaskowe burze.',
    forceTop: 25,
  },
  {
    id: 'green_river', name: 'Formacja Green River', strat: ['Green River', 'Bridger'], country: 'USA', cc: 'US',
    description: 'Eoceńskie jeziora Wyomingu: ryby zachowane w całości, pierwsze nietoperze, krokodyle i dziwne ssaki kopytne.',
    forceTop: 25,
  },
  {
    id: 'oxford_clay', name: 'Iły oksfordzkie i kimerydzkie', strat: ['Oxford Clay', 'Kimmeridge Clay'], country: 'Wielka Brytania', cc: 'UK',
    description: 'Jurajskie morza Anglii — pliozaury, ichtiozaury, morskie krokodyle i olbrzymia ryba Leedsichthys.',
    forceTop: 25,
  },
  {
    id: 'chengjiang', name: 'Chengjiang', strat: ["Yu'anshan", 'Maotianshan Shale'], country: 'Chiny', cc: 'CN',
    description: 'Wczesny kambr Junnanu — starsi kuzyni fauny z Burgess: pierwsze ryby, wetulikole i dziwaczne stawonogi.',
    forceTop: 25,
  },
  {
    id: 'tendaguru', name: 'Tendaguru', strat: ['Tendaguru'], country: 'Tanzania', cc: 'TZ',
    description: 'Afrykańska siostra Morrison: olbrzymi Giraffatitan, kolczasty Kentrosaurus i Elaphrosaurus.',
    forceTop: 25,
  },
  {
    id: 'white_river', name: 'Badlands White River', strat: ['Brule', 'Chadron'], country: 'USA', cc: 'US',
    description: 'Oligoceńskie prerie Dakoty — entelodonty, brontotery, wczesne konie i koty z fałszywymi szablami.',
    forceTop: 25,
  },
  {
    id: 'gogo', name: 'Formacja Gogo', strat: ['Gogo'], country: 'Australia', cc: 'AU',
    description: 'Dewońska rafa w zachodniej Australii — pancerne ryby zachowane w trzech wymiarach, a nawet z zarodkami.',
    forceTop: 25,
  },
  {
    id: 'fezouata', name: 'Łupki Fezouata', strat: ['Fezouata'], country: 'Maroko', cc: 'MA',
    description: 'Wczesny ordowik Maroka — ostatnie olbrzymie radiodonty jak Aegirocassis i niezliczone trylobity.',
    forceTop: 25,
  },
];

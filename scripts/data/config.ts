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
  { id: 'eurypterids', base: 'Eurypterida', quota: 22 },
  { id: 'radiodonts', base: 'Radiodonta', quota: 12 },
  { id: 'ammonites', base: 'Ammonoidea', quota: 45 },
  { id: 'nautiloids', base: 'Nautiloidea', quota: 18 },
  { id: 'belemnites', base: 'Belemnitida', quota: 8 },
  { id: 'jawless', base: 'Pteraspidomorphi,Osteostraci,Anaspida,Thelodonti,Galeaspida', quota: 18 },
  { id: 'placoderms', base: 'Placodermi', quota: 30 },
  { id: 'acanthodians', base: 'Acanthodii', quota: 6 },
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
  { id: 'odd_mammals', base: 'Dinocerata,Embrithopoda,Pantodonta,Hyracoidea,Multituberculata', quota: 12 },
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
    forceTop: 14,
  },
  {
    id: 'hell_creek', name: 'Formacja Hell Creek', strat: ['Hell Creek'], country: 'USA', cc: 'US',
    description: 'Ostatnie chwile ery dinozaurów: Tyrannosaurus, Triceratops i Edmontosaurus tuż przed wielkim wymieraniem.',
    forceTop: 14,
  },
  {
    id: 'krasiejow', name: 'Krasiejów i Lisowice', strat: ['Drawno Beds', 'Grabowa'], country: 'Polska', cc: 'PL',
    description: 'Polski późny trias: jeziora pełne metopozaurów, fitozaury, aetozaury, drapieżny Smok i olbrzymi dicynodont Lisowicia ze Śląska.',
    forceTop: 14,
    extra: ['Smok', 'Lisowicia'],
  },
  {
    id: 'solnhofen', name: 'Wapienie Solnhofen', strat: ['Solnhofen'], country: 'Niemcy', cc: 'DE',
    description: 'Późnojurajska laguna o niezwykłej konserwacji — Archaeopteryx, pterozaury, kraby i ryby zachowane w najdrobniejszych szczegółach.',
    forceTop: 14,
  },
  {
    id: 'burgess', name: 'Łupki z Burgess', strat: ['Burgess Shale'], country: 'Kanada', cc: 'CA',
    description: 'Środkowy kambr: dziwaczny świat pierwszych zwierząt — Anomalocaris, Opabinia, Hallucigenia i tysiące stawonogów.',
    forceTop: 16,
  },
  {
    id: 'niobrara', name: 'Formacja Niobrara', strat: ['Niobrara'], country: 'USA', cc: 'US',
    description: 'Kredowe Zachodnie Morze Wewnętrzne — mozazaury, plezjozaury, rekiny i nad wodą szybujące pteranodony.',
    forceTop: 14,
  },
  // ---- later content
  {
    id: 'yixian', name: 'Formacja Yixian', strat: ['Yixian'], country: 'Chiny', cc: 'CN',
    description: 'Wczesnokredowe jeziora Liaoningu: upierzone dinozaury, pierwsze ptaki i ssaki zasypane popiołem wulkanicznym.',
    forceTop: 12,
  },
  {
    id: 'ischigualasto', name: 'Ischigualasto', strat: ['Ischigualasto'], country: 'Argentyna', cc: 'AR',
    description: 'Dolina Księżyca — jedne z najstarszych dinozaurów świata obok rynchozaurów i cynodontów.',
    forceTop: 12,
  },
  {
    id: 'karoo', name: 'Basen Karoo', strat: ['Beaufort'], country: 'RPA', cc: 'ZA',
    description: 'Permskie i triasowe równiny Gondwany — gorgonopsy, dicynodonty i ślady największego wymierania w dziejach.',
    forceTop: 12,
  },
  {
    id: 'cleveland', name: 'Łupki Cleveland', strat: ['Cleveland'], country: 'USA', cc: 'US',
    description: 'Późnodewońskie morze — tu polował pancerny Dunkleosteus i pierwsze rekiny.',
    forceTop: 10,
  },
  {
    id: 'holzmaden', name: 'Łupki posidoniowe (Holzmaden)', strat: ['Posidonia Shale'], country: 'Niemcy', cc: 'DE',
    description: 'Wczesnojurajskie morze z ichtiozaurami zachowanymi wraz z zarysem ciała, plezjozaurami i amonitami.',
    forceTop: 12,
  },
  {
    id: 'dinosaur_park', name: 'Formacja Dinosaur Park', strat: ['Dinosaur Park'], country: 'Kanada', cc: 'CA',
    description: 'Jedno z najbogatszych dinozaurowych stanowisk świata — ceratopsy, hadrozaury i tyranozaurydy.',
    forceTop: 12,
  },
  {
    id: 'nemegt', name: 'Formacja Nemegt', strat: ['Nemegt'], country: 'Mongolia', cc: 'MN',
    description: 'Gobi pod koniec kredy — Tarbosaurus, Deinocheirus i Therizinosaurus. Klasyczne stanowisko polskich wypraw Zofii Kielan-Jaworowskiej.',
    forceTop: 12,
  },
  {
    id: 'kem_kem', name: 'Kem Kem', strat: ['Kem Kem', 'Ifezouane', 'Aoufous'], country: 'Maroko', cc: 'MA',
    description: 'Kredowe rzeki Sahary pełne wielkich drapieżników — Spinosaurus, Carcharodontosaurus i olbrzymie ryby.',
    forceTop: 10,
  },
  {
    id: 'santana', name: 'Formacja Santana', strat: ['Santana', 'Romualdo', 'Crato'], country: 'Brazylia', cc: 'BR',
    description: 'Wczesnokredowa laguna z barwnymi pterozaurami i trójwymiarowo zachowanymi rybami.',
    forceTop: 10,
  },
  {
    id: 'messel', name: 'Kopalnia Messel', strat: ['Messel'], country: 'Niemcy', cc: 'DE',
    description: 'Eoceńskie jezioro wulkaniczne — wczesne koniowate, prymaty i ptaki z zachowaną zawartością żołądków.',
    forceTop: 10,
  },
  {
    id: 'mazon_creek', name: 'Mazon Creek', strat: ['Francis Creek'], country: 'USA', cc: 'US',
    description: 'Karbońskie delty i bagna w konkrecjach — wije, ryby i dziwne stworzenia, jak potwór Tully.',
    forceTop: 10,
  },
  {
    id: 'pampas', name: 'Pampasy plejstoceńskie', strat: ['Luján', 'Ensenada'], country: 'Argentyna', cc: 'AR',
    description: 'Plejstoceńska megafauna Ameryki Południowej — Megatherium, gliptodonty, Toxodon i koty szablozębne.',
    forceTop: 10,
  },
];

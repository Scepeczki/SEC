// Archetype = body-plan template. Metadata only (used by data pipeline + game).
// Drawing presets live in src/sprites/presets.ts and are keyed by the same ids.

import type { Food, Habitat, SizeClass } from './types';

export type Rig =
  | 'biped'
  | 'quad'
  | 'sprawl' // low sprawling quadruped (crocs, lizards, salamanders)
  | 'swim' // fusiform swimmer (fish, ichthyosaur, whale, mosasaur)
  | 'flipper' // plesiosaur-like
  | 'fly' // pterosaur, bird, insect with wings
  | 'arthropod_top' // trilobite seen from above
  | 'arthropod' // eurypterid / shrimp-like side view
  | 'shell' // ammonite / orthocone
  | 'snake'
  | 'sessile'; // sponges, brachiopods, polyps, stalked echinoderms, graptolites, snails, worms

export interface ArchetypeMeta {
  id: string;
  namePl: string;
  rig: Rig;
  size: SizeClass;
  habitat: Habitat;
  food: Food;
  /** semi-aquatic animals get freshwater/marine from environment data */
  semiAquatic?: boolean;
}

const A = (
  id: string,
  namePl: string,
  rig: Rig,
  size: SizeClass,
  habitat: Habitat,
  food: Food,
  semiAquatic = false,
): ArchetypeMeta => ({ id, namePl, rig, size, habitat, food, semiAquatic });

export const ARCHETYPES: ArchetypeMeta[] = [
  // --- dinosaurs: theropods
  A('theropod_small', 'mały teropod', 'biped', 'S', 'land', 'meat'),
  A('theropod_large', 'duży teropod', 'biped', 'L', 'land', 'meat'),
  A('spinosaur', 'spinozaur', 'biped', 'L', 'land', 'fish', true),
  A('raptor', 'raptor', 'biped', 'S', 'land', 'meat'),
  A('ornithomimid', 'strusiopodobny', 'biped', 'M', 'land', 'plants'),
  A('therizinosaur', 'terizinozaur', 'biped', 'L', 'land', 'plants'),
  A('oviraptor', 'owiraptor', 'biped', 'S', 'land', 'meat'),
  A('early_bird', 'praptak', 'fly', 'XS', 'air', 'meat'),
  A('bird', 'ptak', 'fly', 'S', 'air', 'fish'),
  A('terror_bird', 'ptak terroru', 'biped', 'M', 'land', 'meat'),
  A('giant_bird', 'olbrzymi nielot', 'biped', 'L', 'land', 'plants'),
  A('diving_bird', 'ptak nurkujący', 'swim', 'S', 'marine', 'fish'),
  // sauropodomorphs
  A('sauropod', 'zauropod', 'quad', 'XL', 'land', 'plants'),
  A('prosauropod', 'prozauropod', 'biped', 'M', 'land', 'plants'),
  // ornithischians
  A('ceratopsid', 'ceratopsid', 'quad', 'L', 'land', 'plants'),
  A('small_ceratopsian', 'mały ceratops', 'quad', 'S', 'land', 'plants'),
  A('hadrosaur', 'hadrozaur', 'quad', 'L', 'land', 'plants'),
  A('ornithopod', 'ornitopod', 'biped', 'S', 'land', 'plants'),
  A('pachycephalosaur', 'pachycefalozaur', 'biped', 'M', 'land', 'plants'),
  A('ankylosaur', 'ankylozaur', 'quad', 'L', 'land', 'plants'),
  A('stegosaur', 'stegozaur', 'quad', 'L', 'land', 'plants'),
  // pterosaurs
  A('rhamphorhynchoid', 'pterozaur długoogonowy', 'fly', 'S', 'air', 'fish'),
  A('pterodactyloid', 'pterodaktyl', 'fly', 'M', 'air', 'fish'),
  A('azhdarchid', 'azdarchid', 'fly', 'L', 'air', 'meat'),
  // marine reptiles
  A('ichthyosaur', 'ichtiozaur', 'swim', 'L', 'marine', 'fish'),
  A('plesiosaur', 'plezjozaur', 'flipper', 'L', 'marine', 'fish'),
  A('pliosaur', 'pliozaur', 'flipper', 'L', 'marine', 'meat'),
  A('nothosaur', 'notozaur', 'flipper', 'M', 'marine', 'fish'),
  A('placodont', 'plakodont', 'flipper', 'M', 'marine', 'plankton'),
  A('mosasaur', 'mozazaur', 'swim', 'L', 'marine', 'meat'),
  A('thalattosaur', 'talattozaur', 'swim', 'M', 'marine', 'fish'),
  // other reptiles
  A('crocodile', 'krokodyl', 'sprawl', 'M', 'freshwater', 'meat', true),
  A('marine_croc', 'krokodyl morski', 'swim', 'M', 'marine', 'fish'),
  A('land_croc', 'krokodyl lądowy', 'quad', 'S', 'land', 'meat'),
  A('phytosaur', 'fitozaur', 'sprawl', 'L', 'freshwater', 'fish', true),
  A('aetosaur', 'aetozaur', 'sprawl', 'M', 'land', 'plants'),
  A('rauisuchian', 'rauizuch', 'quad', 'L', 'land', 'meat'),
  A('poposaur', 'popozaur', 'biped', 'M', 'land', 'meat'),
  A('rhynchosaur', 'rynchozaur', 'sprawl', 'M', 'land', 'plants'),
  A('tanystropheus', 'długoszyj', 'sprawl', 'M', 'marine', 'fish', true),
  A('lizard', 'jaszczurka', 'sprawl', 'S', 'land', 'meat'),
  A('snake', 'wąż', 'snake', 'L', 'freshwater', 'meat', true),
  A('turtle', 'żółw', 'sprawl', 'M', 'land', 'plants'),
  A('sea_turtle', 'żółw morski', 'flipper', 'L', 'marine', 'plankton'),
  A('pareiasaur', 'parejazaur', 'quad', 'M', 'land', 'plants'),
  A('early_reptile', 'gad pierwotny', 'sprawl', 'XS', 'land', 'meat'),
  // synapsids
  A('sail_back', 'płetwogrzbiet', 'sprawl', 'M', 'land', 'meat'),
  A('pelycosaur', 'pelykozaur', 'sprawl', 'M', 'land', 'meat'),
  A('caseid', 'kazeid', 'sprawl', 'M', 'land', 'plants'),
  A('dinocephalian', 'dinocefal', 'quad', 'L', 'land', 'plants'),
  A('gorgonopsid', 'gorgonops', 'quad', 'M', 'land', 'meat'),
  A('dicynodont', 'dicynodont', 'quad', 'M', 'land', 'plants'),
  A('cynodont', 'cynodont', 'quad', 'S', 'land', 'meat'),
  // mammals
  A('proboscidean', 'trąbowiec', 'quad', 'XL', 'land', 'plants'),
  A('rhino', 'nosorożec', 'quad', 'L', 'land', 'plants'),
  A('horse', 'koniowaty', 'quad', 'M', 'land', 'plants'),
  A('brontothere', 'brontoter', 'quad', 'L', 'land', 'plants'),
  A('chalicothere', 'chalikoter', 'quad', 'L', 'land', 'plants'),
  A('entelodont', 'entelodont', 'quad', 'M', 'land', 'meat'),
  A('deer', 'jeleniowaty', 'quad', 'M', 'land', 'plants'),
  A('ungulate', 'kopytny', 'quad', 'M', 'land', 'plants'),
  A('whale', 'walen', 'swim', 'XL', 'marine', 'fish'),
  A('early_whale', 'praw walen', 'quad', 'M', 'freshwater', 'fish', true),
  A('sirenian', 'syrena', 'swim', 'L', 'marine', 'plants'),
  A('sabertooth', 'szablozęby', 'quad', 'M', 'land', 'meat'),
  A('carnivoran', 'drapieżny ssak', 'quad', 'M', 'land', 'meat'),
  A('bear', 'niedźwiedź', 'quad', 'L', 'land', 'meat'),
  A('ground_sloth', 'leniwiec naziemny', 'quad', 'L', 'land', 'plants'),
  A('glyptodont', 'gliptodont', 'quad', 'L', 'land', 'plants'),
  A('diprotodont', 'diprotodont', 'quad', 'L', 'land', 'plants'),
  A('ape', 'małpa człekokształtna', 'quad', 'L', 'land', 'plants'),
  A('rodent', 'gryzoń', 'quad', 'XS', 'land', 'plants'),
  A('small_mammal', 'drobny ssak', 'quad', 'XS', 'land', 'meat'),
  A('mesonychid', 'mezonychid', 'quad', 'L', 'land', 'meat'),
  // early tetrapods
  A('temnospondyl', 'temnospondyl', 'sprawl', 'M', 'freshwater', 'fish', true),
  A('diplocaulus', 'diplokaul', 'sprawl', 'S', 'freshwater', 'fish', true),
  A('early_tetrapod', 'praczworonóg', 'sprawl', 'M', 'freshwater', 'fish', true),
  A('reptiliomorph', 'gadokształtny', 'sprawl', 'M', 'land', 'plants'),
  A('fishapod', 'rybonóg', 'swim', 'M', 'freshwater', 'fish'),
  // fish
  A('placoderm', 'plakoderm', 'swim', 'L', 'marine', 'meat'),
  A('shark', 'rekin', 'swim', 'L', 'marine', 'meat'),
  A('bony_fish', 'ryba', 'swim', 'S', 'marine', 'plankton'),
  A('lobefin', 'trzonopłetwa', 'swim', 'M', 'marine', 'fish'),
  A('jawless_fish', 'bezżuchwowiec', 'swim', 'XS', 'marine', 'plankton'),
  // invertebrates
  A('trilobite', 'trylobit', 'arthropod_top', 'XS', 'marine', 'plankton'),
  A('eurypterid', 'wielkoraki', 'arthropod', 'M', 'marine', 'meat'),
  A('radiodont', 'radiodont', 'arthropod', 'M', 'marine', 'meat'),
  A('cambrian_arthropod', 'stawonóg kambryjski', 'arthropod', 'XS', 'marine', 'plankton'),
  A('lobopod', 'lobopod', 'arthropod', 'XS', 'marine', 'plankton'),
  A('giant_insect', 'olbrzymi owad', 'fly', 'S', 'air', 'meat'),
  A('myriapod', 'wij olbrzymi', 'arthropod', 'M', 'land', 'plants'),
  A('ammonite', 'amonit', 'shell', 'S', 'marine', 'plankton'),
  A('orthocone', 'łodzik prostoskorupowy', 'shell', 'M', 'marine', 'meat'),
  A('belemnite', 'belemnit', 'swim', 'S', 'marine', 'fish'),
  A('sponge', 'gąbka', 'sessile', 'S', 'marine', 'plankton'),
  A('bryozoan', 'mszywioł', 'sessile', 'XS', 'marine', 'plankton'),
  A('bivalve', 'małż', 'sessile', 'XS', 'marine', 'plankton'),
  A('sea_urchin', 'jeżowiec', 'sessile', 'XS', 'marine', 'plankton'),
  A('starfish', 'rozgwiazda', 'sessile', 'XS', 'marine', 'meat'),
  A('brittle_star', 'wężowidło', 'sessile', 'XS', 'marine', 'plankton'),
  A('archaeocyath', 'archeocjat', 'sessile', 'XS', 'marine', 'plankton'),
  A('brachiopod', 'ramienionóg', 'sessile', 'XS', 'marine', 'plankton'),
  A('polyp', 'polip', 'sessile', 'XS', 'marine', 'plankton'),
  A('comb_jelly', 'żebropław', 'sessile', 'XS', 'marine', 'plankton'),
  A('disc_animal', 'pływający krążek', 'sessile', 'XS', 'marine', 'plankton'),
  A('crinoid', 'szkarłupień na łodyżce', 'sessile', 'S', 'marine', 'plankton'),
  A('cystoid', 'cystoid', 'sessile', 'XS', 'marine', 'plankton'),
  A('graptolite', 'graptolit', 'sessile', 'XS', 'marine', 'plankton'),
  A('snail', 'ślimak', 'sessile', 'XS', 'marine', 'plankton'),
  A('tube_worm', 'robak w rurce', 'sessile', 'XS', 'marine', 'plankton'),
  A('worm', 'robak', 'sessile', 'XS', 'marine', 'plankton'),
  A('soft_bodied', 'miękkie ciało', 'swim', 'XS', 'marine', 'plankton'),
];

export const ARCHETYPE_BY_ID: Record<string, ArchetypeMeta> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);

export const SIZE_SLOTS: Record<SizeClass, number> = { XS: 1, S: 1, M: 2, L: 3, XL: 4 };

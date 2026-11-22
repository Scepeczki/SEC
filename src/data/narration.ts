// What the narrator says, and when. The narrator is not a character: just a voice in speech bubbles that leads through
// the game in story mode. Each beat is shown once (remembered in s.story.seen).

export type NarrAction =
  | { kind: 'tab'; tab: string; label: string }
  | { kind: 'cutscene'; id: string; label: string }
  | { kind: 'codex'; tab: string; label: string }
  | { kind: 'lesson-clade'; id: number; label: string };

export interface Beat {
  id: string;
  lines: string[];
  action?: NarrAction;
}

export const BEATS: Record<string, Omit<Beat, 'id'>> = {
  welcome: {
    lines: [
      'Witaj w SEC. Tutaj przywrócisz do życia zwierzęta, które zniknęły z Ziemi setki milionów lat temu.',
      'Plan jest prosty: wykopać skamieniałości, odczytać z nich DNA i wykluć zwierzęta w parku. Celem jest przynajmniej jeden żywy przedstawiciel każdego rodzaju z drzewa życia.',
      'Po drodze przejdziesz przez całą historię zwierząt, rozdział po rozdziale. Każde wykopalisko to jeden rozdział: od kambryjskiego morza aż po epokę lodowcową.',
    ],
    action: { kind: 'tab', tab: 'dig', label: 'Do wykopalisk' },
  },
  nosite: {
    lines: ['Nie masz jeszcze żadnego wykopaliska. Otwórz mapę świata i kup pozwolenie na pierwsze stanowisko.'],
  },
  map: {
    lines: [
      'To mapa świata. Każda pinezka to prawdziwa formacja skalna, w której znaleziono skamieniałości zwierząt z gry.',
      'Stanowiska są ponumerowane jak rozdziały: od najstarszych skał do najmłodszych. Kolejne otwierają się, gdy park rośnie, więc historię życia przechodzisz po kolei.',
      'Na dole jest oś czasu. Pokazuje, z której epoki pochodzi każde stanowisko.',
      'Rozdział 1 to Chengjiang w Chinach, skały sprzed 518 mln lat. Kliknij go i kup pozwolenie na wykopaliska.',
    ],
  },
  bought_first: {
    lines: [
      'Pozwolenie kupione! Zanim zaczniesz kopać, zobacz, do jakiego świata zaglądasz.',
      'Każdy rozdział możesz obejrzeć jeszcze raz w Encyklopedii albo przyciskiem przy wykopalisku.',
    ],
    action: { kind: 'cutscene', id: 'chengjiang', label: 'Obejrzyj rozdział 1' },
  },
  dig: {
    lines: [
      'Każda plansza to jedna warstwa skały. Klikaj kamienie pędzlem, aż pękną. W niektórych kryją się kości, minerały i drobne skamieniałości.',
      'Kamienie z symbolami to modyfikatory: rozbite, odpalają kolejne. Najedź na kamień, a zobaczysz, co pęknie.',
      'Po lewej masz spis tego, co kryje stanowisko: zwierzęta pogrupowane według drzewa życia, minerały i skały. Liczniki pokazują, ile już masz.',
    ],
  },
  first_find: {
    lines: [
      'Pierwsze zwierzę! Każde nowe znalezisko zapala kawałek drzewa życia: widać, do której gałęzi należy zwierzę i co ją wyróżnia.',
      'Kości trafiają do laboratorium. Tam odczytasz z nich DNA, a z pełnego genomu wyklujesz zwierzę.',
    ],
    action: { kind: 'codex', tab: 'chapters', label: 'Zobacz drzewo rozdziału' },
  },
  lab: {
    lines: [
      'Laboratorium: tu kości zamieniają się w DNA. Każda ekstrakcja dokłada kawałek genomu.',
      'Od połowy genomu zwierzę można wykluć w wylęgarni. Pełny genom daje lepsze i zdrowsze osobniki.',
    ],
  },
  codex: {
    lines: [
      'Encyklopedia zbiera wszystko, co poznałeś: rozdziały historii życia, drzewo życia, pojęcia, minerały i skały.',
      'W drzewie każda linia to gałąź, a pierścień to rozwidlenie, czyli wspólny przodek. Kliknij rozwidlenie, a dowiesz się, co się na nim pojawiło i dlaczego.',
    ],
  },
};

export function chapterDoneBeat(chapterNo: number, title: string, hasOutro: boolean): Omit<Beat, 'id'> {
  return {
    lines: [`Rozdział ${chapterNo}, „${title}”, jest kompletny: znasz wszystkie zwierzęta tego stanowiska.`, hasOutro ? 'Zobacz, co działo się dalej.' : 'Kolejny rozdział czeka na mapie.'],
  };
}

// Global store: game state (mutated in place) + revision counter for React re-renders.

import { create } from 'zustand';
import { SAVE_KEY, catchUp, deserialize, serialize, startGame, tick, type OfflineSummary } from '../game/engine';
import { desktop } from './desktop';
import { setVolume } from './sound';
import type { GameState } from '../game/state';

export interface Toast { id: number; text: string; kind: 'good' | 'info' | 'bad' }

interface Store {
  s: GameState;
  rev: number;
  offline: OfflineSummary | null;
  toasts: Toast[];
  modal: { kind: 'genus'; id: number } | { kind: 'clade'; id: number } | null;
  tab: string;
  /** focus clade in the tree of life */
  treeFocus: number | null;
  act: <T>(fn: (s: GameState) => T) => T;
  toast: (text: string, kind?: Toast['kind']) => void;
  setTab: (tab: string) => void;
  openGenus: (id: number) => void;
  openClade: (id: number) => void;
  closeModal: () => void;
  setTreeFocus: (id: number | null) => void;
  dismissOffline: () => void;
  replaceState: (s: GameState) => void;
}

function loadInitial(): { s: GameState; offline: OfflineSummary | null } {
  try {
    // desktop app: the save is a file in Documents\SEC (browser storage only as a fallback)
    const raw = desktop?.readSave() ?? localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = deserialize(raw);
      if (s) {
        const offline = catchUp(s, Date.now());
        return { s, offline };
      }
    }
  } catch {
    /* storage unavailable */
  }
  return { s: startGame(Date.now()), offline: null };
}

const init = loadInitial();
let toastId = 1;

export const useStore = create<Store>((set, get) => ({
  s: init.s,
  rev: 0,
  offline: init.offline,
  toasts: [],
  modal: null,
  tab: 'park',
  treeFocus: null,
  act: (fn) => {
    const r = fn(get().s);
    set({ rev: get().rev + 1 });
    return r;
  },
  toast: (text, kind = 'info') => {
    const t = { id: toastId++, text, kind };
    set({ toasts: [...get().toasts.slice(-4), t] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 3500);
  },
  setTab: (tab) => set({ tab }),
  openGenus: (id) => set({ modal: { kind: 'genus', id } }),
  openClade: (id) => set({ modal: { kind: 'clade', id } }),
  closeModal: () => set({ modal: null }),
  setTreeFocus: (id) => set({ treeFocus: id, tab: 'tree' }),
  dismissOffline: () => set({ offline: null }),
  replaceState: (s) => set({ s, rev: get().rev + 1 }),
}));

export function save(): void {
  const json = serialize(useStore.getState().s);
  try { desktop?.writeSave(json); } catch { /* ignore */ }
  try { localStorage.setItem(SAVE_KEY, json); } catch { /* ignore */ }
}

let started = false;
/** start the real-time loop (4 ticks/s) + autosave */
export function startLoop(): void {
  if (started) return;
  started = true;
  setVolume(useStore.getState().s.settings.sound ?? 0.6);
  let last = Date.now();
  let seenLog = useStore.getState().s.log[0]?.t ?? 0;
  setInterval(() => {
    const now = Date.now();
    const { s, toast } = useStore.getState();
    const dt = Math.min(5, (now - last) / 1000);
    last = now;
    if (now - s.now > 10_000) catchUp(s, now); // tab was asleep
    else tick(s, dt);
    // surface new log entries as toasts
    const fresh = s.log.filter((l) => l.t > seenLog && l.kind === 'good');
    if (s.log[0]) seenLog = Math.max(seenLog, s.log[0].t);
    fresh.slice(0, 3).reverse().forEach((l) => toast(l.text, 'good'));
    useStore.setState({ rev: useStore.getState().rev + 1 });
  }, 250);
  setInterval(save, 15_000);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

/** subscribe a component to every game update */
export function useGame(): GameState {
  useStore((x) => x.rev);
  return useStore.getState().s;
}

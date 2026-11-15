import { useEffect, useState } from 'react';
import { TAXA } from '../data/db';
import { FOOD_NAMES, fmt, fmtTime, parkLevelFromFame } from '../game/balance';
import { Beef, BookOpen, Building2, Coins, Droplets, Fish, FlaskConical, House, Leaf, type LucideIcon, Microscope, Pickaxe, ScrollText, Settings, Syringe, Ticket, TreeDeciduous } from 'lucide-react';
import { mods } from '../game/mods';
import { bankCap, collectBank, incomePerSec } from '../game/park';
import { uniqueHatched } from '../game/meta';
import type { Food } from '../data/types';
import { Btn } from './components';
import logoUrl from '../../electron/icon.png';
import { save, startLoop, useGame, useStore } from './store';
import { desktop, type UpdateEvent } from './desktop';
import { ParkScreen } from './screens/Park';
import { DigScreen } from './screens/Dig';
import { LabScreen } from './screens/Lab';
import { TreeScreen } from './screens/Tree';
import { ResearchScreen } from './screens/Research';
import { BuildingsScreen } from './screens/Buildings';
import { ContractsScreen } from './screens/Contracts';
import { SettingsScreen } from './screens/Settings';
import { GalleryScreen } from './screens/Gallery';
import { GenusModal, CladeModal } from './screens/Encyclopedia';

const TABS: [string, string, LucideIcon][] = [
  ['park', 'Park', House],
  ['dig', 'Wykopaliska', Pickaxe],
  ['lab', 'Laboratorium', FlaskConical],
  ['tree', 'Drzewo życia', TreeDeciduous],
  ['research', 'Badania', Microscope],
  ['buildings', 'Stacje', Building2],
  ['contracts', 'Kontrakty', ScrollText],
  ['settings', 'Inne', Settings],
];

const FOOD_ICON: Record<Food, LucideIcon> = { meat: Beef, plants: Leaf, fish: Fish, plankton: Droplets };

function LevelRing({ value, max, level }: { value: number; max: number; level: number }) {
  const r = 14, c = 2 * Math.PI * r, p = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span className="level-ring">
      <svg viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#3b3527" strokeWidth="3" />
        <circle cx="17" cy="17" r={r} fill="none" stroke="#eaa63a" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
      </svg>
      <b>{level}</b>
    </span>
  );
}

function TopBar() {
  const s = useGame();
  const act = useStore((x) => x.act);
  const setTab = useStore((x) => x.setTab);
  const m = mods(s);
  const inc = incomePerSec(s, m);
  const cap = bankCap(s, m, inc);
  const lvl = parkLevelFromFame(s.fame);
  const full = s.bank >= cap * 0.99;
  return (
    <header className="topbar">
      <span className="brand" title="Self-Organizing Entropic Complex"><img className="logo-img pixel" src={logoUrl} width={34} height={34} alt="" /><span className="brand-name">SEC<small>Self-Organizing Entropic Complex</small></span></span>
      <span className="level" title={`Poziom parku ${lvl.level}. Sława ${fmt(s.fame)} / ${fmt(lvl.next)} — rośnie za nowe gatunki, ewolucje i ukończone warstwy.`}>
        <LevelRing value={s.fame - lvl.cur} max={lvl.next - lvl.cur} level={lvl.level} />
        <small>Poz.<br />parku</small>
      </span>
      <span className="resgroup">
        <span className="lbl">Kasa</span>
        <span className="res" title="Monety — do wydania na budowy, wybiegi i hodowlę"><Coins className="ic" />{fmt(s.coins)}</span>
        <span className="res" title={`Bilety: zwiedzający płacą za oglądanie Twoich zwierząt.
${m.autoCollect ? 'Automatyczne kasy: monety trafiają prosto do portfela.' : `Utarg zbiera się w kasie (mieści ${fmt(m.bankHours)} h) — kliknij „Zbierz”.`}`}><Ticket className="ic" />+{fmt(inc)}<small>/s</small></span>
        {!m.autoCollect && (
          <button className={`collect ${full ? 'full' : ''}`} onClick={() => act(collectBank)} disabled={s.bank < 1} title="Przelej utarg z kasy biletowej do monet">
            {full ? 'Kasa pełna! ' : 'Zbierz '}{fmt(s.bank)} <small>/ {fmt(cap)}</small>
          </button>
        )}
      </span>
      <span className="resgroup" style={{ paddingRight: 12 }}>
        <span className="lbl">Nauka</span>
        <span className="res" title="Punkty Badań — odblokowują badania i ewolucje"><Microscope className="ic" />{fmt(s.pb)}</span>
        <span className="res" title="Mutagen — z bursztynu; potrzebny do wyższych stadiów ewolucji"><Syringe className="ic" />{fmt(s.mutagen)}</span>
        <span className="res" title="Kolekcja: wyhodowane rodzaje"><BookOpen className="ic" />{uniqueHatched(s)}<small>/{TAXA.genera.length}</small></span>
      </span>
      <span className="resgroup" style={{ paddingRight: 12 }}>
        <span className="lbl">Pasza</span>
        {(Object.keys(s.food) as Food[]).map((f) => {
          const I = FOOD_ICON[f];
          return <span key={f} className="res food" title={FOOD_NAMES[f]}><I className="ic" />{fmt(s.food[f])}</span>;
        })}
      </span>
      <span className="spacer" />
      <button className="iconbtn" aria-label="Ustawienia" title="Ustawienia i inne" onClick={() => setTab('settings')}><Settings className="ic" style={{ width: 20, height: 20 }} /></button>
    </header>
  );
}

function Nav() {
  const tab = useStore((x) => x.tab);
  const setTab = useStore((x) => x.setTab);
  const s = useGame();
  const claimable = s.contracts.filter((c) => c.progress >= c.need).length;
  const unseen = (s.discoveries ?? []).filter((d) => !d.seen).length;
  return (
    <nav className="nav">
      {TABS.map(([id, label, I]) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
          <I className="ic" style={{ width: 18, height: 18 }} />
          {label}
          {id === 'contracts' && claimable > 0 && <span className="count" title="Kontrakty do odebrania">{claimable}</span>}
          {id === 'dig' && unseen > 0 && <span className="count" title="Nowe, nieobejrzane odkrycia">{unseen}</span>}
        </button>
      ))}
    </nav>
  );
}

function Toasts() {
  const toasts = useStore((x) => x.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

function OfflineModal() {
  const off = useStore((x) => x.offline);
  const dismiss = useStore((x) => x.dismissOffline);
  if (!off) return null;
  return (
    <div className="modal-bg" onClick={dismiss}>
      <div className="modal" style={{ width: 'min(460px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h2>Gdy Cię nie było… ({fmtTime(off.seconds)})</h2>
        {off.capped && <p className="muted small">Park pracuje bez Ciebie maksymalnie przez ograniczony czas — rozbuduj Logistykę w Badaniach, by go wydłużyć.</p>}
        <div className="col">
          <div>💰 Monety: +{fmt(off.coins)} {off.bank > 0 && <span className="muted">(+{fmt(off.bank)} czeka w kasie)</span>}</div>
          <div>🔬 Punkty Badań: +{fmt(off.pb)}</div>
          <div>🦴 Skamieniałości wykopane przez ekipy: {off.fossils}</div>
          {off.discoveries > 0 && <div style={{ color: '#f2c14e' }}>✨ Nowe gatunki: {off.discoveries} — zobacz w Wykopaliskach</div>}
          <div>🧬 Ukończone ekstrakcje: {off.extractions}</div>
          <div>🥚 Nowe zwierzęta: {off.hatched}</div>
          {off.mutagen > 0 && <div>🧪 Mutagen: +{off.mutagen}</div>}
        </div>
        <div className="row" style={{ marginTop: 12 }}><Btn kind="primary" onClick={dismiss}>Do pracy!</Btn></div>
      </div>
    </div>
  );
}

function Modals() {
  const modal = useStore((x) => x.modal);
  const close = useStore((x) => x.closeModal);
  if (!modal) return null;
  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small close" onClick={close}>✕</button>
        {modal.kind === 'genus' ? <GenusModal id={modal.id} /> : <CladeModal id={modal.id} />}
      </div>
    </div>
  );
}

/** desktop app: a new version was downloaded in the background */
function UpdateBanner() {
  const [u, setU] = useState<UpdateEvent | null>(null);
  useEffect(() => desktop?.onUpdate((e) => setU((p) => (e.kind === 'progress' && p?.kind === 'ready' ? p : { ...p, ...e }))), []);
  if (!u || u.kind !== 'ready') return null;
  return (
    <div className="update-banner">
      <b>Nowa wersja {u.version} jest gotowa!</b>
      <span className="muted small">Zainstaluje się sama przy zamknięciu gry — albo teraz (postęp zostanie zapisany).</span>
      <button className="btn gold" onClick={() => { save(); void desktop?.installUpdate(); }}>Uruchom ponownie i zaktualizuj</button>
      <button className="iconbtn" aria-label="Później" onClick={() => setU(null)}>✕</button>
    </div>
  );
}

export function App() {
  const tab = useStore((x) => x.tab);
  useEffect(() => startLoop(), []);
  return (
    <div className="app">
      <TopBar />
      <Nav />
      <div className="main">
        {tab === 'park' && <ParkScreen />}
        {tab === 'dig' && <DigScreen />}
        {tab === 'lab' && <LabScreen />}
        {tab === 'tree' && <TreeScreen />}
        {tab === 'research' && <ResearchScreen />}
        {tab === 'buildings' && <BuildingsScreen />}
        {tab === 'contracts' && <ContractsScreen />}
        {tab === 'settings' && <SettingsScreen />}
        {tab === 'gallery' && <GalleryScreen />}
      </div>
      <UpdateBanner />
      <Toasts />
      <Modals />
      <OfflineModal />
    </div>
  );
}

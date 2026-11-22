// Park tab: the map with its overlays (island bar, build bar, selection panel, Transporter, zoom) and keyboard shortcuts.

import { useEffect, useMemo, useState } from 'react';
import { HABITAT_ICONS, fmt } from '../../game/balance';
import { mods } from '../../game/mods';
import { CAT_NAMES, ISLANDS, PATH_COST, PLACE_DEFS, clearCost, type PlaceDef } from '../../game/parkContent';
import { animalsIn, boughtIslands, clearedTotal, countOf, defOf, isBought, objById, objectsOn, parkIncome, transporter } from '../../game/parkmap';
import { parkLevel } from '../../game/meta';
import { placeCost } from '../../game/parkContent';
import type { GameState } from '../../game/state';
import { useGame, useStore } from '../store';
import { TS, thumbOf } from './art';
import { ParkMap } from './ParkMap';
import { AnimalList, SelectionPanel, TransporterTray } from './Panels';
import { Interior } from './Interior';
import { ZOOM_MAX, ZOOM_MIN, camera, mapApi, usePark, type BuildCat } from './parkUi';

const CATS: [BuildCat, string][] = [
  ['enclosure', CAT_NAMES.enclosure], ['station', CAT_NAMES.station], ['farm', CAT_NAMES.farm], ['visitor', CAT_NAMES.visitor],
  ['paths', 'Ścieżki'], ['decor', CAT_NAMES.decor], ['land', 'Teren'],
];

const thumbs = new Map<string, string>();
const thumbUrl = (def: PlaceDef) => { let u = thumbs.get(def.id); if (!u) { u = thumbOf(def).toDataURL(); thumbs.set(def.id, u); } return u; };

function islandCenter(id: number) {
  const d = ISLANDS.find((x) => x.id === id)!;
  return [(d.wx + d.w / 2) * TS, (d.wy + d.h / 2) * TS] as const;
}

function IslandBar({ s }: { s: GameState }) {
  const ui = usePark();
  const m = mods(s);
  const bought = boughtIslands(s);
  const next = ISLANDS.find((d) => !isBought(s, d.id));
  return (
    <div className="island-bar">
      <div className="row" style={{ gap: 6 }}>
        {bought.map((id) => {
          const d = ISLANDS.find((x) => x.id === id)!;
          const n = objectsOn(s, id).reduce((k, o) => k + (defOf(o).cat === 'enclosure' ? animalsIn(s, o.id).length : 0), 0);
          return (
            <button key={id} className="island-chip" onClick={() => { const [x, y] = islandCenter(id); mapApi.flyTo?.(x, y, 1.2); }}>
              <b>{d.name}</b><small>{n} zwierząt</small>
            </button>
          );
        })}
        {next && (
          <button className="island-chip locked" onClick={() => { const [x, y] = islandCenter(next.id); mapApi.flyTo?.(x, y, 0.9); ui.select({ kind: 'island', id: next.id }); }}>
            <b>🔒 {next.name}</b><small>poz. {next.level} · 💰 {fmt(next.cost)}</small>
          </button>
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="chip-stat">🦕 <b>{s.animals.length}</b> zwierząt</span>
        <span className="chip-stat">💰 <b>{fmt(parkIncome(s, m))}</b>/s</span>
        {transporter(s).length > 0 && <span className="chip-stat warn-chip">🚚 <b>{transporter(s).length}</b> w Transporterze</span>}
      </div>
    </div>
  );
}

function BuildCard({ s, def }: { s: GameState; def: PlaceDef }) {
  const ui = usePark();
  const lvl = parkLevel(s);
  const locked = lvl < def.unlockLevel;
  const placed = def.unique && countOf(s, def.id) > 0;
  const cost = placeCost(def, countOf(s, def.id));
  const on = ui.tool?.kind === 'place' && ui.tool.defId === def.id;
  const [w, h] = def.size(1);
  return (
    <button className={`build-card ${on ? 'on' : ''}`} disabled={locked || placed} onClick={() => ui.setTool(on ? null : { kind: 'place', defId: def.id, rot: 0 })}
      title={`${def.name}\n${def.desc}${locked ? `\nOd poziomu parku ${def.unlockLevel}` : ''}`}>
      <span className="size">{w}×{h}</span>
      <img className="pixel" src={thumbUrl(def)} alt="" />
      <b>{def.habitat ? `${HABITAT_ICONS[def.habitat]} ` : ''}{def.name}</b>
      <small>{locked ? `🔒 poz. ${def.unlockLevel}` : placed ? 'już stoi' : `💰 ${fmt(cost)}`}</small>
    </button>
  );
}

function BuildBar({ s }: { s: GameState }) {
  const ui = usePark();
  const defs = PLACE_DEFS.filter((d) => d.cat === ui.cat);
  const sel = ui.sel?.kind === 'obj' ? objById(s, ui.sel.id) : undefined;
  return (
    <div className="build-bar panel">
      <div className="row" style={{ gap: 4 }}>
        {CATS.map(([id, name]) => (
          <button key={id} className={`tab ${ui.cat === id ? 'on' : ''}`} onClick={() => { ui.setCat(id); ui.setTool(id === 'paths' ? { kind: 'path' } : id === 'land' ? { kind: 'clear' } : null); }}>{name}</button>
        ))}
        <span className="spacer" />
        <span className="small muted keys"><kbd>R</kbd> obróć · <kbd>X</kbd> rozbiórka · <kbd>Esc</kbd> anuluj · prawy klik: anuluj</span>
      </div>
      <div className="build-items">
        {ui.cat === 'paths' ? (
          <>
            <button className={`build-card ${ui.tool?.kind === 'path' ? 'on' : ''}`} onClick={() => ui.setTool({ kind: 'path' })}><span className="big-ic">🟫</span><b>Ścieżka</b><small>💰 {PATH_COST} / pole · przeciągaj</small></button>
            <button className={`build-card ${ui.tool?.kind === 'unpath' ? 'on' : ''}`} onClick={() => ui.setTool({ kind: 'unpath' })}><span className="big-ic">🧹</span><b>Usuń ścieżkę</b><small>przeciągaj</small></button>
            <div className="build-hint small muted">Wybiegi, sklepy i muzeum muszą stykać się ze ścieżką, która prowadzi do bramy wyspy. Inaczej nic nie zarabiają.</div>
          </>
        ) : ui.cat === 'land' ? (
          <>
            <button className={`build-card ${ui.tool?.kind === 'clear' ? 'on' : ''}`} onClick={() => ui.setTool({ kind: 'clear' })}><span className="big-ic">🌴</span><b>Oczyść teren</b><small>💰 {fmt(Math.round(clearCost(clearedTotal(s)) * (1 - mods(s).clearDiscount)))} / 4×4</small></button>
            <div className="build-hint small muted">Kliknij żółty kwadrat przy wolnym terenie. Każdy kolejny kawałek kosztuje trochę więcej. Nowe wyspy kupisz, klikając je na mapie.</div>
          </>
        ) : defs.map((d) => <BuildCard key={d.id} s={s} def={d} />)}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {(ui.tool?.kind === 'place' || ui.tool?.kind === 'move') && <button className="btn small" onClick={() => { const t = ui.tool; if (t?.kind === 'place' || t?.kind === 'move') ui.setTool({ ...t, rot: t.rot ? 0 : 1 }); }}>Obróć <kbd>R</kbd></button>}
        {sel && !defOf(sel).fixed && <button className="btn small" onClick={() => ui.setTool({ kind: 'move', id: sel.id, rot: sel.rot })}>Przenieś zaznaczone <kbd>M</kbd></button>}
        <button className={`btn small ${ui.tool?.kind === 'demolish' ? 'on' : ''}`} onClick={() => ui.setTool(ui.tool?.kind === 'demolish' ? null : { kind: 'demolish' })}>Rozbiórka <kbd>X</kbd></button>
        <span className="spacer" />
        <span className="small muted">{ui.tool?.kind === 'move' ? 'Kliknij nowe miejsce.' : ui.tool?.kind === 'place' ? 'Kliknij na mapie, by postawić.' : 'Kliknij budynek, by go przenieść.'}</span>
        <button className="btn small primary" onClick={() => ui.setBuild(false)}>Gotowe <kbd>B</kbd></button>
      </div>
    </div>
  );
}

const GUIDE: [string, (s: GameState) => boolean][] = [
  ['Kup pierwsze stanowisko na mapie świata (Wykopaliska → Mapa świata)', (s) => Object.keys(s.unlockedSites).length > 0],
  ['Kop skały w kambryjskim Chengjiang i znajdź pierwszą skamieniałość', (s) => s.stats.fossils > 0],
  ['Kup „Iskrę” w Warsztacie (U) i odpal pierwszą reakcję łańcuchową', (s) => (s.tools?.g_arrow ?? 0) > 0],
  ['Wyekstrahuj DNA w Laboratorium', (s) => s.stats.extractions > 0],
  ['Przy 50% genomu rozpocznij syntezę', (s) => Object.keys(s.hatched).length > 0],
  ['Zwierzę zamieszkało w lagunie — zbieraj monety, klikając dymek', (s) => s.animals.some((a) => a.enc > 0)],
  ['Postaw kiosk przy ścieżce (Buduj → Dla zwiedzających)', (s) => countOf(s, 'v_kiosk') > 0],
];

function StartGuide({ s }: { s: GameState }) {
  const [open, setOpen] = useState(true);
  const done = GUIDE.filter(([, f]) => f(s)).length;
  if (done === GUIDE.length) return null;
  return (
    <div className="start-guide panel">
      <button className="row clean" onClick={() => setOpen(!open)}><b>Jak zacząć · {done}/{GUIDE.length}</b><span className="spacer" />{open ? '▾' : '▸'}</button>
      {open && GUIDE.map(([t, f]) => <div key={t} className={`small guide-step ${f(s) ? 'done' : ''}`}>{f(s) ? '✔' : '○'} {t}</div>)}
    </div>
  );
}

export function ParkScreen() {
  const s = useGame();
  const ui = usePark();
  const setTab = useStore((x) => x.setTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
      const p = usePark.getState();
      const st = useStore.getState().s;
      if (e.key === 'Escape') {
        if (p.interior !== null) p.setInterior(null);
        else if (p.tool) p.setTool(null);
        else if (p.sel) p.select(null);
        else if (p.build) p.setBuild(false);
        else if (p.listOpen) p.setListOpen(false);
        return;
      }
      if (p.interior !== null) return;
      if (e.key === 'b' || e.key === 'B') p.setBuild(!p.build);
      else if ((e.key === 'r' || e.key === 'R') && (p.tool?.kind === 'place' || p.tool?.kind === 'move')) p.setTool({ ...p.tool, rot: p.tool.rot ? 0 : 1 } as never);
      else if (e.key === 'x' || e.key === 'X') { p.setBuild(true); p.setTool(p.tool?.kind === 'demolish' ? null : { kind: 'demolish' }); }
      else if ((e.key === 'm' || e.key === 'M') && p.sel?.kind === 'obj') { const o = objById(st, p.sel.id); if (o && !defOf(o).fixed) { p.setBuild(true); p.setTool({ kind: 'move', id: o.id, rot: o.rot }); } }
      else if (e.key === 'Enter' && p.sel?.kind === 'obj') { const o = objById(st, p.sel.id); if (o && defOf(o).cat === 'enclosure') p.setInterior(o.id); }
      else if (e.key === '+' || e.key === '=') camera.z = Math.min(ZOOM_MAX, camera.z * 1.2);
      else if (e.key === '-') camera.z = Math.max(ZOOM_MIN, camera.z / 1.2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const center = useMemo(() => () => { const [x, y] = islandCenter(1); mapApi.flyTo?.(x, y, 1.3); }, []);

  return (
    <div className={`park-screen ${ui.build ? 'building' : ''}`}>
      <ParkMap />
      <IslandBar s={s} />
      <div className="map-buttons">
        <button className={`btn ${ui.build ? 'gold' : 'primary'}`} onClick={() => ui.setBuild(!ui.build)}>{ui.build ? 'Tryb budowy' : 'Buduj'} <kbd>B</kbd></button>
        <button className={`btn ${ui.listOpen ? 'on' : ''}`} onClick={() => ui.setListOpen(!ui.listOpen)}>Zwierzęta</button>
        <button className="btn" onClick={() => setTab('lab')}>Laboratorium</button>
      </div>
      <div className="zoom-buttons">
        <button className="btn" aria-label="Przybliż" onClick={() => { camera.tz = Math.min(ZOOM_MAX, camera.z * 1.4); camera.tx = camera.x; camera.ty = camera.y; }}>+</button>
        <button className="btn" aria-label="Oddal" onClick={() => { camera.tz = Math.max(ZOOM_MIN, camera.z / 1.4); camera.tx = camera.x; camera.ty = camera.y; }}>−</button>
        <button className="btn" aria-label="Archipelag" title="Cały archipelag" onClick={() => { camera.tx = 15 * TS; camera.ty = 8 * TS; camera.tz = 0.15; }}>🗺</button>
        <button className="btn" aria-label="Wyspa startowa" title="Wróć na Wyspę Startową" onClick={center}>⌂</button>
      </div>
      {!ui.build && <StartGuide s={s} />}
      <div className="park-side">
        {ui.sel ? <SelectionPanel /> : ui.listOpen ? <AnimalList /> : null}
      </div>
      {ui.build ? <BuildBar s={s} /> : <TransporterTray />}
      {ui.interior !== null && <Interior id={ui.interior} />}
    </div>
  );
}

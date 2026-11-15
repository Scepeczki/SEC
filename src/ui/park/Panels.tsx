// Right-hand panels of the park: whatever is selected (enclosure, building, farm, shop, decoration, island, wild land,
// animal) and the list of all animals.

import { useMemo, useState } from 'react';
import { GENERA } from '../../data/db';
import { B, FOOD_ICONS, FOOD_NAMES, HABITAT_ICONS, HABITAT_NAMES, RARITY_NAMES, fmt } from '../../game/balance';
import { BUILDING_BY_ID, foodRate } from '../../game/content';
import { mods } from '../../game/mods';
import { BIOME_NAMES, ENCLOSURE_NAMES, ISLANDS, ISLAND_BY_ID, P, encLevel, interiorSlots } from '../../game/parkContent';
import {
  addPen, animalsIn, autoPlace, bestPen, biomeBonus, buyIsland, canAddPen, canBuyIsland, canClear, canRemove, canUpgrade, clearChunk, collect,
  defOf, happiness, isBought, lacksPath, levelOf, maxPens, objById, objectRate, penSlots, penUsed, rectOf, removeObject,
  storeCap, toTransporter, transporter, upgradeObject,
} from '../../game/parkmap';
import { animalIncomeOf, buyFood, canEvolve, canFeed, evolve, evolveCostFor, feed, feedCost, releaseAnimal } from '../../game/park';
import type { GameState, ParkObject } from '../../game/state';
import { STAGE_NAMES } from '../../sprites/generator';
import { Bar, Btn, Cost, Rarity, SpriteImg } from '../components';
import { sfx } from '../sound';
import { useGame, useStore } from '../store';
import { TS } from './art';
import { startAnimalDrag } from './ParkMap';
import { mapApi, usePark } from './parkUi';

/** "Wybieg 2", "Hodowla 3": ordinal among objects of the same kind */
export function objName(s: GameState, o: ParkObject): string {
  const def = defOf(o);
  if (def.unique || def.cat === 'gate') return def.name;
  const same = s.park.objects.filter((x) => x.def === o.def).sort((a, b) => a.id - b.id);
  return `${def.name} ${same.findIndex((x) => x.id === o.id) + 1}`;
}

export function focusObject(s: GameState, o: ParkObject, z = 1.6) {
  const r = rectOf(o);
  const d = ISLAND_BY_ID.get(o.island)!;
  mapApi.flyTo?.((d.wx + r.x + r.w / 2) * TS, (d.wy + r.y + r.h / 2) * TS, z);
}

function Head({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ gap: 2, flex: 1 }}>
        <span className="lbl">Zaznaczone</span>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {sub && <span className="small muted">{sub}</span>}
      </div>
      <button className="iconbtn" aria-label="Zamknij" onClick={onClose}>✕</button>
    </div>
  );
}

function StoreRow({ s, o }: { s: GameState; o: ParkObject }) {
  const act = useStore((x) => x.act);
  const m = mods(s);
  const def = defOf(o);
  const rate = objectRate(s, o, m);
  const cap = storeCap(o, Math.max(rate, 1e-9), m);
  const farm = def.cat === 'farm';
  const unit = farm ? def.food!.map((f) => FOOD_ICONS[f]).join('') : '💰';
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row small"><span>{farm ? 'Magazyn' : 'Kasa'}: <b>{unit} {fmt(o.store)}</b> / {fmt(cap)}</span><span className="spacer" /><span className="muted">{farm ? `${fmt(rate * 60)} / min` : `+${fmt(rate)}/s`}</span></div>
      <Bar value={o.store} max={cap} kind="gold" />
      {!m.autoCollect && <Btn kind="gold" onClick={() => { const g = act((st) => collect(st, o.id)); if (g) sfx.loot(1, 0); }} disabled={o.store < 1} why="Jeszcze nic się nie uzbierało">Zbierz {unit} {fmt(Math.floor(o.store))}</Btn>}
      {m.autoCollect && <span className="small muted">Automatyczne kasy zbierają same.</span>}
    </div>
  );
}

function Actions({ s, o }: { s: GameState; o: ParkObject }) {
  const act = useStore((x) => x.act);
  const ui = usePark();
  const def = defOf(o);
  const up = canUpgrade(s, o.id);
  const rm = canRemove(s, o.id);
  const lvl = levelOf(s, o);
  return (
    <div className="col" style={{ gap: 6 }}>
      {lvl < def.maxLevel && (
        <Btn kind="gold" onClick={() => { if (act((st) => upgradeObject(st, o.id))) sfx.layer(); }} disabled={!up.ok} why={up.why}>Ulepsz do poz. {lvl + 1} · 💰 {fmt(up.cost)}</Btn>
      )}
      {!up.ok && up.why && lvl < def.maxLevel && <span className="why">{up.why}</span>}
      <div className="row" style={{ gap: 6 }}>
        {!def.fixed && <Btn small onClick={() => { ui.setBuild(true); ui.setTool({ kind: 'move', id: o.id, rot: o.rot }); }}>Przenieś <kbd>M</kbd></Btn>}
        {rm.ok && <Btn small onClick={() => {
          const n = animalsIn(s, o.id).length;
          if (!confirm(`Rozebrać: ${objName(s, o)}?${n ? ` ${n} zwierząt trafi do Transportera.` : ''} Zwrot: ${fmt(rm.refund)} monet.`)) return;
          act((st) => removeObject(st, o.id)); ui.select(null);
        }}>Rozbierz</Btn>}
        <Btn small onClick={() => focusObject(s, o)}>Pokaż</Btn>
      </div>
    </div>
  );
}

function EnclosurePanel({ s, o }: { s: GameState; o: ParkObject }) {
  const act = useStore((x) => x.act);
  const ui = usePark();
  const def = defOf(o);
  const h = happiness(s, o);
  const lv = encLevel(o.level), next = o.level < 7 ? encLevel(o.level + 1) : null;
  const ap = canAddPen(s, o.id);
  const animals = animalsIn(s, o.id);
  const isle = ISLAND_BY_ID.get(o.island)!;
  return (
    <>
      <Head title={objName(s, o)} sub={`${HABITAT_ICONS[def.habitat!]} poziom ${o.level} · ${lv.size[0]}×${lv.size[1]} pól · ${isle.name}`} onClose={() => ui.select(null)} />
      {lacksPath(s, o) && <div className="warn">Brak ścieżki do bramy — zwiedzający tu nie dochodzą, wybieg nic nie zarabia.</div>}
      <div className="pens-mini">
        {Array.from({ length: o.pens ?? 0 }, (_, p) => {
          const here = animalsIn(s, o.id, p);
          return (
            <div key={p} className="pen-mini" data-drop="pen" data-enc={o.id} data-pen={p} title={`Zagroda ${p + 1}: ${penUsed(s, o.id, p)}/${penSlots(s, o)} miejsc`}>
              <span className="lbl">{p + 1}</span>
              <div className="row" style={{ gap: 2 }}>
                {here.map((a) => <span key={a.uid} className="clickable" onPointerDown={(e) => { e.preventDefault(); startAnimalDrag(a.uid); }} onClick={() => ui.select({ kind: 'animal', uid: a.uid })}><SpriteImg genusId={a.genusId} stage={a.stage} scale={1} /></span>)}
              </div>
              <Bar value={penUsed(s, o.id, p)} max={penSlots(s, o)} kind="blue" />
            </div>
          );
        })}
      </div>
      <div className="small muted">{animals.length} zwierząt · zagrody {o.pens}/{maxPens(s, o)} · {penSlots(s, o)} miejsc w każdej</div>
      <Btn kind="primary" onClick={() => ui.setInterior(o.id)}>Wejdź do wybiegu <kbd>Enter</kbd></Btn>
      <StoreRow s={s} o={o} />
      <div className="kv small">
        <span>Zadowolenie</span><b style={{ color: h.total >= 70 ? '#8bb04f' : h.total >= 45 ? '#eaa63a' : '#e0735e' }}>{Math.round(h.total)}%</b>
        <span>Dochód × zadowolenie</span><b>×{(P.happyMin + (P.happyMax - P.happyMin) * h.total / 100).toFixed(2)}</b>
        {biomeBonus(o) > 1 && <><span>Premia wyspy</span><b>+{Math.round((biomeBonus(o) - 1) * 100)}%</b></>}
      </div>
      {(o.pens ?? 0) < maxPens(s, o) && <Btn onClick={() => act((st) => addPen(st, o.id))} disabled={!ap.ok} why={ap.why}>+ Zagroda · 💰 {fmt(ap.cost)}</Btn>}
      {next && <div className="small muted">Poziom {o.level + 1}: {next.size[0]}×{next.size[1]} pól, do {next.pens + mods(s).penCountBonus} zagród po {next.penSlots + mods(s).penSlotBonus} miejsc, wystrój {interiorSlots(o.level + 1)}.</div>}
      <Actions s={s} o={o} />
    </>
  );
}

function StationPanel({ s, o }: { s: GameState; o: ParkObject }) {
  const ui = usePark();
  const def = defOf(o);
  const b = BUILDING_BY_ID[def.station!];
  const lvl = s.buildings[def.station!];
  const setTab = useStore((x) => x.setTab);
  return (
    <>
      <Head title={def.name} sub={`poziom ${lvl}`} onClose={() => ui.select(null)} />
      <div className="small muted">{b.desc}</div>
      <div className="small">Teraz: {b.effect(lvl)}</div>
      {lvl < b.maxLevel && <div className="small muted">Następny: {b.effect(lvl + 1)}</div>}
      {lacksPath(s, o) && <div className="warn">Brak ścieżki do bramy — muzeum nie ma zwiedzających.</div>}
      {def.station === 'museum' && <StoreRow s={s} o={o} />}
      {(def.station === 'sequencer' || def.station === 'hatchery') && <Btn small onClick={() => setTab('lab')}>Otwórz Laboratorium</Btn>}
      {def.station === 'research' && <Btn small onClick={() => setTab('research')}>Otwórz Badania</Btn>}
      {def.station === 'expedition' && <Btn small onClick={() => setTab('dig')}>Otwórz Wykopaliska</Btn>}
      <Actions s={s} o={o} />
    </>
  );
}

function FarmPanel({ s, o }: { s: GameState; o: ParkObject }) {
  const ui = usePark();
  const def = defOf(o);
  const m = mods(s);
  return (
    <>
      <Head title={objName(s, o)} sub={`poziom ${o.level}`} onClose={() => ui.select(null)} />
      <div className="small muted">{def.desc}</div>
      <div className="small">Produkcja: {def.food!.map((f) => `${FOOD_ICONS[f]} ${fmt(foodRate(o.level) * m.farmMult * 60)} ${FOOD_NAMES[f].toLowerCase()}`).join(' i ')} / min</div>
      <div className="small muted">Poziom {o.level + 1}: {fmt(foodRate(o.level + 1) * m.farmMult * 60)} / min</div>
      <StoreRow s={s} o={o} />
      <Actions s={s} o={o} />
    </>
  );
}

function VisitorPanel({ s, o }: { s: GameState; o: ParkObject }) {
  const ui = usePark();
  const def = defOf(o);
  return (
    <>
      <Head title={objName(s, o)} sub={`poziom ${o.level}`} onClose={() => ui.select(null)} />
      <div className="small muted">{def.desc}</div>
      {lacksPath(s, o) && <div className="warn">Brak ścieżki do bramy — nikt tu nie przychodzi.</div>}
      {def.shopShare ? <div className="small muted">Zarabia część dochodu z biletów całej wyspy: im więcej zwierząt i im bardziej zadowolone, tym więcej. Kolejny taki sam budynek na wyspie zarabia mniej.</div> : null}
      {def.comfort ? <div className="small">Sklepy w promieniu {P.comfortRadius} pól zarabiają +{Math.round(def.comfort * (1 + 0.1 * (o.level - 1)) * 100)}%.</div> : null}
      {def.appeal ? <div className="small">Urok +{def.appeal} w okolicy.</div> : null}
      {def.shopShare ? <StoreRow s={s} o={o} /> : null}
      <Actions s={s} o={o} />
    </>
  );
}

function DecorPanel({ s, o }: { s: GameState; o: ParkObject }) {
  const ui = usePark();
  const def = defOf(o);
  return (
    <>
      <Head title={def.name} sub="dekoracja" onClose={() => ui.select(null)} />
      <div className="small">Urok +{def.appeal} dla wybiegów i sklepów w promieniu {P.appealRadius} pól. Podnosi zadowolenie zwierząt i zarobek sklepów.</div>
      <Actions s={s} o={o} />
    </>
  );
}

function GatePanel({ s, o }: { s: GameState; o: ParkObject }) {
  const ui = usePark();
  return (
    <>
      <Head title="Przystań z bramą" sub={ISLAND_BY_ID.get(o.island)!.name} onClose={() => ui.select(null)} />
      <div className="small">Tędy wchodzą zwiedzający. Wybiegi, sklepy i muzeum zarabiają tylko wtedy, gdy ścieżka łączy je z tą bramą.</div>
      <Btn small onClick={() => { ui.setBuild(true); ui.setCat('paths'); ui.setTool({ kind: 'path' }); }}>Rysuj ścieżki</Btn>
    </>
  );
}

function IslandPanel({ s, id }: { s: GameState; id: number }) {
  const act = useStore((x) => x.act);
  const ui = usePark();
  const d = ISLAND_BY_ID.get(id)!;
  const c = canBuyIsland(s, id);
  return (
    <>
      <Head title={d.name} sub={`klimat: ${BIOME_NAMES[d.biome]} · ${d.w}×${d.h} pól`} onClose={() => ui.select(null)} />
      {d.bonusHabitat && <div className="small">Premia: {HABITAT_ICONS[d.bonusHabitat]} {ENCLOSURE_NAMES[d.bonusHabitat].toLowerCase()} zarabiają tu +{Math.round(d.bonus * 100)}%.</div>}
      {!d.bonusHabitat && d.bonus > 0 && <div className="small">Premia: wszystkie wybiegi +{Math.round(d.bonus * 100)}%.</div>}
      {isBought(s, id) ? <div className="small muted">Twoja wyspa.</div> : (
        <>
          <div className="small muted">Wymaga poziomu parku {d.level}.</div>
          <Btn kind="gold" onClick={() => { if (act((st) => buyIsland(st, id))) { sfx.chestOpen(1); ui.select(null); } }} disabled={!c.ok} why={c.why}>Kup wyspę · 💰 {fmt(d.cost)}</Btn>
          {!c.ok && <span className="why">{c.why}</span>}
        </>
      )}
    </>
  );
}

function ChunkPanel({ s, island, chunk }: { s: GameState; island: number; chunk: number }) {
  const act = useStore((x) => x.act);
  const ui = usePark();
  const c = canClear(s, island, chunk);
  return (
    <>
      <Head title="Dziki teren" sub={ISLAND_BY_ID.get(island)!.name} onClose={() => ui.select(null)} />
      <div className="small">Dżungla, skały albo bagno. Po oczyszczeniu (kawałek 4×4 pola) można tu budować.</div>
      <Btn kind="gold" onClick={() => { if (act((st) => clearChunk(st, island, chunk))) { sfx.crumble(true); ui.select(null); } }} disabled={!c.ok} why={c.why}>Oczyść · 💰 {fmt(c.cost)}</Btn>
      {!c.ok && <span className="why">{c.why}</span>}
      <Btn small onClick={() => { ui.setBuild(true); ui.setCat('land'); ui.setTool({ kind: 'clear' }); }}>Tryb oczyszczania</Btn>
    </>
  );
}

export function AnimalPanel({ s, uid }: { s: GameState; uid: number }) {
  const act = useStore((x) => x.act);
  const toast = useStore((x) => x.toast);
  const openGenus = useStore((x) => x.openGenus);
  const ui = usePark();
  const a = s.animals.find((x) => x.uid === uid);
  if (!a) return null;
  const g = GENERA.get(a.genusId)!;
  const m = mods(s);
  const fc = feedCost(s, a, m);
  const cf = canFeed(s, a, m);
  const ce = canEvolve(s, a, m);
  const ec = evolveCostFor(s, a, m);
  const cap = B.stageCap[a.stage];
  const home = a.enc ? objById(s, a.enc) : undefined;
  const best = bestPen(s, uid);
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 2, flex: 1 }}>
          <span className="lbl">Zwierzę</span>
          <h3 style={{ margin: 0 }} className="clickable" onClick={() => openGenus(g.id)}>{g.name}</h3>
          <div className="row" style={{ gap: 6 }}><Rarity r={g.rarity} /><span className="tag" style={{ color: '#d9a441' }}>{STAGE_NAMES[a.stage]}</span></div>
        </div>
        <button className="iconbtn" aria-label="Zamknij" onClick={() => ui.select(null)}>✕</button>
      </div>
      <div className="sprite-stage" onPointerDown={(e) => { e.preventDefault(); startAnimalDrag(uid); }} title="Przeciągnij na zagrodę, by przenieść">
        <SpriteImg genusId={g.id} stage={a.stage} scale={3} animate />
      </div>
      <div className="small muted">{home ? `Mieszka: ${objName(s, home)}, zagroda ${a.pen + 1} · ${ISLAND_BY_ID.get(home.island)!.name}` : 'Czeka w Transporterze (nie zarabia)'}</div>
      <div className="row"><span>Poziom <b>{a.level}</b> / {cap}</span><span className="spacer" /><span className="muted">💰 {fmt(animalIncomeOf(s, a, m))}/s</span></div>
      <Bar value={a.level} max={cap} />
      <div className="small">{FOOD_ICONS[fc.food]} Karmienie: {fmt(fc.amount)} ({FOOD_NAMES[fc.food].toLowerCase()}, masz {fmt(s.food[fc.food])})</div>
      <div className="row" style={{ gap: 6 }}>
        <Btn kind="primary" onClick={() => act((st) => feed(st, uid, 1))} disabled={!cf.ok} why={cf.why}>Nakarm</Btn>
        <Btn small onClick={() => act((st) => feed(st, uid, 10))} disabled={!cf.ok} why={cf.why}>×10</Btn>
        <Btn small onClick={() => act((st) => feed(st, uid, 99))} disabled={!cf.ok} why={cf.why}>Maks</Btn>
      </div>
      {!cf.ok && cf.why === 'Za mało pokarmu' && (
        <Btn small onClick={() => act((st) => buyFood(st, fc.food, fc.amount * 3) || toast('Za mało monet', 'bad'))}>Kup {fmt(fc.amount * 3)} za 💰 {fmt(fc.amount * 3 * B.foodBuyPrice)}</Btn>
      )}
      {a.stage < 4 && (
        <div className="col" style={{ gap: 4 }}>
          <Btn kind="gold" onClick={() => act((st) => evolve(st, uid))} disabled={!ce.ok} why={ce.why}>Ewolucja → {STAGE_NAMES[a.stage + 1]}</Btn>
          <Cost coins={ec.coins} pb={ec.pb} mutagen={ec.mutagen} />
          {!ce.ok && <span className="why">{ce.why}</span>}
        </div>
      )}
      <div className="sep" />
      <span className="lbl">Przenieś</span>
      <div className="small muted">Przeciągnij zwierzę na dowolną zagrodę na mapie albo:</div>
      <div className="row" style={{ gap: 6 }}>
        {best && <Btn small onClick={() => act((st) => autoPlace(st, uid))}>Najlepsze miejsce ({objName(s, objById(s, best[0])!)}, zagr. {best[1] + 1})</Btn>}
        {a.enc > 0 && <Btn small onClick={() => act((st) => toTransporter(st, uid))}>Do Transportera</Btn>}
        {home && <Btn small onClick={() => focusObject(s, home, 2)}>Pokaż</Btn>}
      </div>
      <div className="row small" style={{ gap: 6 }}>
        <Btn small onClick={() => openGenus(g.id)}>📖 Encyklopedia</Btn>
        <span className="spacer" />
        <Btn small onClick={() => { if (confirm(`Wypuścić ${g.name}? Rodzaj zostaje w kolekcji, ale zwierzę zniknie z parku.`)) { act((st) => releaseAnimal(st, uid)); ui.select(null); } }}>Wypuść</Btn>
      </div>
    </>
  );
}

export function SelectionPanel() {
  const s = useGame();
  const sel = usePark((x) => x.sel);
  if (!sel) return null;
  let body: JSX.Element | null = null;
  if (sel.kind === 'animal') body = <AnimalPanel s={s} uid={sel.uid} />;
  else if (sel.kind === 'island') body = <IslandPanel s={s} id={sel.id} />;
  else if (sel.kind === 'chunk') body = <ChunkPanel s={s} island={sel.island} chunk={sel.chunk} />;
  else {
    const o = objById(s, sel.id);
    if (!o) return null;
    const cat = defOf(o).cat;
    body = cat === 'enclosure' ? <EnclosurePanel s={s} o={o} /> : cat === 'station' ? <StationPanel s={s} o={o} /> : cat === 'farm' ? <FarmPanel s={s} o={o} />
      : cat === 'visitor' ? <VisitorPanel s={s} o={o} /> : cat === 'decor' ? <DecorPanel s={s} o={o} /> : <GatePanel s={s} o={o} />;
  }
  return <div className="park-panel panel col">{body}</div>;
}

// ---------------------------------------------------------------- all animals

export function AnimalList() {
  const s = useGame();
  const ui = usePark();
  const [q, setQ] = useState('');
  const [hab, setHab] = useState<string>('all');
  const [where, setWhere] = useState<string>('all');
  const list = useMemo(() => s.animals.filter((a) => {
    const g = GENERA.get(a.genusId)!;
    if (q && !g.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (hab !== 'all' && g.habitat !== hab) return false;
    if (where === 'transport' && a.enc) return false;
    if (where !== 'all' && where !== 'transport') { const o = a.enc ? objById(s, a.enc) : undefined; if (!o || String(o.island) !== where) return false; }
    return true;
  }).sort((x, y) => GENERA.get(x.genusId)!.name.localeCompare(GENERA.get(y.genusId)!.name)), [s.animals.length, q, hab, where, s]);
  return (
    <div className="park-panel panel col">
      <div className="row"><h3 style={{ margin: 0, flex: 1 }}>Zwierzęta ({s.animals.length})</h3><button className="iconbtn" aria-label="Zamknij" onClick={() => ui.setListOpen(false)}>✕</button></div>
      <input className="input" placeholder="Szukaj rodzaju…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row" style={{ gap: 6 }}>
        <select className="input" value={hab} onChange={(e) => setHab(e.target.value)}>
          <option value="all">Każdy habitat</option>
          {Object.entries(HABITAT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={where} onChange={(e) => setWhere(e.target.value)}>
          <option value="all">Wszędzie</option>
          <option value="transport">Transporter</option>
          {ISLANDS.filter((d) => isBought(s, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="small muted">Przeciągnij zwierzę na zagrodę na mapie, by je przenieść.</div>
      <div className="animal-list">
        {list.map((a) => {
          const g = GENERA.get(a.genusId)!;
          const home = a.enc ? objById(s, a.enc) : undefined;
          return (
            <div key={a.uid} className="animal-row" onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); startAnimalDrag(a.uid); } }} onClick={() => ui.select({ kind: 'animal', uid: a.uid })}>
              <SpriteImg genusId={a.genusId} stage={a.stage} scale={1} />
              <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                <b className="ellipsis">{g.name}</b>
                <span className="small muted ellipsis">{home ? `${objName(s, home)} · zagr. ${a.pen + 1}` : 'Transporter'} · poz. {a.level} · {RARITY_NAMES[g.rarity]}</span>
              </div>
              {home && <button className="iconbtn" aria-label="Pokaż na mapie" onClick={(e) => { e.stopPropagation(); focusObject(s, home, 2); }}>⌖</button>}
            </div>
          );
        })}
        {!list.length && <div className="muted small">Brak zwierząt.</div>}
      </div>
    </div>
  );
}

/** animals waiting to be placed */
export function TransporterTray() {
  const s = useGame();
  const ui = usePark();
  const waiting = transporter(s);
  const drag = usePark((x) => x.drag);
  if (!waiting.length && drag === null) return null;
  return (
    <div className={`transporter panel ${drag !== null ? 'drop' : ''}`} data-drop="transport">
      <div className="row" style={{ gap: 8 }}>
        <span className="lbl">Transporter</span>
        <span className="small muted">{waiting.length ? 'przeciągnij na zagrodę' : 'upuść tutaj, by odłożyć'}</span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {waiting.map((a) => (
          <span key={a.uid} className="tray-animal" title={GENERA.get(a.genusId)!.name} onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); startAnimalDrag(a.uid); } }} onClick={() => ui.select({ kind: 'animal', uid: a.uid })}>
            <SpriteImg genusId={a.genusId} stage={a.stage} scale={1} />
          </span>
        ))}
      </div>
    </div>
  );
}

// An enclosure from the inside: a side view with its pens next to each other, animal cards you drag between pens,
// happiness, takings, upgrade and interior decorations.

import { useEffect, useRef } from 'react';
import { GENERA } from '../../data/db';
import type { Habitat } from '../../data/types';
import { HABITAT_ICONS, fmt } from '../../game/balance';
import { mods } from '../../game/mods';
import { INTERIOR_DECOR, INTERIOR_BY_ID, ISLAND_BY_ID, P, encLevel, interiorSlots } from '../../game/parkContent';
import {
  addInterior, addPen, animalRate, animalsIn, canAddInterior, canAddPen, canUpgrade, collect, defOf, enclosures, happiness, lacksPath, maxPens,
  objById, objectRate, penBonus, penSlots, penUsed, removeInterior, storeCap, upgradeObject,
} from '../../game/parkmap';
import type { Animal, GameState, ParkObject } from '../../game/state';
import { Bar, Btn, SpriteImg } from '../components';
import { chorus, sfx, voice } from '../sound';
import { genusSpec, spriteCanvas } from '../sprites';
import { useGame, useStore } from '../store';
import { voiceName } from '../voices';
import { startAnimalDrag } from './ParkMap';
import { AnimalPanel, objName } from './Panels';
import { drawFeed, feedEvents, usePark } from './parkUi';

const SCENE_H = 220;

function paintPen(c: CanvasRenderingContext2D, hab: Habitat, x: number, w: number, seed: number) {
  const H = SCENE_H;
  const rnd = (k: number) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  if (hab === 'land') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fbf78'); g.addColorStop(0.4, '#a7c77d'); g.addColorStop(1, '#6f9a52');
    c.fillStyle = g; c.fillRect(x, 0, w, H);
    for (let i = 0; i < w / 50; i++) { const tx = x + rnd(i) * w; c.fillStyle = '#7d5a3a'; c.fillRect(tx - 2, 40, 5, 26); c.fillStyle = '#5d8a45'; c.beginPath(); c.arc(tx, 36, 18 + rnd(i + 9) * 10, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#c9b48a'; c.fillRect(x, H - 8, w, 8);
  } else if (hab === 'freshwater') {
    c.fillStyle = '#7da36a'; c.fillRect(x, 0, w, H);
    c.fillStyle = '#4f7f86'; c.beginPath(); c.ellipse(x + w * 0.5, H * 0.66, w * 0.44, H * 0.28, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5f8f94'; c.beginPath(); c.ellipse(x + w * 0.45, H * 0.62, w * 0.28, H * 0.15, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3d6a2f'; c.lineWidth = 2;
    for (let i = 0; i < w / 14; i++) { const rx = x + rnd(i) * w; c.beginPath(); c.moveTo(rx, 60); c.lineTo(rx + 3, 30 + rnd(i + 3) * 16); c.stroke(); }
  } else if (hab === 'marine') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6fb8d6'); g.addColorStop(1, '#1f5c80');
    c.fillStyle = g; c.fillRect(x, 0, w, H);
    c.fillStyle = '#ffffff22'; for (let i = 0; i < 7; i++) c.fillRect(x, 20 + i * 28, w, 2);
    c.fillStyle = '#d8c690'; c.fillRect(x, H - 12, w, 12);
    for (let i = 0; i < w / 24; i++) { c.fillStyle = i % 2 ? '#3f8f5a' : '#e07a7a'; c.fillRect(x + rnd(i) * w, H - 32, 3, 22); }
  } else {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9cc9ea'); g.addColorStop(1, '#e6d9b5');
    c.fillStyle = g; c.fillRect(x, 0, w, H);
    c.fillStyle = '#ffffffaa'; for (let i = 0; i < w / 90 + 1; i++) { c.beginPath(); c.ellipse(x + rnd(i) * w, 24 + rnd(i + 4) * 20, 26, 8, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#8a7a64'; c.beginPath(); c.moveTo(x, H); c.lineTo(x + w * 0.25, H - 70); c.lineTo(x + w * 0.5, H); c.fill();
    c.strokeStyle = '#ffffff33'; c.lineWidth = 1; for (let k = x + 6; k < x + w; k += 10) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, H); c.stroke(); }
  }
}

function paintDecor(c: CanvasRenderingContext2D, id: string, x: number) {
  const y = SCENE_H - 10;
  c.save(); c.translate(Math.round(x), y);
  const R = (a: number, b: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
  if (id === 'i_log') { R(-22, -10, 44, 10, '#7a5634'); R(18, -10, 6, 10, '#c9a26a'); }
  else if (id === 'i_boulder' || id === 'i_ledge') { c.fillStyle = '#8d8a80'; c.beginPath(); c.ellipse(0, -10, 22, 14, 0, 0, Math.PI * 2); c.fill(); R(-10, -20, 12, 3, '#b0ad9f'); }
  else if (id === 'i_trough') { R(-20, -12, 40, 12, '#6e5a40'); R(-17, -10, 34, 6, '#5aa0bf'); }
  else if (id === 'i_mud') { c.fillStyle = '#6a5038'; c.beginPath(); c.ellipse(0, -4, 30, 7, 0, 0, Math.PI * 2); c.fill(); }
  else if (id === 'i_ferns' || id === 'i_reeds' || id === 'i_kelp') { c.strokeStyle = id === 'i_kelp' ? '#2f7a4a' : '#3f7a35'; c.lineWidth = 3; for (let k = -14; k <= 14; k += 4) { c.beginPath(); c.moveTo(k, 0); c.quadraticCurveTo(k + 6, -20, k + (k % 8 ? 8 : -6), -34 - (k % 3) * 4); c.stroke(); } }
  else if (id === 'i_nest') { c.fillStyle = '#8a6a3a'; c.beginPath(); c.ellipse(0, -6, 18, 8, 0, 0, Math.PI * 2); c.fill(); R(-6, -14, 6, 7, '#efe6cf'); R(2, -12, 6, 7, '#efe6cf'); }
  else if (id === 'i_reef') { for (let k = -18; k <= 18; k += 6) R(k, -18 - (k % 12), 4, 18 + (k % 12), k % 12 ? '#e07a7a' : '#e0b04a'); }
  else if (id === 'i_perch') { R(-24, -40, 48, 4, '#7a5634'); R(-2, -40, 5, 40, '#6e4f30'); }
  c.restore();
}

interface Mover { x: number; y: number; tx: number; wait: number; dir: number; pen: number }

function Scene({ s, o, selected, onSelect }: { s: GameState; o: ParkObject; selected: number | null; onSelect: (uid: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const movers = useRef(new Map<number, Mover>());
  const live = useRef({ s, o, selected });
  live.current = { s, o, selected };
  useEffect(() => {
    let raf = 0, last = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const W = c.clientWidth;
      if (c.width !== W) c.width = W;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const { s: st, o: enc, selected: sel } = live.current;
      const hab = defOf(enc).habitat!;
      const pens = enc.pens ?? 1;
      const pw = W / pens;
      for (let p = 0; p < pens; p++) paintPen(ctx, hab, p * pw, pw, enc.id * 31 + p);
      (enc.decor ?? []).forEach((id, k) => paintDecor(ctx, id, ((k % pens) + 0.25 + 0.5 * Math.floor(k / pens) % 1) * pw + (k * 37) % Math.max(1, pw * 0.4)));
      // fences between pens
      for (let p = 1; p < pens; p++) { const x = p * pw; ctx.fillStyle = '#7a5634'; ctx.fillRect(x - 2, 30, 4, SCENE_H - 30); for (let y = 40; y < SCENE_H; y += 28) ctx.fillRect(x - 8, y, 16, 3); }
      ctx.fillStyle = '#6e4f30'; for (let x = 0; x < W; x += 34) ctx.fillRect(x, SCENE_H - 22, 4, 22); ctx.fillRect(0, SCENE_H - 18, W, 3); ctx.fillRect(0, SCENE_H - 9, W, 3);
      const frame = Math.floor(now / 420) % 2;
      const yr: [number, number] = hab === 'land' ? [110, SCENE_H - 14] : hab === 'air' ? [60, SCENE_H - 40] : hab === 'freshwater' ? [120, SCENE_H - 20] : [60, SCENE_H - 18];
      const here = animalsIn(st, enc.id).map((a) => {
        let m = movers.current.get(a.uid);
        const x0 = a.pen * pw + 30, x1 = (a.pen + 1) * pw - 30;
        if (!m || m.pen !== a.pen) { const x = x0 + Math.random() * Math.max(1, x1 - x0); m = { x, y: yr[0] + Math.random() * (yr[1] - yr[0]), tx: x, wait: Math.random() * 2, dir: 1, pen: a.pen }; movers.current.set(a.uid, m); }
        if (m.wait > 0) m.wait -= dt;
        else { const d = m.tx - m.x; if (Math.abs(d) < 2) { m.wait = 1 + Math.random() * 3; m.tx = x0 + Math.random() * Math.max(1, x1 - x0); } else { m.x += Math.sign(d) * Math.min(Math.abs(d), (hab === 'air' ? 30 : 18) * dt); m.dir = d < 0 ? -1 : 1; } }
        return { a, m };
      }).sort((p, q) => p.m.y - q.m.y);
      for (const { a, m } of here) {
        const sc = spriteCanvas(genusSpec(a.genusId), a.stage, m.wait <= 0 ? frame : 0);
        const k = sc.width > 60 ? 1.5 : 2;
        const w = sc.width * k, h = sc.height * k;
        if (sel === a.uid) { ctx.fillStyle = '#ffd86688'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, w * 0.4, 6, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (hab === 'land') { ctx.fillStyle = '#00000022'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, w * 0.32, 4, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); ctx.translate(m.x, m.y - h + 4);
        if (m.dir < 0) { ctx.scale(-1, 1); ctx.drawImage(sc, -w / 2, 0, w, h); } else ctx.drawImage(sc, -w / 2, 0, w, h);
        ctx.restore();
        const fe = feedEvents.find((e) => e.uid === a.uid);
        if (fe) { m.wait = Math.max(m.wait, 0.3); drawFeed(ctx, fe, now, m.x, m.y + 4, 2, h); }
      }
      if (!here.length) { ctx.fillStyle = '#14130ecc'; ctx.font = '800 15px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Pusto — przeciągnij tu zwierzę z Transportera albo wyhoduj je w Laboratorium', W / 2, 24); }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: number | null = null, bd = 50;
    for (const [uid, m] of movers.current) { const d = Math.hypot(m.x - x, m.y - 18 - y); if (d < bd && animalsIn(live.current.s, live.current.o.id).some((a) => a.uid === uid)) { bd = d; best = uid; } }
    if (best !== null) {
      onSelect(best);
      const a = live.current.s.animals.find((q) => q.uid === best);
      if (a) voice(a.genusId, { stage: a.stage });
      return;
    }
    // empty spot in a pen: the whole pen calls
    const pens = live.current.o.pens ?? 1;
    const p = Math.floor((x / r.width) * pens);
    chorus(animalsIn(live.current.s, live.current.o.id, p).map((a) => ({ genusId: a.genusId, stage: a.stage })));
  };
  return <canvas ref={ref} height={SCENE_H} className="interior-scene pixel" onClick={onClick} />;
}

function AnimalCard({ s, a, onSelect, selected }: { s: GameState; a: Animal; onSelect: () => void; selected: boolean }) {
  const g = GENERA.get(a.genusId)!;
  return (
    <div className={`animal-card ${selected ? 'on' : ''}`} onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); startAnimalDrag(a.uid); } }} onClick={() => { onSelect(); voice(a.genusId, { stage: a.stage }); }} title={`Kliknij: szczegóły i głos (${voiceName(a.genusId)}) · przeciągnij: przenieś`}>
      <SpriteImg genusId={a.genusId} stage={a.stage} scale={1} />
      <div className="col" style={{ gap: 0, minWidth: 0 }}>
        <b className="ellipsis">{g.name}</b>
        <span className="small muted">poz. {a.level} · 💰 {fmt(animalRate(s, a))}/s</span>
      </div>
    </div>
  );
}

export function Interior({ id }: { id: number }) {
  const s = useGame();
  const act = useStore((x) => x.act);
  const ui = usePark();
  const o = objById(s, id);
  if (!o) { ui.setInterior(null); return null; }
  const def = defOf(o);
  const hab = def.habitat!;
  const all = enclosures(s);
  const idx = all.findIndex((x) => x.id === id);
  const h = happiness(s, o);
  const m = mods(s);
  const rate = objectRate(s, o, m);
  const cap = storeCap(o, Math.max(rate, 1e-9), m);
  const up = canUpgrade(s, o.id);
  const ap = canAddPen(s, o.id);
  const next = o.level < 7 ? encLevel(o.level + 1) : null;
  const sel = ui.sel?.kind === 'animal' && animalsIn(s, o.id).some((a) => a.uid === (ui.sel as { uid: number }).uid) ? ui.sel.uid : null;
  const decorOptions = INTERIOR_DECOR.filter((d) => d.habitat === 'any' || d.habitat === hab);
  return (
    <div className="interior">
      <div className="row">
        <button className="btn" onClick={() => ui.setInterior(null)}>← {ISLAND_BY_ID.get(o.island)!.name}</button>
        <h2 style={{ margin: 0 }}>{HABITAT_ICONS[hab]} {objName(s, o)}</h2>
        <span className="muted">poziom {o.level} · {o.pens}/{maxPens(s, o)} zagród · {penSlots(s, o)} miejsc w każdej</span>
        <span className="spacer" />
        <button className="btn" aria-label="Poprzedni wybieg" disabled={all.length < 2} onClick={() => ui.setInterior(all[(idx - 1 + all.length) % all.length].id)}>‹</button>
        <span className="muted small">{idx + 1} / {all.length}</span>
        <button className="btn" aria-label="Następny wybieg" disabled={all.length < 2} onClick={() => ui.setInterior(all[(idx + 1) % all.length].id)}>›</button>
      </div>
      {lacksPath(s, o) && <div className="warn">Brak ścieżki do bramy — zwiedzający tu nie dochodzą, wybieg nic nie zarabia. Dorysuj ścieżkę w trybie budowy.</div>}
      <Scene s={s} o={o} selected={sel} onSelect={(uid) => ui.select({ kind: 'animal', uid })} />
      <div className="interior-body">
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <div className="pen-columns">
            {Array.from({ length: o.pens ?? 0 }, (_, p) => {
              const here = animalsIn(s, o.id, p);
              const pb = penBonus(s, o.id, p);
              return (
                <div key={p} className="pen-col panel" data-drop="pen" data-enc={o.id} data-pen={p}>
                  <div className="row clickable" style={{ gap: 6 }} title="Kliknij, by usłyszeć zagrodę" onClick={() => chorus(here.map((a) => ({ genusId: a.genusId, stage: a.stage })))}>
                    <b>Zagroda {p + 1}</b>{here.length > 0 && <span className="small muted">🔊</span>}<span className="spacer" />
                    <span className="small muted">{penUsed(s, o.id, p)}/{penSlots(s, o)}</span>
                  </div>
                  <Bar value={penUsed(s, o.id, p)} max={penSlots(s, o)} kind="blue" />
                  {pb.kind === 'herd' && <span className="tag" style={{ color: '#8bb04f' }}>Stado ×{pb.mult.toFixed(1)}</span>}
                  {pb.kind === 'mixed' && <span className="tag" style={{ color: '#6db6e0' }}>Mieszana ×{pb.mult.toFixed(2)}</span>}
                  {here.map((a) => <AnimalCard key={a.uid} s={s} a={a} selected={sel === a.uid} onSelect={() => ui.select({ kind: 'animal', uid: a.uid })} />)}
                  {!here.length && <div className="small muted drop-hint">Upuść tu zwierzę</div>}
                </div>
              );
            })}
            {(o.pens ?? 0) < maxPens(s, o) && (
              <button className="pen-col add" onClick={() => act((st) => addPen(st, o.id))} disabled={!ap.ok} title={ap.why}>
                <b>+ Zagroda</b><span className="small">💰 {fmt(ap.cost)}</span>
              </button>
            )}
          </div>
          <div className="small muted">Zagroda jednogatunkowa (stado): każdy kolejny osobnik +{Math.round(P.herdPer * 100)}% (do +{Math.round(P.herdPer * P.herdMax * 100)}%). Mieszana: +{Math.round(P.mixPer * 100)}% za każdy rodzaj. Mięsożercy mieszkają tylko z własnym rodzajem.</div>
        </div>
        <div className="interior-side col">
          {sel !== null ? <div className="panel col"><AnimalPanel s={s} uid={sel} /></div> : (
            <>
              <div className="panel col">
                <span className="lbl">Kasa wybiegu</span>
                <div className="row small"><b>💰 {fmt(o.store)}</b><span className="muted">/ {fmt(cap)}</span><span className="spacer" /><span className="muted">+{fmt(rate)}/s</span></div>
                <Bar value={o.store} max={cap} kind="gold" />
                <Btn kind="gold" onClick={() => { const g = act((st) => collect(st, o.id)); if (g?.coins) sfx.coins(g.coins); }} disabled={o.store < 1} why="Jeszcze nic się nie uzbierało">Zbierz</Btn>
              </div>
              <div className="panel col">
                <span className="lbl">Zadowolenie · {Math.round(h.total)}%</span>
                <Bar value={h.total} max={100} kind={h.total >= 70 ? undefined : 'gold'} />
                <div className="kv small">
                  <span>Podstawa</span><b>{h.base}</b>
                  <span>Poziom wybiegu</span><b>+{h.level}</b>
                  <span>Wystrój w środku</span><b>+{h.inside}</b>
                  <span>Dekoracje wokół</span><b>+{h.nearby}{h.nearby >= P.happyNearbyCap ? ' (maks.)' : ''}</b>
                  {h.crowd < 0 && <><span>Ścisk</span><b style={{ color: '#e0735e' }}>{h.crowd}</b></>}
                </div>
              </div>
              <div className="panel col">
                <span className="lbl">Ulepszenie</span>
                {next ? <div className="small">Poziom {o.level + 1}: ten sam teren, do {next.pens + mods(s).penCountBonus} zagród po {next.penSlots + mods(s).penSlotBonus} miejsc, wystrój {interiorSlots(o.level + 1)}, zadowolenie +{P.happyPerLevel}.</div> : <div className="small muted">Maksymalny poziom.</div>}
                {next && <Btn kind="gold" onClick={() => { if (act((st) => upgradeObject(st, o.id))) sfx.upgrade(); }} disabled={!up.ok} why={up.why}>Ulepsz · 💰 {fmt(up.cost)}</Btn>}
                {next && !up.ok && <span className="why">{up.why}</span>}
              </div>
              <div className="panel col">
                <span className="lbl">Wystrój · {(o.decor ?? []).length}/{interiorSlots(o.level)}</span>
                <div className="row" style={{ gap: 6 }}>
                  {(o.decor ?? []).map((d, k) => <button key={k} className="btn small" title="Usuń" onClick={() => act((st) => removeInterior(st, o.id, k))}>{INTERIOR_BY_ID.get(d)?.name} ✕</button>)}
                </div>
                <div className="decor-shop">
                  {decorOptions.map((d) => {
                    const c = canAddInterior(s, o.id, d.id);
                    return <button key={d.id} className="btn small" disabled={!c.ok} title={c.why} onClick={() => act((st) => addInterior(st, o.id, d.id))}>{d.name} +{d.comfort} · 💰 {fmt(d.cost)}</button>;
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

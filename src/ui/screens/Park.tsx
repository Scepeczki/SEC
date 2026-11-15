import { useEffect, useRef, useState } from 'react';
import { GENERA } from '../../data/db';
import type { Habitat } from '../../data/types';
import { B, FOOD_ICONS, FOOD_NAMES, HABITAT_ICONS, HABITAT_NAMES, fmt } from '../../game/balance';
import { HABITAT_UNLOCK } from '../../game/content';
import { habitatCapacity, habitatUsed } from '../../game/lab';
import { mods } from '../../game/mods';
import {
  animalIncomeOf, buildHabitat, buyFood, buyPlot, canBuildHabitat, canEvolve, canFeed, evolve, evolveCostFor, feed, feedCost,
  habitatUpgradeCost, incomePerSec, moveAnimal, plotCost, releaseAnimal, upgradeHabitat,
} from '../../game/park';
import type { Animal, GameState, HabitatState } from '../../game/state';
import { STAGE_NAMES } from '../../sprites/generator';
import { Bar, Btn, Cost, Empty, Rarity, SpriteImg } from '../components';
import { genusSpec, spriteCanvas } from '../sprites';
import { useGame, useStore } from '../store';

const SCENE_W = 440, SCENE_H = 170;

const BG: Record<Habitat, (ctx: CanvasRenderingContext2D) => void> = {
  land: (c) => {
    const g = c.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, '#8fbf78'); g.addColorStop(0.35, '#a7c77d'); g.addColorStop(1, '#6f9a52');
    c.fillStyle = g; c.fillRect(0, 0, SCENE_W, SCENE_H);
    c.fillStyle = '#5d8a45';
    for (let i = 0; i < 9; i++) { const x = (i * 53 + 17) % SCENE_W; c.beginPath(); c.arc(x, 26 + (i % 3) * 5, 16 + (i % 2) * 6, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#7d5a3a'; for (let i = 0; i < 9; i++) c.fillRect((i * 53 + 15) % SCENE_W, 34 + (i % 3) * 5, 4, 14);
    c.fillStyle = '#c9b48a'; c.fillRect(0, SCENE_H - 6, SCENE_W, 6);
  },
  freshwater: (c) => {
    c.fillStyle = '#7da36a'; c.fillRect(0, 0, SCENE_W, SCENE_H);
    c.fillStyle = '#4f7f86';
    c.beginPath(); c.ellipse(SCENE_W * 0.5, SCENE_H * 0.62, SCENE_W * 0.46, SCENE_H * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5f8f94'; c.beginPath(); c.ellipse(SCENE_W * 0.45, SCENE_H * 0.58, SCENE_W * 0.3, SCENE_H * 0.18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3d6a2f'; c.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const x = (i * 37) % SCENE_W; c.beginPath(); c.moveTo(x, 40); c.lineTo(x + 3, 18 + (i % 4) * 4); c.stroke(); }
  },
  marine: (c) => {
    const g = c.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, '#6fb8d6'); g.addColorStop(1, '#1f5c80');
    c.fillStyle = g; c.fillRect(0, 0, SCENE_W, SCENE_H);
    c.fillStyle = '#ffffff22';
    for (let i = 0; i < 6; i++) c.fillRect(0, 20 + i * 26, SCENE_W, 2);
    c.fillStyle = '#d8c690'; c.fillRect(0, SCENE_H - 10, SCENE_W, 10);
    c.fillStyle = '#3f8f5a'; for (let i = 0; i < 8; i++) c.fillRect((i * 61 + 9) % SCENE_W, SCENE_H - 26, 3, 18);
  },
  air: (c) => {
    const g = c.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, '#9cc9ea'); g.addColorStop(1, '#e6d9b5');
    c.fillStyle = g; c.fillRect(0, 0, SCENE_W, SCENE_H);
    c.fillStyle = '#ffffffaa';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse((i * 97 + 30) % SCENE_W, 22 + (i % 2) * 18, 26, 8, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#8a7a64'; c.beginPath(); c.moveTo(0, SCENE_H); c.lineTo(80, 110); c.lineTo(150, SCENE_H); c.fill();
    c.beginPath(); c.moveTo(300, SCENE_H); c.lineTo(380, 100); c.lineTo(SCENE_W, SCENE_H); c.fill();
  },
};

interface Mover { x: number; y: number; tx: number; ty: number; wait: number; dir: number }

function HabitatScene({ h, animals, selected, onSelect }: { h: HabitatState; animals: Animal[]; selected: number | null; onSelect: (uid: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const movers = useRef(new Map<number, Mover>());
  const animalsRef = useRef(animals);
  animalsRef.current = animals;
  const selRef = useRef(selected);
  selRef.current = selected;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const yRange: [number, number] = h.type === 'land' ? [70, SCENE_H - 4] : h.type === 'air' ? [40, SCENE_H - 30] : h.type === 'freshwater' ? [75, SCENE_H - 15] : [40, SCENE_H - 14];
    const draw = (now: number) => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      BG[h.type](ctx);
      const frame = Math.floor(now / 420) % 2;
      const list = animalsRef.current.map((a) => {
        let m = movers.current.get(a.uid);
        if (!m) {
          const x = 30 + Math.random() * (SCENE_W - 60);
          const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
          m = { x, y, tx: x, ty: y, wait: Math.random() * 2, dir: Math.random() < 0.5 ? -1 : 1 };
          movers.current.set(a.uid, m);
        }
        return { a, m };
      });
      list.sort((p, q) => p.m.y - q.m.y);
      for (const { a, m } of list) {
        const speed = (h.type === 'air' ? 28 : 16) * (a.stage === 0 ? 1.2 : 1);
        if (m.wait > 0) m.wait -= dt;
        else {
          const dx = m.tx - m.x, dy = m.ty - m.y;
          const d = Math.hypot(dx, dy);
          if (d < 2) {
            m.wait = 1 + Math.random() * 3;
            m.tx = 30 + Math.random() * (SCENE_W - 60);
            m.ty = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
          } else {
            m.x += (dx / d) * speed * dt;
            m.y += (dy / d) * speed * dt;
            if (Math.abs(dx) > 1) m.dir = dx < 0 ? -1 : 1;
          }
        }
        const moving = m.wait <= 0;
        const sc = spriteCanvas(genusSpec(a.genusId), a.stage, moving ? frame : 0);
        const k = sc.width > 60 ? 1.5 : 2;
        const w = sc.width * k, hh = sc.height * k;
        const groundOffset = h.type === 'land' || h.type === 'freshwater' ? hh : hh / 2;
        if (selRef.current === a.uid) {
          ctx.fillStyle = '#ffd86688';
          ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();
        } else if (h.type === 'land') {
          ctx.fillStyle = '#00000022';
          ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, w * 0.32, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save();
        ctx.translate(m.x, m.y - groundOffset + (h.type === 'land' ? 6 : 0));
        if (m.dir < 0) { ctx.scale(-1, 1); ctx.drawImage(sc, -w / 2, 0, w, hh); }
        else ctx.drawImage(sc, -w / 2, 0, w, hh);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [h.type]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SCENE_W;
    const y = ((e.clientY - r.top) / r.height) * SCENE_H;
    let best: number | null = null, bestD = 40;
    for (const a of animalsRef.current) {
      const m = movers.current.get(a.uid);
      if (!m) continue;
      const d = Math.hypot(m.x - x, m.y - 15 - y);
      if (d < bestD) { bestD = d; best = a.uid; }
    }
    if (best !== null) onSelect(best);
  };

  return <canvas ref={ref} width={SCENE_W} height={SCENE_H} className="scene pixel" onClick={onClick} />;
}

function AnimalPanel({ s, uid, onClose }: { s: GameState; uid: number; onClose: () => void }) {
  const act = useStore((x) => x.act);
  const toast = useStore((x) => x.toast);
  const openGenus = useStore((x) => x.openGenus);
  const a = s.animals.find((x) => x.uid === uid);
  if (!a) return null;
  const g = GENERA.get(a.genusId)!;
  const m = mods(s);
  const fc = feedCost(s, a, m);
  const cf = canFeed(s, a, m);
  const ce = canEvolve(s, a, m);
  const ec = evolveCostFor(s, a, m);
  const cap = B.stageCap[a.stage];
  const others = s.habitats.filter((h) => h.type === g.habitat && h.id !== a.habitatId);
  return (
    <div className="panel">
      <div className="row">
        <h3 style={{ margin: 0 }} className="clickable" onClick={() => openGenus(g.id)}>{g.name}</h3>
        <Rarity r={g.rarity} />
        <span className="tag" style={{ color: '#d9a441' }}>{STAGE_NAMES[a.stage]}</span>
        <span className="spacer" />
        <Btn small onClick={onClose}>✕</Btn>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#1a1f18', borderRadius: 8, margin: '8px 0' }}>
        <SpriteImg genusId={g.id} stage={a.stage} scale={4} animate />
      </div>
      <div className="col">
        <div className="row"><span>Poziom <b>{a.level}</b> / {cap}</span><span className="spacer" /><span className="muted">💰 {fmt(animalIncomeOf(s, a, m))}/s</span></div>
        <Bar value={a.level} max={cap} />
        <div className="row">
          <span>{FOOD_ICONS[fc.food]} Karmienie: {fmt(fc.amount)} ({FOOD_NAMES[fc.food].toLowerCase()}, masz {fmt(s.food[fc.food])})</span>
        </div>
        <div className="row">
          <Btn kind="primary" onClick={() => act((st) => feed(st, uid, 1))} disabled={!cf.ok} why={cf.why}>Nakarm</Btn>
          <Btn onClick={() => act((st) => feed(st, uid, 10))} disabled={!cf.ok} why={cf.why}>×10</Btn>
          <Btn onClick={() => act((st) => feed(st, uid, 99))} disabled={!cf.ok} why={cf.why}>Maks</Btn>
          {!cf.ok && cf.why === 'Za mało pokarmu' && (
            <Btn small onClick={() => act((st) => buyFood(st, fc.food, fc.amount * 3) || toast('Za mało monet', 'bad'))} title="Kup pokarm na targu">
              Kup {fmt(fc.amount * 3)} za 💰 {fmt(fc.amount * 3 * B.foodBuyPrice)}
            </Btn>
          )}
        </div>
        {a.stage < 4 && (
          <div className="row">
            <Btn kind="gold" onClick={() => act((st) => evolve(st, uid))} disabled={!ce.ok} why={ce.why}>Ewolucja → {STAGE_NAMES[a.stage + 1]}</Btn>
            <Cost coins={ec.coins} pb={ec.pb} mutagen={ec.mutagen} />
            {!ce.ok && <span className="why">{ce.why}</span>}
          </div>
        )}
        {others.length > 0 && (
          <div className="row small">
            Przenieś do:
            {others.map((h) => <Btn key={h.id} small onClick={() => act((st) => moveAnimal(st, uid, h.id) || toast('Brak miejsca', 'bad'))}>{HABITAT_NAMES[h.type]} #{h.id}</Btn>)}
          </div>
        )}
        <div className="row small">
          <Btn small onClick={() => openGenus(g.id)}>📖 Encyklopedia</Btn>
          <span className="spacer" />
          <Btn small onClick={() => { if (confirm(`Wypuścić ${g.name}? Rodzaj zostaje w kolekcji, ale zwierzę zniknie z parku.`)) { act((st) => releaseAnimal(st, uid)); onClose(); } }}>Wypuść</Btn>
        </div>
      </div>
    </div>
  );
}

function HabitatCard({ s, h, selected, onSelect }: { s: GameState; h: HabitatState; selected: number | null; onSelect: (uid: number) => void }) {
  const act = useStore((x) => x.act);
  const animals = s.animals.filter((a) => a.habitatId === h.id);
  const cap = habitatCapacity(h.level);
  const used = habitatUsed(s, h.id);
  const upc = habitatUpgradeCost(h.level);
  return (
    <div className="panel habitat">
      <div className="head">
        <b>{HABITAT_ICONS[h.type]} {HABITAT_NAMES[h.type]} #{h.id}</b>
        <span className="muted small">poz. {h.level}</span>
        <span className="spacer" />
        <span className="small">miejsce {used}/{cap}</span>
        <div style={{ width: 70 }}><Bar value={used} max={cap} kind="blue" /></div>
        <Btn small onClick={() => act((st) => upgradeHabitat(st, h.id))} disabled={s.coins < upc} why="Za mało monet" title="Powiększ habitat (+2 miejsca)">⬆ 💰 {fmt(upc)}</Btn>
      </div>
      <HabitatScene h={h} animals={animals} selected={selected} onSelect={onSelect} />
      <div className="animal-chips">
        {animals.length === 0 && <span className="muted small">Pusto — wyhoduj zwierzę w Laboratorium.</span>}
        {animals.map((a) => (
          <span key={a.uid} className={`chip ${selected === a.uid ? 'on' : ''}`} onClick={() => onSelect(a.uid)}>
            <SpriteImg genusId={a.genusId} stage={a.stage} scale={1} />
            {GENERA.get(a.genusId)?.name} <span className="muted">{a.level}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ParkScreen() {
  const s = useGame();
  const act = useStore((x) => x.act);
  const [sel, setSel] = useState<number | null>(null);
  const m = mods(s);
  const inc = incomePerSec(s, m);
  const types: Habitat[] = ['land', 'freshwater', 'marine', 'air'];
  return (
    <div className="grid" style={{ gridTemplateColumns: sel !== null ? 'minmax(0,1fr) 360px' : '1fr' }}>
      <div className="col">
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>Twój park</h2>
            <span className="muted">{s.animals.length} zwierząt · dochód 💰 {fmt(inc)}/s · działki {s.habitats.length}/{s.plots}</span>
            <span className="spacer" />
            <Btn small onClick={() => act(buyPlot)} disabled={s.coins < plotCost(s)} why="Za mało monet">+ Działka 💰 {fmt(plotCost(s))}</Btn>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">Nowy habitat:</span>
            {types.map((t) => {
              const c = canBuildHabitat(s, t);
              return (
                <Btn key={t} small onClick={() => act((st) => buildHabitat(st, t))} disabled={!c.ok} why={c.why}>
                  {HABITAT_ICONS[t]} {HABITAT_NAMES[t]} {c.why?.startsWith('Wymaga') ? `🔒${HABITAT_UNLOCK[t]}` : `💰 ${fmt(c.cost)}`}
                </Btn>
              );
            })}
          </div>
        </div>
        {s.animals.length === 0 && s.incubating.length === 0 && (
          <div className="panel">
            <h3>Jak zacząć?</h3>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Idź do <b>⛏️ Wykopalisk</b> i klikaj skały na stanowisku Morrison — pod nimi są skamieniałości.</li>
              <li>W <b>🧬 Laboratorium</b> wyekstrahuj z nich DNA. Przy 50% genomu możesz rozpocząć syntezę.</li>
              <li>Wyklute zwierzę trafi tutaj. Karm je, by rosło i ewoluowało — i zarabiało więcej.</li>
              <li>Nowe gałęzie odblokowujesz w <b>🌳 Drzewie życia</b> za Punkty Badań.</li>
            </ol>
          </div>
        )}
        <div className="grid cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
          {s.habitats.map((h) => <HabitatCard key={h.id} s={s} h={h} selected={sel} onSelect={setSel} />)}
        </div>
        {s.habitats.length === 0 && <Empty>Brak habitatów</Empty>}
      </div>
      {sel !== null && <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}><AnimalPanel s={s} uid={sel} onClose={() => setSel(null)} /></div>}
    </div>
  );
}

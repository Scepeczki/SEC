// Epoch chests: earned every 5 layers, opened by hand. Closed chest rattles → click → lid flies open →
// loot pops out one item at a time, each with its own chime (rare ones sparkle).

import { useEffect, useRef, useState } from 'react';
import { Coins, FlaskConical, Hexagon, Microscope, Sparkles } from 'lucide-react';
import { GENERA } from '../../data/db';
import { FOOD_ICONS, FOOD_NAMES, QUALITY_NAMES, RARITY_COLORS, fmt } from '../../game/balance';
import { CHEST_NAMES, depthMeters, openChest } from '../../game/dig';
import { MINERAL_BY_ID } from '../../game/geology';
import type { GameState, Loot, PendingChest } from '../../game/state';
import { Btn } from '../components';
import { sfx } from '../sound';
import { genusSpec, spriteUrl } from '../sprites';
import { useStore } from '../store';
import { iconUrl } from './art';

export const TIER_COLOR = ['#c07a3e', '#cfd8e0', '#f2c14e'];

/** pixel-ish chest drawing; the lid swings open */
export function ChestArt({ tier, open, size = 160 }: { tier: number; open: boolean; size?: number }) {
  const band = TIER_COLOR[tier];
  return (
    <svg className={`chest-art ${open ? 'open' : ''}`} width={size} height={size * 0.85} viewBox="0 0 120 102" shapeRendering="crispEdges" aria-hidden>
      {open && <polygon className="chest-rays" points="60,52 10,0 40,0 60,40 80,0 110,0" fill={band} opacity="0.35" />}
      <g className="chest-body">
        <rect x="14" y="50" width="92" height="46" fill="#6b4126" />
        <rect x="14" y="50" width="92" height="6" fill="#4e2e1a" />
        <rect x="14" y="66" width="92" height="2" fill="#5a3620" />
        <rect x="14" y="80" width="92" height="2" fill="#5a3620" />
        <rect x="14" y="50" width="8" height="46" fill={band} />
        <rect x="98" y="50" width="8" height="46" fill={band} />
        <rect x="54" y="50" width="12" height="46" fill={band} />
        <rect x="56" y="58" width="8" height="10" fill="#2a1a0e" />
        <rect x="58" y="60" width="4" height="4" fill={open ? '#fff3c4' : '#1a0f08'} />
        {open && <rect x="20" y="46" width="80" height="6" fill="#fff0b0" opacity="0.9" />}
      </g>
      <g className="chest-lid">
        <rect x="12" y="26" width="96" height="26" fill="#7a4a2b" />
        <rect x="12" y="22" width="96" height="6" fill="#8a5632" />
        <rect x="12" y="46" width="96" height="6" fill="#4e2e1a" />
        <rect x="12" y="22" width="8" height="30" fill={band} />
        <rect x="100" y="22" width="8" height="30" fill={band} />
        <rect x="54" y="22" width="12" height="30" fill={band} />
        <rect x="56" y="44" width="8" height="8" fill="#2a1a0e" />
      </g>
    </svg>
  );
}

function LootCard({ s, l }: { s: GameState; l: Loot }) {
  let icon: React.ReactNode, label: string, sub = '';
  const col = l.rare >= 3 ? RARITY_COLORS[3] : l.rare === 2 ? RARITY_COLORS[2] : l.rare === 1 ? RARITY_COLORS[1] : '#d9cdb0';
  switch (l.kind) {
    case 'coins': icon = <Coins className="ic" style={{ color: 'var(--accent)' }} />; label = `+${fmt(l.amount)}`; sub = 'monet'; break;
    case 'shards': icon = <Hexagon className="ic" style={{ color: '#d9c9a3' }} />; label = `+${fmt(l.amount)}`; sub = 'odłamków'; break;
    case 'pb': icon = <Microscope className="ic" style={{ color: 'var(--blue)' }} />; label = `+${fmt(l.amount)}`; sub = 'punktów badań'; break;
    case 'mutagen': icon = <FlaskConical className="ic" style={{ color: '#c58cff' }} />; label = `+${l.amount}`; sub = 'mutagen'; break;
    case 'food': icon = <span style={{ fontSize: 26 }}>{FOOD_ICONS[l.food!]}</span>; label = `+${fmt(l.amount)}`; sub = FOOD_NAMES[l.food!].toLowerCase(); break;
    case 'mineral': {
      const mn = MINERAL_BY_ID.get(l.mineralId ?? '');
      icon = <img className="pixel" src={iconUrl('mineral', l.mineralId ?? 'kwarc', 3)} width={36} height={36} alt="" />;
      label = mn?.name ?? 'Minerał'; sub = `${l.isNew ? 'nowy! · ' : ''}+${fmt(l.amount)} monet`; break;
    }
    default: {
      const g = GENERA.get(l.genusId!);
      icon = g ? <img className="pixel" src={spriteUrl(genusSpec(l.genusId!), 1, 0, !s.hatched[l.genusId!]).url} style={{ height: 40 }} alt="" /> : <Sparkles className="ic" />;
      label = g?.name ?? 'Skamieniałość'; sub = `${l.isNew ? 'NOWY GATUNEK · ' : ''}${QUALITY_NAMES[l.quality ?? 0].toLowerCase()} kość`;
    }
  }
  return (
    <div className={`loot r${l.rare}`} style={{ ['--c' as string]: col }}>
      <span className="loot-ico">{icon}</span>
      <b>{label}</b>
      <small>{sub}</small>
    </div>
  );
}

/** the chest-opening window; `chest` = the one to open first */
export function ChestModal({ s, chest, onClose }: { s: GameState; chest: PendingChest; onClose: () => void }) {
  const act = useStore((x) => x.act);
  const [cur, setCur] = useState(chest);
  const [loot, setLoot] = useState<Loot[] | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<number>();
  useEffect(() => { sfx.chestShake(); const id = window.setInterval(() => { if (!loot) sfx.chestShake(); }, 2400); return () => clearInterval(id); }, [cur.id, loot]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!loot || shown >= loot.length) return;
    timer.current = window.setTimeout(() => { sfx.loot(shown, loot[shown].rare); setShown((n) => n + 1); }, shown ? 380 : 650);
  }, [loot, shown]);
  const open = () => {
    if (loot) return;
    const l = act((g) => openChest(g, cur.id));
    sfx.chestOpen(cur.tier);
    setLoot(l);
    setShown(0);
  };
  const more = (s.chests ?? []).filter((c) => c.id !== cur.id);
  const next = () => { if (!more.length) return; setCur(more[0]); setLoot(null); setShown(0); };
  const done = !!loot && shown >= loot.length;
  return (
    <div className="modal-bg" onClick={() => { if (done || !loot) onClose(); }}>
      <div className={`modal chest-modal t${cur.tier}`} onClick={(e) => e.stopPropagation()} style={{ ['--c' as string]: TIER_COLOR[cur.tier] }}>
        <span className="lbl">Granica epok · −{depthMeters(cur.depth)} m</span>
        <h2 style={{ margin: '4px 0 0', color: TIER_COLOR[cur.tier] }}>{CHEST_NAMES[cur.tier]}</h2>
        <button className={`chest-btn ${loot ? 'opened' : ''}`} onClick={open} aria-label="Otwórz skrzynię" disabled={!!loot}>
          <span className="chest-glow" />
          <ChestArt tier={cur.tier} open={!!loot} size={190} />
        </button>
        {!loot ? (
          <span className="muted">Kliknij skrzynię, żeby ją otworzyć{cur.tier ? ` — ${cur.tier === 2 ? 'złote kryją najwięcej!' : 'srebrne mają więcej łupów'}` : ''}</span>
        ) : (
          <div className="loot-row">{loot.slice(0, shown).map((l, i) => <LootCard key={i} s={s} l={l} />)}</div>
        )}
        <div className="row" style={{ gap: 10, minHeight: 44, justifyContent: 'center' }}>
          {done && more.length > 0 && <Btn big kind="gold" onClick={next}>Otwórz następną ({more.length})</Btn>}
          {done && <Btn big onClick={onClose}>Zabierz</Btn>}
          {!loot && <Btn onClick={onClose}>Później</Btn>}
        </div>
      </div>
    </div>
  );
}

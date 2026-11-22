// Illustrations for story slides: small animated SVG scenes (no external images), plus a schematic palaeo-map.
// Animals in scenes are the game's own pixel sprites of the chapter's fauna.

import type { ReactNode } from 'react';
import { GENERA, GENUS_BY_NAME, SITE_BY_ID } from '../../data/db';
import type { PaleoMap } from '../../data/story';
import { genusSpec, spriteUrl } from '../sprites';

const W = 640, H = 400;

function Frame({ children, bg = '#0f1418', label }: { children: ReactNode; bg?: string; label: string }) {
  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <rect width={W} height={H} fill={bg} />
      {children}
    </svg>
  );
}

/** deterministic pseudo-random */
const rnd = (seed: number) => { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };

function Stars({ n = 70, seed = 1 }: { n?: number; seed?: number }) {
  const r = rnd(seed);
  return <g className="sc-stars">{Array.from({ length: n }, (_, i) => <circle key={i} cx={r() * W} cy={r() * H} r={r() * 1.4 + 0.3} fill="#fff" opacity={0.3 + r() * 0.6} />)}</g>;
}

function Sprite({ name, x, y, k = 3, flip, cls }: { name: string; x: number; y: number; k?: number; flip?: boolean; cls?: string }) {
  const g = GENUS_BY_NAME.get(name);
  if (!g) return null;
  const u = spriteUrl(genusSpec(g.id), 1, 0, false);
  return <image className={cls} href={u.url} x={x - (u.w * k) / 2} y={y - u.h * k} width={u.w * k} height={u.h * k} style={{ imageRendering: 'pixelated' }} transform={flip ? `scale(-1,1) translate(${-2 * x},0)` : undefined} />;
}

/** a few of the chapter's animals, by name */
function faunaOf(siteId?: string, n = 8): string[] {
  const site = siteId ? SITE_BY_ID.get(siteId) : undefined;
  return [...(site?.fauna ?? [])].sort((a, b) => b.occ - a.occ).slice(0, n).map((f) => GENERA.get(f.genusId)?.name ?? '').filter(Boolean);
}

function blob(cx: number, cy: number, rx: number, ry: number, seed: number, pts = 18): string {
  const r = rnd(seed);
  const p: string[] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const k = 0.75 + r() * 0.45;
    p.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${p.join(' L')} Z`;
}

export function PaleoMapView({ map }: { map: PaleoMap }) {
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;
  const R = { S: 22, M: 38, L: 58, XL: 95 } as const;
  return (
    <Frame bg="#173a52" label="Schematyczna mapa świata">
      <g className="sc-grid">
        {[-60, -30, 0, 30, 60].map((l) => <line key={l} x1={0} x2={W} y1={Y(l)} y2={Y(l)} stroke="#ffffff" opacity={l === 0 ? 0.25 : 0.08} strokeDasharray={l === 0 ? '6 6' : undefined} />)}
        <text x={6} y={Y(0) - 4} className="sc-small">równik</text>
      </g>
      {map.continents.map((c, i) => {
        const rx = R[c.size] ?? 40;
        return (
          <g key={c.name}>
            <path d={blob(X(c.lon), Y(c.lat), rx * 1.25, rx * 0.8, i + 3)} fill="#8a7b55" stroke="#c9b98a" strokeWidth={1.5} opacity={0.92} />
            <text x={X(c.lon)} y={Y(c.lat) + (c.size === 'S' ? rx * 0.8 + 14 : 4)} textAnchor="middle" className={c.size === 'S' ? 'sc-small sc-strong' : 'sc-label'}>{c.name}</text>
          </g>
        );
      })}
      <g className="sc-site">
        <circle cx={X(map.site.lon)} cy={Y(map.site.lat)} r={14} className="sc-pulse" />
        <circle cx={X(map.site.lon)} cy={Y(map.site.lat)} r={6} fill="#eaa63a" stroke="#fff8e8" strokeWidth={2} />
      </g>
      <text x={W - 8} y={H - 8} textAnchor="end" className="sc-small">schemat · położenia przybliżone</text>
    </Frame>
  );
}

export function Scene({ id, siteId, map }: { id: string; siteId?: string; map?: PaleoMap }) {
  const fauna = faunaOf(siteId);
  switch (id) {
    case 'planet-forming':
      return (
        <Frame label="Powstawanie Układu Słonecznego" bg="#07080d">
          <Stars seed={2} />
          <circle cx={320} cy={200} r={34} fill="#ffd27a" className="sc-glow" />
          <ellipse cx={320} cy={200} rx={260} ry={60} fill="none" stroke="#c98b4a" strokeWidth={26} opacity={0.25} className="sc-spin" />
          <ellipse cx={320} cy={200} rx={190} ry={44} fill="none" stroke="#e0a868" strokeWidth={12} opacity={0.3} />
          <circle cx={500} cy={226} r={13} fill="#9a6a4a" className="sc-bob" />
          <circle cx={150} cy={180} r={7} fill="#7d6450" />
        </Frame>
      );
    case 'impact':
      return (
        <Frame label="Zderzenie, z którego powstał Księżyc" bg="#07080d">
          <Stars seed={3} />
          <circle cx={290} cy={220} r={110} fill="#a0543a" />
          <circle cx={290} cy={220} r={110} fill="url(#lava)" opacity={0.5} />
          <circle cx={430} cy={130} r={45} fill="#7a6a5a" className="sc-approach" />
          <circle cx={385} cy={160} r={30} fill="#ffcf6a" opacity={0.7} className="sc-flash" />
          <defs><radialGradient id="lava"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#5a1e10" /></radialGradient></defs>
        </Frame>
      );
    case 'hadean':
      return (
        <Frame label="Hadeik: rozżarzona Ziemia" bg="#120806">
          <Stars seed={4} n={30} />
          <circle cx={320} cy={210} r={150} fill="#3a1a12" />
          {Array.from({ length: 14 }, (_, i) => { const r = rnd(i + 9); return <path key={i} d={`M${200 + r() * 240},${100 + r() * 220} q${r() * 40 - 20},${r() * 40 - 20} ${r() * 60 - 30},${r() * 60 - 30}`} stroke="#ff7a2a" strokeWidth={3 + r() * 3} fill="none" className="sc-flicker" />; })}
          <circle cx={540} cy={80} r={22} fill="#cfc8b8" opacity={0.85} />
        </Frame>
      );
    case 'ocean':
      return (
        <Frame label="Pierwsze oceany" bg="#0b1a2a">
          <rect y={220} width={W} height={180} fill="#1e5a7a" />
          {[0, 1, 2, 3].map((k) => <path key={k} d={`M0,${232 + k * 30} q80,-12 160,0 t160,0 t160,0 t160,0`} stroke="#7fc4e0" strokeWidth={2} fill="none" opacity={0.4} className="sc-wave" style={{ animationDelay: `${k * 0.5}s` }} />)}
          <path d="M60,220 L140,140 L200,220 Z" fill="#3a3530" />
          <path d="M430,220 L500,170 L590,220 Z" fill="#3a3530" />
          {[0, 1, 2, 3, 4, 5].map((k) => <line key={k} x1={120 + k * 80} y1={40} x2={100 + k * 80} y2={200} stroke="#9fc5e8" opacity={0.25} className="sc-rain" style={{ animationDelay: `${k * 0.3}s` }} />)}
        </Frame>
      );
    case 'first-cells':
      return (
        <Frame label="Pierwsze komórki" bg="#0d2a33">
          {Array.from({ length: 24 }, (_, i) => { const r = rnd(i + 30); return <ellipse key={i} cx={r() * W} cy={r() * H} rx={8 + r() * 10} ry={5 + r() * 6} fill="#7fd0c0" opacity={0.35 + r() * 0.4} className="sc-drift" style={{ animationDelay: `${r() * 4}s` }} />; })}
        </Frame>
      );
    case 'stromatolites':
      return (
        <Frame label="Stromatolity w płytkim morzu" bg="#1a3a44">
          <rect y={0} width={W} height={150} fill="#e6c27a" opacity={0.12} />
          <rect y={300} width={W} height={100} fill="#6b5a3a" />
          {[90, 210, 330, 450, 560].map((x, i) => (
            <g key={x}>{[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${x - 46 + k * 4},300 Q${x},${236 - i * 6 + k * 10} ${x + 46 - k * 4},300`} fill={k % 2 ? '#7a8a4a' : '#5f6e38'} />)}</g>
          ))}
          {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={60 + i * 42} cy={260} r={3} fill="#cfefff" opacity={0.6} className="sc-rise" style={{ animationDelay: `${i * 0.35}s` }} />)}
        </Frame>
      );
    case 'oxygen':
      return (
        <Frame label="Wielkie natlenienie" bg="#163a4a">
          {Array.from({ length: 30 }, (_, i) => { const r = rnd(i + 50); return <circle key={i} cx={r() * W} cy={200 + r() * 200} r={2 + r() * 5} fill="#e8fbff" opacity={0.5} className="sc-rise" style={{ animationDelay: `${r() * 4}s` }} />; })}
          {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={0} y={300 + k * 16} width={W} height={8} fill={k % 2 ? '#8a3a22' : '#4a4a4a'} />)}
          <text x={20} y={40} className="sc-label">O₂</text>
        </Frame>
      );
    case 'eukaryote':
      return (
        <Frame label="Komórka eukariotyczna" bg="#10262a">
          <ellipse cx={320} cy={200} rx={220} ry={150} fill="#2e6a5e" stroke="#7fd0c0" strokeWidth={3} />
          <circle cx={300} cy={190} r={56} fill="#4a3a6a" stroke="#b98be3" strokeWidth={3} />
          <circle cx={300} cy={190} r={16} fill="#b98be3" opacity={0.6} />
          {[[170, 120], [430, 270], [450, 140], [190, 280]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={30} ry={14} fill="#c46a3a" stroke="#e0a07a" strokeWidth={2} transform={`rotate(${i * 40} ${x} ${y})`} className="sc-bob" />)}
          <text x={300} y={270} textAnchor="middle" className="sc-small">jądro</text>
          <text x={430} y={300} textAnchor="middle" className="sc-small">mitochondrium</text>
        </Frame>
      );
    case 'multicell':
      return (
        <Frame label="Wielokomórkowość" bg="#10262a">
          {Array.from({ length: 19 }, (_, i) => { const a = (i / 19) * Math.PI * 2 * 3, d = 14 + i * 7; return <circle key={i} cx={320 + Math.cos(a) * d} cy={200 + Math.sin(a) * d} r={18} fill="#2e6a5e" stroke="#7fd0c0" strokeWidth={2} className="sc-pulse-soft" style={{ animationDelay: `${i * 0.1}s` }} />; })}
        </Frame>
      );
    case 'snowball':
      return (
        <Frame label="Ziemia-śnieżka" bg="#07080d">
          <Stars seed={7} />
          <circle cx={320} cy={200} r={150} fill="#e8f2f8" />
          <path d="M200,170 q60,-30 120,0 t120,10" stroke="#b8cfe0" strokeWidth={10} fill="none" />
          <path d="M220,250 q60,20 120,0 t90,-10" stroke="#b8cfe0" strokeWidth={8} fill="none" />
          <circle cx={360} cy={230} r={10} fill="#3a6a8a" opacity={0.6} />
        </Frame>
      );
    case 'ediacara':
      return (
        <Frame label="Fauna ediakarska" bg="#16323a">
          <rect y={300} width={W} height={100} fill="#6b5a3a" />
          {[100, 230, 470].map((x, i) => (
            <g key={x} className="sc-sway" style={{ transformOrigin: `${x}px 300px`, animationDelay: `${i * 0.6}s` }}>
              <line x1={x} y1={300} x2={x} y2={150 - i * 10} stroke="#c9b98a" strokeWidth={3} />
              {Array.from({ length: 12 }, (_, k) => <ellipse key={k} cx={x + (k % 2 ? 10 : -10)} cy={165 - i * 10 + k * 11} rx={12} ry={4} fill="#b8a878" />)}
            </g>
          ))}
          {[[340, 330], [560, 345], [180, 350]].map(([x, y], i) => (
            <g key={i}><ellipse cx={x} cy={y} rx={34} ry={14} fill="#a89868" />{Array.from({ length: 9 }, (_, k) => <line key={k} x1={x - 30 + k * 7.5} y1={y - 12} x2={x - 30 + k * 7.5} y2={y + 12} stroke="#7a6a48" />)}</g>
          ))}
        </Frame>
      );
    case 'burrows':
      return (
        <Frame label="Pierwsze nory w dnie" bg="#16323a">
          <rect y={150} width={W} height={250} fill="#6b5a3a" />
          {Array.from({ length: 7 }, (_, i) => { const r = rnd(i + 70); const x = 50 + i * 85; return <path key={i} d={`M${x},150 q${r() * 40 - 20},50 ${r() * 30},90 t${r() * 40 - 20},80`} stroke="#3a2e1e" strokeWidth={7} fill="none" strokeLinecap="round" />; })}
        </Frame>
      );
    case 'eyes':
      return (
        <Frame label="Oko złożone" bg="#141418">
          {Array.from({ length: 9 }, (_, r) => Array.from({ length: 13 }, (_, c) => { const x = 110 + c * 36 + (r % 2) * 18, y = 60 + r * 31; return <polygon key={`${r}-${c}`} points={[0, 1, 2, 3, 4, 5].map((k) => `${x + 17 * Math.cos(k * Math.PI / 3 + Math.PI / 6)},${y + 17 * Math.sin(k * Math.PI / 3 + Math.PI / 6)}`).join(' ')} fill="#2a3a4a" stroke="#6db6e0" strokeWidth={1.5} className="sc-pulse-soft" style={{ animationDelay: `${(r + c) * 0.05}s` }} />; }))}
        </Frame>
      );
    case 'fossil':
      return (
        <Frame label="Jak powstaje skamieniałość" bg="#2a241c">
          {[0, 1, 2, 3, 4, 5, 6].map((k) => <rect key={k} y={60 + k * 48} width={W} height={48} fill={['#7a6a52', '#6a5a44', '#857560', '#5f523f', '#7a6a52', '#6a5a44', '#857560'][k]} />)}
          {fauna[0] && <g opacity={0.8}><Sprite name={fauna[0]} x={330} y={250} k={6} /></g>}
        </Frame>
      );
    case 'timeline':
      return (
        <Frame label="Czas geologiczny" bg="#141310">
          {[['Hadeik', 4600, 4000, '#7a2a3a'], ['Archaik', 4000, 2500, '#c0306a'], ['Proterozoik', 2500, 539, '#c04a5a'], ['Fanerozoik', 539, 0, '#5a9a8a']].map(([n, a, b, c]) => {
            const x0 = 30 + ((4600 - (a as number)) / 4600) * 580, x1 = 30 + ((4600 - (b as number)) / 4600) * 580;
            return <g key={n as string}><rect x={x0} y={170} width={x1 - x0 - 2} height={60} rx={6} fill={c as string} /><text x={(x0 + x1) / 2} y={206} textAnchor="middle" className="sc-label">{n}</text></g>;
          })}
          <text x={30} y={260} className="sc-small">4,6 mld lat temu</text>
          <text x={610} y={260} textAnchor="end" className="sc-small">dziś</text>
        </Frame>
      );
    case 'worldmap':
      return map ? <PaleoMapView map={map} /> : <Scene id="ocean" />;
    case 'next':
      return (
        <Frame label="Dalej" bg="#141310">
          <path d="M120,200 H480" stroke="#eaa63a" strokeWidth={10} strokeLinecap="round" className="sc-dash" />
          <path d="M460,170 L520,200 L460,230 Z" fill="#eaa63a" />
          {fauna.slice(0, 3).map((n, i) => <Sprite key={n} name={n} x={180 + i * 110} y={170} k={3} />)}
        </Frame>
      );
    case 'explosion':
    case 'seafloor':
    case 'foodweb':
    case 'tree':
    default: {
      // a living sea floor with the chapter's animals
      const swim = fauna.slice(0, 4), bottom = fauna.slice(4, 8);
      return (
        <Frame label="Dno morza z jego mieszkańcami" bg="#123848">
          <rect y={0} width={W} height={H} fill="url(#sea)" />
          <defs><linearGradient id="sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a6a88" /><stop offset="1" stopColor="#0e2a36" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={80 + k * 130} y1={0} x2={40 + k * 130} y2={260} stroke="#cfefff" opacity={0.06} strokeWidth={30} />)}
          <path d="M0,330 q80,-20 160,0 t160,-4 t160,6 t160,-6 V400 H0 Z" fill="#5a4a32" />
          {swim.map((n, i) => <g key={n} className="sc-swim" style={{ animationDelay: `${i * 1.3}s` }}><Sprite name={n} x={110 + i * 140} y={120 + (i % 2) * 70} k={3} flip={i % 2 === 1} /></g>)}
          {bottom.map((n, i) => <Sprite key={n} name={n} x={90 + i * 150} y={338} k={3} />)}
        </Frame>
      );
    }
  }
}

/** where in the history of the Earth a prologue slide sits */
export const PROLOGUE_AT: Record<string, number> = {
  'planet-forming': 4567, impact: 4510, hadean: 4300, ocean: 4000, 'first-cells': 3800, stromatolites: 3480,
  oxygen: 2400, eukaryote: 1900, multicell: 1050, snowball: 680, ediacara: 565, burrows: 545, explosion: 530, timeline: 4600, fossil: 540,
};

/** 4.6 billion years with the eons, and a marker */
export function DeepTimeBar({ at }: { at?: number }) {
  const eons: [string, number, number, string][] = [['Hadeik', 4600, 4000, '#7a2a3a'], ['Archaik', 4000, 2500, '#a0305a'], ['Proterozoik', 2500, 539, '#b04a5a'], ['Fanerozoik', 539, 0, '#4f8a7a']];
  const x = (ma: number) => ((4600 - ma) / 4600) * 100;
  return (
    <div className="deeptime">
      {eons.map(([n, a, b, c]) => <span key={n} style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%`, background: c }}>{n}</span>)}
      {at !== undefined && <i style={{ left: `${x(at)}%` }}><b>{at >= 1000 ? `${(at / 1000).toFixed(at % 1000 ? 2 : 1).replace('.', ',')} mld lat temu` : `${Math.round(at)} mln lat temu`}</b></i>}
    </div>
  );
}

import type { ReactNode } from 'react';
import { GENERA } from '../data/db';
import { RARITY_COLORS, RARITY_NAMES, fmt } from '../game/balance';
import { genusSpec, spriteUrl, useAnimFrame } from './sprites';

export function SpriteImg(props: { genusId: number; stage?: number; scale?: number; animate?: boolean; silhouette?: boolean; flip?: boolean; title?: string }) {
  const { genusId, stage = 1, scale = 2, animate = false, silhouette = false, flip = false, title } = props;
  const frame = useAnimFrame(animate);
  const u = spriteUrl(genusSpec(genusId), stage, frame, silhouette);
  return (
    <img
      className="pixel"
      src={u.url}
      width={u.w * scale}
      height={u.h * scale}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      alt={GENERA.get(genusId)?.name}
      title={title ?? GENERA.get(genusId)?.name}
      draggable={false}
    />
  );
}

export function Bar({ value, max, kind, title }: { value: number; max: number; kind?: 'gold' | 'blue' | 'purple'; title?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${kind ?? ''}`} title={title}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Btn(props: { onClick: () => void; disabled?: boolean; why?: string; children: ReactNode; kind?: 'primary' | 'gold'; small?: boolean; big?: boolean; on?: boolean; title?: string }) {
  const cls = ['btn', props.kind ?? '', props.small ? 'small' : '', props.big ? 'big' : '', props.on ? 'on' : ''].join(' ');
  return (
    <button className={cls} onClick={props.onClick} disabled={props.disabled} title={props.disabled ? props.why : props.title}>
      {props.children}
    </button>
  );
}

export function Rarity({ r }: { r: number }) {
  return <span className="tag" style={{ color: RARITY_COLORS[r] }}>{RARITY_NAMES[r]}</span>;
}

export function Cost({ coins, pb, mutagen }: { coins?: number; pb?: number; mutagen?: number }) {
  return (
    <span className="small">
      {coins ? <>💰 {fmt(coins)} </> : null}
      {pb ? <>🔬 {fmt(pb)} </> : null}
      {mutagen ? <>🧪 {fmt(mutagen)}</> : null}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted" style={{ padding: 16, textAlign: 'center' }}>{children}</div>;
}

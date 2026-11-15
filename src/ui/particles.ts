// Tiny pixel-art particle system drawn on a canvas overlay (rock chips, dust, sparkles, floating text).

type Kind = 'chip' | 'dust' | 'spark' | 'text';

interface P {
  kind: Kind;
  x: number; y: number; vx: number; vy: number;
  g: number;          // gravity px/s²
  life: number; max: number;
  size: number;
  color: string;
  text?: string;
  spin?: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  canvas: HTMLCanvasElement | null = null;

  attach(c: HTMLCanvasElement | null) {
    this.canvas = c;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ps = [];
  }

  /** rock chips flying out of a hit */
  chips(x: number, y: number, colors: string[], n = 8, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = rnd(90, 230) * power;
      this.add({ kind: 'chip', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 680, life: 0, max: rnd(0.55, 1.0), size: Math.round(rnd(3, 7)), color: colors[i % colors.length], spin: rnd(-1, 1) });
    }
  }

  /** soft dust cloud */
  dust(x: number, y: number, n = 5, color = '#d8c7a0') {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'dust', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-25, 25), vy: rnd(-35, -5), g: -10, life: 0, max: rnd(0.5, 1.0), size: rnd(3, 6), color });
    }
  }

  /** golden burst for a finished fossil */
  sparks(x: number, y: number, n = 18, color = '#f2c14e') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
      const sp = rnd(60, 170);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 160, life: 0, max: rnd(0.6, 1.1), size: Math.round(rnd(2, 4)), color: i % 5 === 0 ? '#ffe2a0' : color });
    }
  }

  /** floating label rising from a find */
  text(x: number, y: number, text: string, color = '#fff', size = 14) {
    this.add({ kind: 'text', x, y, vx: 0, vy: -38, g: 0, life: 0, max: 1.6, size, color, text });
  }

  private add(p: P) {
    if (this.ps.length > 600) this.ps.shift();
    this.ps.push(p);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    const c = this.canvas;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!c) { this.raf = 0; return; }
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const alive: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += p.g * dt;
      if (p.kind === 'dust') { p.vx *= 0.96; p.vy *= 0.96; p.size += dt * 6; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      alive.push(p);
      const k = 1 - p.life / p.max;
      if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, k * 2.2);
        ctx.font = `bold ${p.size}px system-ui, "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1a140e';
        ctx.strokeText(p.text!, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text!, p.x, p.y);
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = 0.35 * k;
        ctx.fillStyle = p.color;
        const s = Math.round(p.size);
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      } else {
        ctx.globalAlpha = p.kind === 'spark' ? Math.min(1, k * 1.5) : Math.min(1, k * 3);
        ctx.fillStyle = p.color;
        const s = p.kind === 'chip' && p.spin! * p.life > 0.3 ? Math.max(1, p.size - 1) : p.size; // cheap "tumble"
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
        if (p.kind === 'chip') { ctx.fillStyle = '#0004'; ctx.fillRect(Math.round(p.x), Math.round(p.y) + s - 1, s, 1); }
      }
    }
    ctx.globalAlpha = 1;
    this.ps = alive;
    this.raf = alive.length ? requestAnimationFrame(this.frame) : 0;
    if (!alive.length) ctx.clearRect(0, 0, w, h);
  };
}

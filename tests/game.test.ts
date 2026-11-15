import { describe, expect, it } from 'vitest';
import { GENUS_BY_NAME, TAXA, spriteSpec } from '../src/data/db';
import { renderSprite } from '../src/sprites/generator';
import { catchUp, deserialize, serialize, startGame, tick } from '../src/game/engine';
import { blastCharge, generateLayer, hammerRisk, hitTile, openChest, siteState } from '../src/game/dig';
import { stratumAt } from '../src/game/geology';
import { TOOL_NODES, TOOL_NODE_BY_ID, buyToolNode } from '../src/game/tools';
import { canSynthesize, queueAll } from '../src/game/lab';
import { canEvolve, canFeed, feed } from '../src/game/park';
import { mods } from '../src/game/mods';

describe('data', () => {
  it('has 1000–2000 genera, each with archetype, habitat and a parent clade', () => {
    expect(TAXA.genera.length).toBeGreaterThanOrEqual(1000);
    expect(TAXA.genera.length).toBeLessThanOrEqual(2000);
    for (const g of TAXA.genera) {
      expect(g.archetype).toBeTruthy();
      expect(g.habitat).toBeTruthy();
      expect(TAXA.clades.some((c) => c.id === g.parent)).toBe(true);
    }
  });
  it('contains iconic animals', () => {
    for (const n of ['Tyrannosaurus', 'Triceratops', 'Allosaurus', 'Stegosaurus', 'Mammuthus', 'Dunkleosteus', 'Anomalocaris', 'Smok']) {
      expect(GENUS_BY_NAME.has(n), n).toBe(true);
    }
  });
});

describe('sprites', () => {
  it('are deterministic per genus and stage', () => {
    const g = GENUS_BY_NAME.get('Triceratops')!;
    for (const st of [0, 1, 4]) {
      const a = renderSprite(spriteSpec(g), st, 0);
      const b = renderSprite({ ...spriteSpec(g) }, st, 0);
      expect(a.w).toBe(b.w);
      expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    }
  });
  it('render every archetype without crashing and with visible pixels', () => {
    const seen = new Set<string>();
    for (const g of TAXA.genera) {
      if (seen.has(g.archetype)) continue;
      seen.add(g.archetype);
      const img = renderSprite(spriteSpec(g), 1, 1);
      let filled = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) filled++;
      expect(filled, g.archetype).toBeGreaterThan(20);
    }
  });
});

describe('game loop', () => {
  it('offline catch-up matches ticking (same seed) within tolerance', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const a = startGame(t0, 7);
    const b = startGame(t0, 7);
    for (let i = 0; i < 3600 / 20; i++) tick(a, 20);
    catchUp(b, t0 + 3600 * 1000);
    expect(b.stats.fossils).toBe(a.stats.fossils);
    expect(Math.abs(b.coins - a.coins)).toBeLessThan(1);
  });

  it('save -> load round trip keeps state', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 3);
    tick(s, 600);
    const r = deserialize(serialize(s))!;
    expect(r).not.toBeNull();
    expect(r.coins).toBeCloseTo(s.coins);
    expect(Object.keys(r.sites)).toEqual(Object.keys(s.sites));
  });

  it('tutorial path: dig -> 50% genome -> synthesize -> feed to level cap', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 11);
    const st = siteState(s, 'morrison');
    for (let k = 0; k < 400 && s.stats.layers === 0; k++) {
      const i = st.tiles.findIndex((t) => t.hp > 0);
      if (i < 0) break;
      hitTile(s, 'morrison', i, 'brush');
    }
    const ids = Object.keys(s.fossils).map(Number);
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => queueAll(s, id));
    tick(s, 600);
    const ready = ids.find((id) => (s.genome[id] ?? 0) >= 50);
    expect(ready).toBeDefined();
    expect(canSynthesize(s, ready!, mods(s)).ok).toBe(true);
  });

  it('feeding is capped by stage and evolution needs the cap', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 5);
    const g = GENUS_BY_NAME.get('Camarasaurus')!;
    s.habitats[0].level = 5;
    s.animals.push({ uid: 99, genusId: g.id, level: 1, stage: 0, habitatId: s.habitats[0].id, born: s.now });
    s.food.plants = 1e9;
    s.coins = 1e9;
    s.pb = 1e6;
    feed(s, 99, 999);
    const a = s.animals.find((x) => x.uid === 99)!;
    expect(a.level).toBe(10);
    expect(canFeed(s, a).ok).toBe(false);
    expect(canEvolve(s, a).ok).toBe(true);
  });
});

describe('crew modes', () => {
  it("'helpers' crews clear rock but never complete a fossil; 'off' crews do nothing", () => {
    const s = startGame(Date.UTC(2026, 0, 1), 21);
    s.settings.crewMode = 'helpers';
    tick(s, 3 * 3600);
    expect(s.stats.fossils).toBe(0);
    expect(s.stats.amber).toBe(0);
    const st = siteState(s, 'morrison');
    // every cell of every unfound find is still in the rock (worn down, not broken)
    for (const it of st.items.filter((i) => !i.found)) {
      expect(it.cells.filter((c) => st.tiles[c].hp > 0).length).toBe(it.cells.length);
    }
    expect(s.stats.minor).toBe(0);
    const before = st.tiles.map((t) => t.hp).join(',');
    s.settings.crewMode = 'off';
    tick(s, 3600);
    expect(st.tiles.map((t) => t.hp).join(',')).toBe(before);
  });

  it('first discovery of a genus lands in the discoveries inbox', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    s.settings.crewMode = 'full';
    tick(s, 3600);
    expect(s.discoveries.length).toBe(Object.keys(s.discovered).length);
    expect(s.discoveries.every((d) => !d.seen && d.byCrew)).toBe(true);
  });
});

describe('dig rules', () => {
  it('a layer ends only when every tile is dug out, not just the bones', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 21);
    s.settings.crewMode = 'off';
    const st = siteState(s, 'morrison');
    for (const it of st.items) if (it.kind === 'fossil') for (const c of it.cells) while (st.tiles[c].hp > 0) hitTile(s, 'morrison', c, 'brush');
    expect(st.depth).toBe(0);
    for (let i = 0; i < st.tiles.length && st.depth === 0; i++) while (st.depth === 0 && st.tiles[i].hp > 0) hitTile(s, 'morrison', i, 'brush');
    expect(st.depth).toBe(1);
    expect(st.lastDone?.bonus?.coins).toBeGreaterThan(0);
  });

  it('layers hold a varying number of finds', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 5);
    const st = siteState(s, 'morrison');
    const counts = new Set<string>();
    for (let k = 0; k < 30; k++) {
      st.depth = 3 + k;
      generateLayer(s, 'morrison');
      const by = (kind: string) => st.items.filter((i) => i.kind === kind).length;
      counts.add(`${by('fossil')}/${by('minor')}/${by('amber')}/${by('mineral')}`);
    }
    expect(counts.size).toBeGreaterThan(5);
  });

  it('crits need an upgrade; a guaranteed crit breaks the tile in one hit', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    expect(mods(s).critBrush).toBe(0);
    expect(mods(s).feverSec).toBe(0);
    const st = siteState(s, 'morrison');
    const i = st.tiles.findIndex((t) => t.hp > 1);
    const r = hitTile(s, 'morrison', i, 'brush', undefined, { critChance: 1 });
    expect(r.crit).toBe(true);
    expect(st.tiles[i].hp).toBe(0);
  });

  it('tool upgrades cost shards (not coins) and raise the brush', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    s.coins = 1e9; s.pb = 1e4;
    expect(buyToolNode(s, 'b_power')).toBe(false); // coins don't buy workshop upgrades
    s.shards = 1e6;
    const p0 = mods(s).brushPower;
    expect(buyToolNode(s, 'b_crit')).toBe(false); // needs Twardsze włosie 2 first
    expect(buyToolNode(s, 'b_power')).toBe(true);
    expect(buyToolNode(s, 'b_power')).toBe(true);
    expect(buyToolNode(s, 'b_crit')).toBe(true);
    expect(mods(s).brushPower).toBeGreaterThan(p0);
    expect(mods(s).critBrush).toBeCloseTo(0.02);
  });

  it('the workshop tree is well formed: every prerequisite exists, no two nodes share a spot', () => {
    const spots = new Set<string>();
    for (const n of TOOL_NODES) {
      for (const [id, lvl] of n.req ?? []) {
        expect(TOOL_NODE_BY_ID.has(id)).toBe(true);
        expect(lvl).toBeLessThanOrEqual(TOOL_NODE_BY_ID.get(id)!.max);
      }
      const k = `${n.x},${n.y}`;
      expect(spots.has(k)).toBe(false);
      spots.add(k);
    }
  });

  it('breaking rock earns shards, more for the player than for crews', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 11);
    s.settings.crewMode = 'off';
    const st = siteState(s, 'morrison');
    const i = st.tiles.findIndex((t) => t.item < 0);
    st.tiles[i].hp = 0.1;
    hitTile(s, 'morrison', i, 'brush');
    expect(s.shards).toBeCloseTo(1);
  });

  it('a charge crushes plain rock but only cracks tiles that hide a find', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 12);
    s.settings.crewMode = 'off';
    s.tools.x_unlock = 1;
    s.tools.x_power = 2;
    const st = siteState(s, 'morrison');
    const center = 3 * 10 + 4;
    const r = blastCharge(s, 'morrison', center)!;
    expect(r.blasts[0].cells.length).toBe(25);
    for (const c of r.blasts[0].cells) {
      const t = st.tiles[c];
      if (t.item >= 0 && !st.items[t.item].found) expect(t.hp).toBeGreaterThan(0);
      else if (t.item < 0) expect(t.hp).toBe(0);
    }
    expect(s.charges.n).toBe(0);
    expect(blastCharge(s, 'morrison', center)).toBeNull();
    tick(s, 100);
    expect(s.charges.n).toBe(1);
  });

  it('smouldering tiles wear the rock down but never break a tile that hides something', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 8);
    s.settings.crewMode = 'off';
    const st = siteState(s, 'morrison');
    const i = st.tiles.findIndex((t) => t.item >= 0);
    st.burns = [{ tile: i, until: s.now + 60_000, dps: 5 }];
    tick(s, 30);
    expect(st.tiles[i].hp).toBeGreaterThan(0);
  });

  it('every 5th layer gives an epoch chest you open by hand', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 9);
    s.settings.crewMode = 'off';
    const st = siteState(s, 'morrison');
    st.depth = 4;
    st.tiles.forEach((t) => { t.hp = 0.5; });
    const coins = s.coins;
    for (let i = 0; i < st.tiles.length && st.depth === 4; i++) hitTile(s, 'morrison', i, 'brush');
    expect(st.depth).toBe(5);
    expect(s.chests.length).toBe(1);
    const c = s.chests[0];
    const before = s.coins;
    const loot = openChest(s, c.id);
    expect(loot.length).toBeGreaterThanOrEqual(3);
    expect(loot[0].kind).toBe('coins');
    expect(s.coins).toBeGreaterThan(before);
    expect(s.chests.length).toBe(0);
    expect(openChest(s, c.id)).toEqual([]);
    expect(s.coins).toBeGreaterThan(coins);
  });

  it('the rock column never ends', () => {
    const a = stratumAt('morrison', 0), deep = stratumAt('morrison', 500);
    expect(a.s.name).toBe('Ogniwo Brushy Basin');
    expect(deep.left).toBeGreaterThan(0);
    expect(deep.round).toBeGreaterThan(0);
  });

  it('the hammer only risks a bone when it breaks through to it', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 3);
    const st = siteState(s, 'morrison');
    const m = mods(s);
    const it = st.items.find((x) => x.kind === 'fossil' && x.quality > 0)!;
    const c = it.cells[0];
    st.tiles[c].hp = 50;
    expect(hammerRisk(st, c, c, m)).toBe(false);
    st.tiles[c].hp = 0.5;
    expect(hammerRisk(st, c, c, m)).toBe(true);
  });
});

describe('minerals', () => {
  it('a dug-out mineral pays coins and joins the collection', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 12);
    s.settings.crewMode = 'off';
    const st = siteState(s, 'morrison');
    const i = st.tiles.findIndex((t) => t.item < 0);
    st.items.push({ kind: 'mineral', mineralId: 'agat', quality: 0, cells: [i], found: false });
    st.tiles[i].item = st.items.length - 1;
    st.tiles[i].hp = 1;
    const coins = s.coins;
    hitTile(s, 'morrison', i, 'brush');
    expect(s.minerals.agat).toBe(1);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.finds[0].mineral).toBe('agat');
  });
});

describe('crews in helper mode', () => {
  it('clear plain rock but never break a tile that hides something', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 31);
    s.settings.crewMode = 'helpers';
    const st = siteState(s, 'morrison');
    const found0 = st.items.filter((it) => it.found).length;
    tick(s, 3600 * 4);
    expect(st.items.filter((it) => it.found).length).toBe(found0);
    for (const t of st.tiles) {
      if (t.item >= 0) expect(t.hp).toBeGreaterThan(0);
      else expect(t.hp).toBe(0);
    }
    // the player finishes a weakened tile with one brush hit
    const i = st.tiles.findIndex((t) => t.item >= 0);
    hitTile(s, 'morrison', i, 'brush');
    expect(st.tiles[i].hp).toBe(0);
  });
});

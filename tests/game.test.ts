import { describe, expect, it } from 'vitest';
import { GENUS_BY_NAME, TAXA, spriteSpec } from '../src/data/db';
import { renderSprite } from '../src/sprites/generator';
import { catchUp, deserialize, serialize, startGame, tick } from '../src/game/engine';
import { blastCharge, generateLayer, hammerRisk, hitTile, openChest, siteState } from '../src/game/dig';
import { STRATA, mineralWeights, siteMinerals, stratumAt } from '../src/game/geology';
import { SITES } from '../src/data/db';
import { SITE_UNLOCK } from '../src/game/content';
import { TOOL_NODES, TOOL_NODE_BY_ID, buyToolNode } from '../src/game/tools';
import { canSynthesize, queueAll } from '../src/game/lab';
import { canEvolve, canFeed, feed } from '../src/game/park';
import { mods } from '../src/game/mods';
import {
  animalsIn, autoPlace, buildable, canClear, canPlace, canPut, canUpgrade, collect, connected, defOf, enclosureRate, enclosures, findSpot,
  islandCache, maxPens, objectsOn, penSlots, place, putAnimal, rectOf, setPaths, transporter, upgradeObject,
} from '../src/game/parkmap';
import { terrain } from '../src/game/islands';
import { synthesize } from '../src/game/lab';
import type { GameState } from '../src/game/state';

/** an animal of a genus straight into the park (Transporter) */
function addAnimal(s: GameState, name: string): number {
  const uid = s.nextUid++;
  s.animals.push({ uid, genusId: GENUS_BY_NAME.get(name)!.id, level: 1, stage: 0, enc: 0, pen: 0, born: s.now });
  return uid;
}

describe('park 2.0: map', () => {
  it('a new game starts on Island 1 with a gate, stations, farms and an enclosure, all reachable and not overlapping', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 1);
    expect(Object.keys(s.park.islands)).toEqual(['1']);
    const objs = objectsOn(s, 1);
    for (const id of ['gate', 'st_expedition', 'st_prep', 'st_sequencer', 'st_hatchery', 'enc_land', 'farm_meat', 'farm_plants']) {
      expect(objs.some((o) => o.def === id), id).toBe(true);
    }
    const seen = new Set<number>();
    const t = terrain(1);
    for (const o of objs) {
      const r = rectOf(o);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        expect(buildable(s, 1, x, y), `${o.def} @${x},${y}`).toBe(true);
        expect(seen.has(y * t.w + x), `overlap ${o.def}`).toBe(false);
        seen.add(y * t.w + x);
      }
    }
    expect(connected(s, enclosures(s)[0])).toBe(true);
  });

  it('placing checks water, wild land, overlaps, paths, unique stations and money', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 1);
    s.coins = 1e9;
    expect(canPlace(s, 'd_fern', 1, 0, 0, 0).why).toMatch(/wodzie|poza/);
    const t = terrain(1);
    const wild = [...t.landChunks].find((c) => !islandCache(s, 1).cleared.has(c))!;
    const wx = (wild % t.cw) * 4, wy = Math.floor(wild / t.cw) * 4;
    const wt = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 3]].map(([dx, dy]) => [wx + dx, wy + dy]).find(([x, y]) => t.tiles[y * t.w + x] >= 2)!;
    expect(canPlace(s, 'd_fern', 1, wt[0], wt[1], 0).why).toMatch(/oczyszczony/);
    const enc = enclosures(s)[0];
    expect(canPlace(s, 'd_fern', 1, enc.x, enc.y, 0).why).toMatch(/Zajęte/);
    const p = s.park.paths[1][0];
    expect(canPlace(s, 'd_fern', 1, p % t.w, Math.floor(p / t.w), 0).why).toMatch(/ścieżka/);
    expect(canPlace(s, 'st_prep', 1, 1, 1, 0).why).toMatch(/już stoi/);
    const spot = findSpot(s, 1, 'v_kiosk')!;
    s.coins = 0;
    expect(canPlace(s, 'v_kiosk', 1, spot.x, spot.y, spot.rot).why).toMatch(/monet/);
    s.coins = 1000;
    expect(place(s, 'v_kiosk', 1, spot.x, spot.y, spot.rot)).not.toBeNull();
    expect(s.coins).toBe(750);
  });

  it('an enclosure earns only when a path connects it to the gate', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 2);
    const enc = enclosures(s)[0];
    const uid = addAnimal(s, 'Camarasaurus');
    expect(putAnimal(s, uid, enc.id, 0)).toBe(true);
    expect(enclosureRate(s, enc)).toBeGreaterThan(0);
    // take away every path tile around it
    const t = terrain(1);
    const r = rectOf(enc);
    const around: [number, number][] = [];
    for (let x = r.x - 1; x <= r.x + r.w; x++) around.push([x, r.y - 1], [x, r.y + r.h]);
    for (let y = r.y; y < r.y + r.h; y++) around.push([r.x - 1, y], [r.x + r.w, y]);
    setPaths(s, 1, around.filter(([x, y]) => x >= 0 && y >= 0 && x < t.w && y < t.h), false);
    expect(connected(s, enc)).toBe(false);
    expect(enclosureRate(s, enc)).toBe(0);
  });

  it('pens: habitat, space and the carnivore rule', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 3);
    const enc = enclosures(s)[0];
    const a = addAnimal(s, 'Camarasaurus'), b = addAnimal(s, 'Stegosaurus'), c = addAnimal(s, 'Allosaurus'), d = addAnimal(s, 'Allosaurus');
    const fish = addAnimal(s, 'Dunkleosteus');
    expect(canPut(s, fish, enc.id, 0).why).toMatch(/nie pasuje/);
    expect(putAnimal(s, a, enc.id, 0)).toBe(true);
    // level 1: 4 slots per pen, an XL sauropod fills it
    expect(canPut(s, b, enc.id, 0).why).toMatch(/Brak miejsca/);
    enc.level = 5; // 10 slots per pen
    expect(putAnimal(s, b, enc.id, 0)).toBe(true); // two herbivores mix
    expect(putAnimal(s, c, enc.id, 1)).toBe(true);
    expect(canPut(s, b, enc.id, 1).why).toMatch(/mięsożerca/);
    expect(canPut(s, c, enc.id, 0).why).toMatch(/mięsożerca/);
    expect(putAnimal(s, d, enc.id, 1)).toBe(true); // own genus is fine
    expect(animalsIn(s, enc.id, 1).length).toBe(2);
  });

  it('a newborn goes to the best pen, or waits in the Transporter — synthesis is never blocked by space', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    s.coins = 1e9;
    const g = GENUS_BY_NAME.get('Dunkleosteus')!; // marine: no lagoon yet
    s.genome[g.id] = 100;
    s.hatched[GENUS_BY_NAME.get('Allosaurus')!.id] = 1; // not the first animal → chance = genome
    expect(synthesize(s, g.id)).toBe(true);
    tick(s, 10000);
    expect(transporter(s).some((a) => a.genusId === g.id)).toBe(true);
    const uid = addAnimal(s, 'Camarasaurus');
    expect(autoPlace(s, uid)).toBe(true);
  });

  it('storage fills up to its cap and is collected by a click; farms give food', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 5);
    const enc = enclosures(s)[0];
    putAnimal(s, addAnimal(s, 'Camarasaurus'), enc.id, 0);
    tick(s, 3 * 3600);
    expect(enc.store).toBeGreaterThan(0);
    const before = s.coins;
    const got = collect(s, enc.id)!;
    expect(got.coins).toBeGreaterThan(0);
    expect(s.coins - before).toBe(got.coins);
    const farm = s.park.objects.find((o) => o.def === 'farm_meat')!;
    const meat = s.food.meat;
    expect(collect(s, farm.id)!.food!.meat).toBeGreaterThan(0);
    expect(s.food.meat).toBeGreaterThan(meat);
  });

  it('upgrading an enclosure makes it physically bigger and keeps its animals', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 6);
    s.coins = 1e9;
    const enc = enclosures(s)[0];
    const uid = addAnimal(s, 'Camarasaurus');
    putAnimal(s, uid, enc.id, 0);
    const before = rectOf(enc);
    const c = canUpgrade(s, enc.id);
    if (c.ok) {
      expect(upgradeObject(s, enc.id)).toBe(true);
      const after = rectOf(enc);
      expect(after.w * after.h).toBeGreaterThan(before.w * before.h);
      expect(animalsIn(s, enc.id).map((a) => a.uid)).toEqual([uid]);
    } else expect(c.why).toMatch(/miejsca/);
  });

  it('park research gives bigger pens, more pens and enclosure levels 6–7', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 9);
    const enc = enclosures(s)[0];
    expect(penSlots(s, enc)).toBe(4);
    expect(maxPens(s, enc)).toBe(2);
    s.tech.park8 = 1; s.tech.park9 = 1;
    expect(penSlots(s, enc)).toBe(6);
    expect(maxPens(s, enc)).toBe(4);
    enc.level = 5;
    s.coins = 1e12;
    expect(canUpgrade(s, enc.id).why).toMatch(/Badaniach/);
    s.tech.park10 = 1; s.tech.park11 = 1;
    expect(canUpgrade(s, enc.id).why ?? '').not.toMatch(/Badaniach/);
  });

  it('wild land is cleared chunk by chunk from the edge of the free area', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 7);
    s.coins = 1e9;
    const t = terrain(1);
    const wild = [...t.landChunks].filter((c) => !islandCache(s, 1).cleared.has(c));
    expect(wild.length).toBeGreaterThan(0);
    expect(wild.some((c) => canClear(s, 1, c).ok)).toBe(true);
    expect(wild.some((c) => canClear(s, 1, c).why?.startsWith('Oczyszczaj'))).toBe(true);
  });

  it('old saves (habitats, plots, till) move onto Island 1', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 8);
    const old = JSON.parse(serialize(s));
    const camara = GENUS_BY_NAME.get('Camarasaurus')!.id, allo = GENUS_BY_NAME.get('Allosaurus')!.id;
    delete old.park;
    old.v = 1;
    old.habitats = [{ id: 1, type: 'land', level: 4 }, { id: 2, type: 'land', level: 1 }];
    old.plots = 8;
    old.bank = 500;
    old.buildings.ranch = 3; old.buildings.greenhouse = 2; old.buildings.aquaculture = 0;
    old.animals = [
      { uid: 1, genusId: camara, level: 5, stage: 1, habitatId: 1, born: 0 },
      { uid: 2, genusId: camara, level: 3, stage: 0, habitatId: 1, born: 0 },
      { uid: 3, genusId: allo, level: 3, stage: 0, habitatId: 2, born: 0 },
    ];
    const coins = old.coins;
    const r = deserialize(JSON.stringify(old))!;
    expect(r.v).toBe(2);
    expect(r.coins).toBe(coins + 500 + 1000 + 1450);
    expect(enclosures(r).length).toBe(2);
    expect(r.animals.every((a) => a.enc > 0)).toBe(true);
    expect(r.park.objects.find((o) => o.def === 'farm_meat')!.level).toBe(3);
    expect((r as unknown as Record<string, unknown>).habitats).toBeUndefined();
    expect('ranch' in r.buildings).toBe(false);
    for (const o of r.park.objects) expect(defOf(o)).toBeTruthy();
  });
});

describe('data', () => {
  it('has 2000–3000 genera, each with archetype, habitat and a parent clade', () => {
    expect(TAXA.genera.length).toBeGreaterThanOrEqual(2000);
    expect(TAXA.genera.length).toBeLessThanOrEqual(3000);
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
    s.animals.push({ uid: 99, genusId: g.id, level: 1, stage: 0, enc: enclosures(s)[0].id, pen: 0, born: s.now });
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

  it('every site has rocks, an unlock and its own ~20 minerals that open up with depth', () => {
    const seen = new Set<string>();
    for (const site of SITES) {
      expect(STRATA[site.id]?.length, site.id).toBeGreaterThan(0);
      expect(SITE_UNLOCK[site.id], site.id).toBeTruthy();
      const own = siteMinerals(site.id);
      expect(own.length, site.id).toBeGreaterThanOrEqual(15);
      for (const m of own) { expect(seen.has(m.id)).toBe(false); seen.add(m.id); }
      const shallow = mineralWeights(site.id, 0).filter(([m]) => m.site === site.id).length;
      const deep = mineralWeights(site.id, 200).filter(([m]) => m.site === site.id).length;
      expect(shallow).toBeLessThan(deep);
      expect(deep).toBe(own.length);
    }
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

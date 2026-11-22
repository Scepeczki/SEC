import { describe, expect, it } from 'vitest';
import { GENUS_BY_NAME, TAXA, spriteSpec } from '../src/data/db';
import { renderSprite } from '../src/sprites/generator';
import { catchUp, deserialize, serialize, startGame, tick } from '../src/game/engine';
import { faunaWeight, generateLayer, hitTile, openChest, previewChain, siteState, useTool } from '../src/game/dig';
import { STRATA, mineralWeights, siteMinerals, stratumAt } from '../src/game/geology';
import { SITES } from '../src/data/db';
import { SITE_UNLOCK, START_SITE } from '../src/game/content';
import { TOOL_NODES, TOOL_NODE_BY_ID, buyToolNode } from '../src/game/tools';
import { canSynthesize, queueAll } from '../src/game/lab';
import { canEvolve, canFeed, feed } from '../src/game/park';
import { mods } from '../src/game/mods';
import {
  animalsIn, autoBuild, autoPlace, buildable, canClear, canPlace, canPut, canUpgrade, collect, connected, defOf, enclosureRate, enclosures, findSpot,
  islandCache, lacksPath, maxPens, objById, objectsOn, penSlots, place, putAnimal, rectOf, setPaths, transporter, upgradeObject,
} from '../src/game/parkmap';
import { terrain } from '../src/game/islands';
import { synthesize } from '../src/game/lab';
import type { GameState } from '../src/game/state';

const S = START_SITE;

/** the start park is a lagoon: tests with land animals build a land enclosure first */
const landEnc = (s: GameState) => autoBuild(s, 1, 'enc_land', 1, { grow: true })!;

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
    for (const id of ['gate', 'st_expedition', 'st_prep', 'st_sequencer', 'st_hatchery', 'enc_marine', 'farm_meat', 'farm_aqua']) {
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
    const enc = landEnc(s);
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
    const enc = landEnc(s);
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
    const g = GENUS_BY_NAME.get('Camarasaurus')!; // land: no land enclosure yet
    s.genome[g.id] = 100;
    s.hatched[GENUS_BY_NAME.get('Allosaurus')!.id] = 1; // not the first animal → chance = genome
    expect(synthesize(s, g.id)).toBe(true);
    tick(s, 10000);
    expect(transporter(s).some((a) => a.genusId === g.id)).toBe(true);
    const uid = addAnimal(s, 'Dunkleosteus'); // the start lagoon has room
    expect(autoPlace(s, uid)).toBe(true);
  });

  it('storage fills up to its cap and is collected by a click; farms give food', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 5);
    const enc = landEnc(s);
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

  it('upgrading an enclosure adds room inside but never land, and keeps its animals', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 6);
    s.coins = 1e9;
    const enc = landEnc(s);
    const uid = addAnimal(s, 'Camarasaurus');
    putAnimal(s, uid, enc.id, 0);
    const before = rectOf(enc), slots = penSlots(s, enc);
    for (let k = 0; k < 4; k++) expect(upgradeObject(s, enc.id)).toBe(true);
    expect(rectOf(enc)).toEqual(before);
    expect(penSlots(s, enc)).toBeGreaterThan(slots);
    expect(maxPens(s, enc)).toBe(8);
    expect(animalsIn(s, enc.id).map((a) => a.uid)).toEqual([uid]);
  });

  it('0.3.0 saves keep their clear land; enclosures get the fixed footprint and keep their paths', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 12);
    s.coins = 1e9;
    const enc = enclosures(s)[0];
    const old = JSON.parse(serialize(s));
    old.v = 2;
    delete old.park.islands[1].start;
    // pretend it was a level-5 enclosure of 12×10 in 0.3.0, anchored 2 left and 1 up
    const o = old.park.objects.find((x: { id: number }) => x.id === enc.id);
    o.level = 5; o.x -= 2; o.y -= 1;
    const r = deserialize(JSON.stringify(old))!;
    expect(r.v).toBe(5);
    expect(r.park.islands[1].start).toBe(0.6);
    expect(islandCache(r, 1).cleared.size).toBeGreaterThan(islandCache(s, 1).cleared.size);
    const e = objById(r, enc.id)!;
    expect(rectOf(e).w).toBe(8);
    expect(rectOf(e).h).toBe(8);
    expect(e.x).toBeGreaterThanOrEqual(o.x);
    expect(e.x + 8).toBeLessThanOrEqual(o.x + 12);
    expect(lacksPath(r, e)).toBe(false);
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
    expect(r.v).toBe(5);
    expect(r.coins).toBe(coins + 500 + 1000 + 1450);
    expect(enclosures(r).filter((o) => defOf(o).habitat === 'land').length).toBe(2);
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
    const st = siteState(s, S);
    for (let k = 0; k < 400 && s.stats.layers === 0; k++) {
      const i = st.tiles.findIndex((t) => t.hp > 0);
      if (i < 0) break;
      hitTile(s, S, i);
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
  it("'helpers' crews clear rock but never complete a find; 'off' crews do nothing", () => {
    const s = startGame(Date.UTC(2026, 0, 1), 21);
    s.settings.crewMode = 'helpers';
    tick(s, 3 * 3600);
    expect(s.stats.fossils).toBe(0);
    expect(s.stats.amber).toBe(0);
    const st = siteState(s, S);
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

/** a fresh layer with no finds and no modifiers, every tile one stroke from breaking */
function blankLayer(seed = 3) {
  const s = startGame(Date.UTC(2026, 0, 1), seed);
  s.settings.crewMode = 'off';
  const st = siteState(s, S);
  st.items = [];
  st.tiles.forEach((t) => { t.item = -1; t.hp = 0.5; t.max = 3; delete t.mod; delete t.dir; delete t.link; });
  return { s, st, w: st.w ?? 10 };
}

describe('dig rules', () => {
  it('a layer ends only when every tile is dug out, not just the bones', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 21);
    s.settings.crewMode = 'off';
    const st = siteState(s, S);
    for (const it of st.items) if (it.kind === 'fossil') for (const c of it.cells) while (st.tiles[c].hp > 0) hitTile(s, S, c);
    expect(st.depth).toBe(0);
    for (let i = 0; i < st.tiles.length && st.depth === 0; i++) while (st.depth === 0 && st.tiles[i].hp > 0) hitTile(s, S, i);
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

  it('crits need an upgrade; a crit breaks the tile in one stroke', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    expect(mods(s).critBrush).toBe(0);
    const st = siteState(s, S);
    const i = st.tiles.findIndex((t) => t.hp > 1 && t.item < 0);
    const r = hitTile(s, S, i, { ...mods(s), critBrush: 1 });
    expect(r.crit).toBe(true);
    expect(st.tiles[i].hp).toBe(0);
  });

  it('workshop upgrades cost shards (not coins) and raise the brush', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 4);
    s.coins = 1e9; s.pb = 1e4;
    expect(buyToolNode(s, 'm_power')).toBe(false); // coins don't buy workshop upgrades
    s.shards = 1e6;
    const p0 = mods(s).brushPower;
    expect(buyToolNode(s, 'm_crit')).toBe(false); // needs Twardsze włosie 2 first
    expect(buyToolNode(s, 'm_power')).toBe(true);
    expect(buyToolNode(s, 'm_power')).toBe(true);
    expect(buyToolNode(s, 'm_crit')).toBe(true);
    expect(mods(s).brushPower).toBeGreaterThan(p0);
    expect(mods(s).critBrush).toBeCloseTo(0.03);
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

  it('breaking a single tile earns shards', () => {
    const { s, st } = blankLayer(11);
    hitTile(s, S, 0);
    expect(st.tiles[0].hp).toBe(0);
    expect(s.shards).toBeCloseTo(1.5 * 0.7); // the first layer of an epoch is a lean one
  });

  it('every 5th layer gives an epoch chest you open by hand', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 9);
    s.settings.crewMode = 'off';
    const st = siteState(s, S);
    st.depth = 4;
    st.tiles.forEach((t) => { t.hp = 0.5; });
    const coins = s.coins;
    for (let i = 0; i < st.tiles.length && st.depth === 4; i++) hitTile(s, S, i);
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

  it('a species with a complete genome turns up much less often', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 3);
    const m = mods(s);
    const g = SITES.find((x) => x.id === S)!.fauna[0];
    const w0 = faunaWeight(s, g.genusId, g.occ, 0, m);
    s.genome[g.genusId] = 100;
    expect(faunaWeight(s, g.genusId, g.occ, 0, m) / w0).toBeCloseTo(0.15);
  });
});

describe('chain reactions', () => {
  it('an arrow breaks the tiles it points at and passes the chain on to the next modifier', () => {
    const { s, st, w } = blankLayer();
    s.tools.g_arrow = 1;
    st.tiles[w + 1].mod = 'arrow'; st.tiles[w + 1].dir = 0; // (1,1) → right
    st.tiles[w + 3].mod = 'bomb'; // (3,1) is in reach: blows up 3×3 around it
    const r = hitTile(s, S, w + 1);
    const broken = new Set(r.steps.map((x) => x.idx));
    expect(broken.has(w + 2)).toBe(true);
    expect(broken.has(w + 3)).toBe(true);
    for (const c of [2, 3, 4, w + 4, 2 * w + 2, 2 * w + 3, 2 * w + 4]) expect(broken.has(c), String(c)).toBe(true);
    expect(r.steps.find((x) => x.idx === w + 4)!.gen).toBe(2);
    expect(r.combo!.n).toBe(r.steps.length);
  });

  it('a keystone takes its whole column only when it is the last rock in its row', () => {
    const { s, st, w } = blankLayer();
    const h = st.h ?? 7;
    st.tiles[3].mod = 'key';
    const early = previewChain(st, [3], mods(s));
    expect(early.length).toBe(1);
    for (let x = 0; x < w; x++) if (x !== 3) st.tiles[x].hp = 0;
    const r = hitTile(s, S, 3);
    expect(r.steps.length).toBe(h);
  });

  it('a vein breaks every rock touching the empty space it opens onto', () => {
    const { s, st, w } = blankLayer();
    // an empty corridor along row 0, the vein right under its middle
    for (let x = 0; x < 6; x++) st.tiles[x].hp = 0;
    st.tiles[w + 2].mod = 'vein';
    const r = hitTile(s, S, w + 2);
    const broken = new Set(r.steps.map((x) => x.idx));
    for (let x = 0; x < 6; x++) expect(broken.has(w + x), `below ${x}`).toBe(true);
    expect(broken.has(6)).toBe(true); // the rock at the end of the corridor
  });

  it('the preview shows exactly what the break will set off', () => {
    const { s, st, w } = blankLayer(17);
    st.tiles[0].mod = 'arrow'; st.tiles[0].dir = 1;
    st.tiles[2 * w].mod = 'echo';
    st.tiles[5 * w + 7].mod = 'bomb';
    const m = mods(s);
    const p = previewChain(st, [0], m).map((x) => x.idx).sort((a, b) => a - b);
    const r = hitTile(s, S, 0).steps.map((x) => x.idx).sort((a, b) => a - b);
    expect(r).toEqual(p);
    expect(r).toContain(5 * w + 7); // resonance reached the far-away bomb
  });

  it('flint stops a chain, but a blast cracks it', () => {
    const { s, st, w } = blankLayer();
    st.tiles[0].mod = 'arrow'; st.tiles[0].dir = 0;
    st.tiles[1].flint = true;
    const p = previewChain(st, [0], mods(s)).map((x) => x.idx);
    expect(p).not.toContain(1);
    expect(p).toContain(2); // the arrow flies on past it
    st.tiles[w + 5].mod = 'bomb'; st.tiles[5].flint = true;
    expect(previewChain(st, [w + 5], mods(s)).map((x) => x.idx)).toContain(5);
  });

  it('own modifiers: a link carries the chain across the layer; uses run out', () => {
    const { s, st, w } = blankLayer();
    st.uses = { link: 1 };
    expect(useTool(s, S, 'link', 0, 5 * w + 9)).toBe(true);
    expect(useTool(s, S, 'link', 1, 2)).toBe(false); // no uses left
    const r = hitTile(s, S, 0);
    expect(r.steps.map((x) => x.idx)).toContain(5 * w + 9);
  });

  it('own modifiers: plant a charge, rotate, move and copy', () => {
    const { s, st, w } = blankLayer();
    st.uses = { bomb: 1, rotate: 1, move: 1, copy: 1 };
    expect(useTool(s, S, 'bomb', w + 1)).toBe(true);
    expect(st.tiles[w + 1].mod).toBe('bomb');
    st.tiles[0].mod = 'arrow'; st.tiles[0].dir = 0;
    expect(useTool(s, S, 'rotate', 0)).toBe(true);
    expect(st.tiles[0].dir).toBe(1);
    expect(useTool(s, S, 'copy', 0, 9)).toBe(true);
    expect(st.tiles[9].mod).toBe('arrow');
    expect(useTool(s, S, 'move', w + 1, 3 * w + 3)).toBe(true);
    expect(st.tiles[w + 1].mod).toBeUndefined();
    expect(st.tiles[3 * w + 3].mod).toBe('bomb');
  });

  it('long chains multiply the shards; „Dwutakt” carries the combo into the next break', () => {
    const { s, st, w } = blankLayer();
    st.tiles[w + 1].mod = 'bomb';
    hitTile(s, S, w + 1); // 9 tiles
    expect(s.shards).toBeGreaterThan(9 * 1.01);
    s.tools.c_carry = 1;
    const m = mods(s);
    st.combo = undefined;
    st.tiles[4 * w + 5].mod = 'bomb';
    const a = hitTile(s, S, 4 * w + 5, m);
    expect(a.combo!.open).toBe(true);
    const b = hitTile(s, S, 6 * w + 9, m);
    expect(b.combo!.n).toBe(a.combo!.n + 1);
    expect(b.combo!.open).toBe(false);
  });

  it('a layer in one manual break gets 3 stars and counts as a record', () => {
    const { s, st } = blankLayer();
    st.tiles.forEach((t) => { t.mod = 'bomb'; }); // one blast sets off the next
    const r = hitTile(s, S, 0);
    expect(r.layerDone).toBe(true);
    expect(st.lastDone!.stars).toBe(3);
    expect(s.digRecords.oneHit).toBe(1);
    expect(s.digRecords.fewest).toBe(1);
  });
});

describe('progression', () => {
  it('sites open oldest first, starting in the Cambrian', () => {
    const order = Object.keys(SITE_UNLOCK);
    expect(order[0]).toBe(START_SITE);
    const ages = order.map((id) => SITES.find((x) => x.id === id)!.fromMa);
    for (let i = 1; i < ages.length; i++) expect(ages[i], order[i]).toBeLessThanOrEqual(ages[i - 1] + 10);
    const s = startGame(Date.UTC(2026, 0, 1), 1);
    expect(s.activeSite).toBe(START_SITE);
    expect(enclosures(s).some((o) => defOf(o).habitat === 'marine')).toBe(true);
  });

  it('0.3 saves: the old tool trees are refunded and the first site is added', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 2);
    const old = s as unknown as Record<string, unknown>;
    s.v = 3;
    s.tools = { b_power: 2, r_res: 1 };
    s.shards = 0;
    delete s.unlockedSites[START_SITE];
    s.unlockedSites.morrison = s.now;
    old.charges = { n: 1, acc: 0 };
    const r = deserialize(serialize(s))!;
    expect(r.tools.b_power).toBeUndefined();
    expect(r.tools.r_res).toBe(1);
    expect(r.shards).toBe(150 + 240);
    expect(r.unlockedSites[START_SITE]).toBeTruthy();
    expect(r.unlockedSites.morrison).toBeTruthy();
  });
});

describe('minerals', () => {
  it('a dug-out mineral pays coins and joins the collection', () => {
    const { s, st } = blankLayer(12);
    st.items.push({ kind: 'mineral', mineralId: 'agat', quality: 0, cells: [4], found: false });
    st.tiles[4].item = st.items.length - 1;
    const coins = s.coins;
    hitTile(s, S, 4);
    expect(s.minerals.agat).toBe(1);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.finds[0].mineral).toBe('agat');
  });
});

describe('crews in helper mode', () => {
  it('clear plain rock but leave finds, modifiers and links to the player', () => {
    const s = startGame(Date.UTC(2026, 0, 1), 31);
    s.settings.crewMode = 'helpers';
    s.unlockedSites[S] = s.now;
    const st = siteState(s, S);
    st.tiles[0].item = -1; st.tiles[0].mod = 'bomb';
    const found0 = st.items.filter((it) => it.found).length;
    tick(s, 3600 * 4);
    expect(st.items.filter((it) => it.found).length).toBe(found0);
    for (const t of st.tiles) {
      if (t.item >= 0 || t.mod) expect(t.hp).toBeGreaterThan(0);
      else expect(t.hp).toBe(0);
    }
  });
});

describe('lore (educational texts)', () => {
  it('covers every genus of the first three sites and every fork on their way', async () => {
    const { GENUS_LORE, CLADE_LORE } = await import('../src/data/lore');
    const { CLADES, GENERA, ancestorIds } = await import('../src/data/db');
    const { TREE_NODES } = await import('../src/data/story/tree');
    const names = new Set(TAXA.clades.map((c) => c.name));
    for (const k of Object.keys(CLADE_LORE)) expect(names.has(k), k).toBe(true);
    for (const k of Object.keys(GENUS_LORE)) expect(GENUS_BY_NAME.has(k), k).toBe(true);
    for (const sid of ['chengjiang', 'burgess', 'fezouata']) {
      // guests of the epoch (batch 2) wait for their texts from the Librarian
      for (const f of SITES.find((x) => x.id === sid)!.fauna.filter((x) => !x.guest)) {
        const g = GENERA.get(f.genusId)!;
        expect(GENUS_LORE[g.name], g.name).toBeTruthy();
        for (const c of ancestorIds(g.parent)) {
          const cl = CLADES.get(c)!;
          if (cl.namePl || cl.leafCount >= 2) expect(CLADE_LORE[cl.name] ?? TREE_NODES.get(cl.name), `${cl.name} (fork above ${g.name})`).toBeTruthy();
        }
      }
    }
  });
});

describe('story mode start', () => {
  it('a new game owns no site until the first one is bought on the map', async () => {
    const { unlockSite } = await import('../src/game/meta');
    const s = startGame(Date.UTC(2026, 0, 1), 3);
    expect(Object.keys(s.unlockedSites)).toHaveLength(0);
    expect(s.story.on).toBe(true);
    expect(unlockSite(s, START_SITE)).toBe(true);
    expect(s.unlockedSites[START_SITE]).toBeTruthy();
    // reloading must not give the site away for free
    const fresh = startGame(Date.UTC(2026, 0, 1), 4);
    const r = deserialize(serialize(fresh))!;
    expect(Object.keys(r.unlockedSites)).toHaveLength(0);
  });
});

describe('story: living tree, rocks, content', () => {
  it('forks light up with the first animal and are announced once', async () => {
    const { chapterTree, flatten, isLit, freshForks } = await import('../src/game/story');
    const s = startGame(Date.UTC(2026, 0, 1), 5);
    const tree = chapterTree('chengjiang');
    const nodes = flatten(tree);
    expect(nodes.length).toBeGreaterThan(10);
    const arth = nodes.find((n) => n.genera.length > 0 && n.depth > 3)!;
    expect(isLit(s, arth.id)).toBe(false);
    expect(freshForks(s)).toHaveLength(0);
    s.discovered[arth.genera[0]] = s.now;
    expect(isLit(s, arth.id)).toBe(true);
    const fresh = freshForks(s);
    expect(fresh).toContain(arth.id);
    for (const f of fresh) s.story.seen[`fork:${f}`] = s.now;
    expect(freshForks(s)).toHaveLength(0);
  });
  it('rocks count once you dig into them', async () => {
    const { siteRocks, rockFound } = await import('../src/game/story');
    const s = startGame(Date.UTC(2026, 0, 1), 6);
    const rocks = siteRocks('chengjiang');
    expect(rocks.length).toBeGreaterThan(1);
    expect(rockFound(s, rocks[0])).toBe(false); // not bought yet
    s.unlockedSites.chengjiang = s.now;
    siteState(s, 'chengjiang');
    expect(rockFound(s, rocks[0])).toBe(true);
    expect(rockFound(s, rocks[1])).toBe(false);
    s.sites.chengjiang.depth = rocks[1].startDepth;
    expect(rockFound(s, rocks[1])).toBe(true);
  });
  it('story content refers only to real animals and clades', async () => {
    const { STORY } = await import('../src/data/story');
    const names = new Set(TAXA.clades.map((c) => c.name));
    for (const k of Object.keys(STORY.forks)) expect(names.has(k), k).toBe(true);
    for (const r of STORY.chapters.chengjiang.biocenosis ?? []) for (const g of r.genera) expect(GENUS_BY_NAME.has(g), g).toBe(true);
    expect(STORY.prologue.length).toBeGreaterThan(5);
    expect(new Set(STORY.concepts.map((c) => c.id)).size).toBe(STORY.concepts.length);
  });
});

describe("the Librarian's tree walk (story/tree)", () => {
  it('every node is a fork of the game tree, every stage has a chapter, spotlights name real genera', async () => {
    const { STAGES, TREE_NODES, CLADE_ID_BY_NAME } = await import('../src/data/story/tree');
    const { SITE_ORDER } = await import('../src/data/epochs');
    expect(STAGES.map((s) => s.nr)).toEqual([1, 2, 3, 4]);
    const { TRUNK, INTERLUDES } = await import('../src/data/story/tree');
    expect(TRUNK[0].id).toBe('LUCA');
    expect(TRUNK[TRUNK.length - 1].id).toBe('Eubilateria');
    for (const it of INTERLUDES) expect(TRUNK.some((n) => n.id === it.after), it.title).toBe(true);
    for (const st of STAGES) {
      expect(SITE_ORDER.includes(st.site), st.id).toBe(true);
      expect(st.intro.length, st.id).toBeGreaterThan(0);
      expect(st.outro.length, st.id).toBeGreaterThan(0);
      for (const sp of st.spotlights) expect(GENUS_BY_NAME.has(sp.genus), sp.genus).toBe(true);
      for (const r of st.route) {
        const name = r.replace(/^spot:/, '');
        expect(r.startsWith('spot:') ? GENUS_BY_NAME.has(name) : TREE_NODES.has(name), r).toBe(true);
      }
    }
    for (const [name, n] of TREE_NODES) {
      if (n.stage > 0 || (n as { inGame?: boolean }).inGame) expect(CLADE_ID_BY_NAME.has(name), name).toBe(true);
      expect(n.scene.length, name).toBeGreaterThan(0);
      expect(n.narrator.teaser && n.narrator.lit, name).toBeTruthy();
    }
  });
});

describe('chapters and guests of the epoch', () => {
  it('a chapter closes when its own animals are found; guests are an extra collection', async () => {
    const { chapterProgress } = await import('../src/game/story');
    const s = startGame(0, 1);
    const site = SITES.find((x) => x.id === 'karoo')!;
    expect(site.fauna.some((f) => f.guest)).toBe(true);
    for (const f of site.fauna) if (!f.guest) s.discovered[f.genusId] = 1;
    const p = chapterProgress(s, 'karoo');
    expect(p.done).toBe(true);
    expect(p.guestsFound).toBeLessThan(p.guests);
  });
  it('the new sites fill the gaps in time and sit in the unlock order by age', async () => {
    const { SITE_ORDER } = await import('../src/data/epochs');
    for (const id of ['cincinnati', 'bertie', 'rhynie', 'east_kirkton', 'joggins', 'red_beds', 'elliot', 'cedar_mountain', 'santa_cruz', 'siwaliki']) {
      const site = SITES.find((x) => x.id === id);
      expect(site, id).toBeTruthy();
      expect(site!.fauna.length, id).toBeGreaterThan(5);
    }
    expect(SITE_ORDER.indexOf('cincinnati')).toBe(3);
    expect(SITE_ORDER.indexOf('siwaliki')).toBe(SITE_ORDER.indexOf('pampas') - 1);
    expect(TAXA.genera.filter((g) => !g.sites.length).length).toBeLessThan(25);
  });
});

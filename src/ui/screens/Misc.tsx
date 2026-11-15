import { useRef, useState } from 'react';
import { TAXA } from '../../data/db';
import { BRANCHES } from '../../data/cladeRules';
import { HABITAT_ICONS, fmt } from '../../game/balance';
import { BUILDINGS, TECH, TECH_CATS, buildingCost, type TechCat } from '../../game/content';
import { SAVE_KEY, deserialize, serialize, startGame } from '../../game/engine';
import { claimContract, rerollContract, rerollCost } from '../../game/meta';
import { buyTech, canBuyTech, canUpgradeBuilding, upgradeBuilding } from '../../game/park';
import { STAGE_NAMES } from '../../sprites/generator';
import { Bar, Btn, Cost, SpriteImg } from '../components';
import { save, useGame, useStore } from '../store';
import { desktop } from '../desktop';

export function ResearchScreen() {
  const s = useGame();
  const act = useStore((x) => x.act);
  return (
    <div className="col">
      <div className="panel"><h2 style={{ margin: 0 }}>🔬 Badania</h2><div className="muted small">Punkty Badań (🔬) zdobywasz z drobnych skamieniałości, ekstrakcji, kontraktów i Centrum Badawczego. Wydajesz je też na badanie gałęzi w Drzewie życia.</div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {(Object.keys(TECH_CATS) as TechCat[]).map((cat) => (
          <div key={cat} className="panel col">
            <h3>{TECH_CATS[cat]}</h3>
            {TECH.filter((t) => t.cat === cat).map((t) => {
              const c = canBuyTech(s, t.id);
              const done = !!s.tech[t.id];
              return (
                <div key={t.id} className="item" style={{ opacity: done ? 0.75 : 1, borderColor: done ? '#7fb069' : undefined }}>
                  <div className="col" style={{ gap: 2, flex: 1 }}>
                    <b>{done ? '✔ ' : ''}{t.name}</b>
                    <span className="small muted">{t.desc}</span>
                  </div>
                  {!done && <Btn small kind="gold" onClick={() => act((g) => buyTech(g, t.id))} disabled={!c.ok} why={c.why}>🔬 {fmt(t.cost)}</Btn>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildingsScreen() {
  const s = useGame();
  const act = useStore((x) => x.act);
  return (
    <div className="col">
      <div className="panel"><h2 style={{ margin: 0 }}>🏗️ Stacje i budynki</h2><div className="muted small">Każdy poziom przyspiesza zdobywanie i hodowlę zwierząt. Koszty rosną wykładniczo — zawsze jest co rozbudowywać.</div></div>
      <div className="grid cards">
        {BUILDINGS.map((b) => {
          const lvl = s.buildings[b.id];
          const c = canUpgradeBuilding(s, b.id);
          return (
            <div key={b.id} className="panel col">
              <div className="row"><span style={{ fontSize: 22 }}>{b.icon}</span><b>{b.name}</b><span className="spacer" /><span className="tag" style={{ color: '#d9a441' }}>poz. {lvl}</span></div>
              <div className="small muted">{b.desc}</div>
              <div className="small">Teraz: {lvl > 0 ? b.effect(lvl) : <span className="muted">nie zbudowano</span>}</div>
              {lvl < b.maxLevel && <div className="small muted">Następny: {b.effect(lvl + 1)}</div>}
              <div className="row">
                <Btn kind="primary" onClick={() => act((g) => upgradeBuilding(g, b.id))} disabled={!c.ok} why={c.why}>{lvl === 0 ? 'Zbuduj' : 'Rozbuduj'} 💰 {fmt(buildingCost(b, lvl + 1))}</Btn>
                {!c.ok && <span className="why">{c.why}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContractsScreen() {
  const s = useGame();
  const act = useStore((x) => x.act);
  return (
    <div className="col">
      <div className="panel"><h2 style={{ margin: 0 }}>📜 Kontrakty</h2><div className="muted small">Instytucje proszą o pomoc. Kontrakty nie wygasają — możesz je wymienić za drobną opłatą.</div></div>
      <div className="grid cards">
        {s.contracts.map((c) => {
          const done = c.progress >= c.need;
          return (
            <div key={c.id} className="panel col" style={{ borderColor: done ? '#7fb069' : undefined }}>
              <div className="small muted">{c.institution}</div>
              <b>{c.text}</b>
              <div className="row small"><span>Postęp: {Math.min(c.progress, c.need)}/{c.need}</span></div>
              <Bar value={c.progress} max={c.need} />
              <div className="small">Nagroda: <Cost coins={c.reward.coins} pb={c.reward.pb} mutagen={c.reward.mutagen} /> ⭐ {c.reward.fame}</div>
              <div className="row">
                <Btn kind="primary" onClick={() => act((g) => claimContract(g, c.id))} disabled={!done} why="Jeszcze niewykonany">Odbierz</Btn>
                <span className="spacer" />
                <Btn small onClick={() => act((g) => rerollContract(g, c.id))} disabled={s.coins < rerollCost(s)} why="Za mało monet">Wymień 💰 {fmt(rerollCost(s))}</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const s = useGame();
  const act = useStore((x) => x.act);
  const replace = useStore((x) => x.replaceState);
  const setTab = useStore((x) => x.setTab);
  const toast = useStore((x) => x.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveDir, setSaveDir] = useState('');
  if (desktop && !saveDir) void desktop.saveDir().then(setSaveDir);
  const exportSave = async () => {
    if (desktop) {
      const p = await desktop.exportSave(serialize(s));
      if (p) toast('Zapisano kopię: ' + p, 'good');
      return;
    }
    const blob = new Blob([serialize(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `park-wymarlych-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const loadText = (txt: string) => {
    const st = deserialize(txt);
    if (!st) { toast('Nieprawidłowy plik zapisu', 'bad'); return; }
    if (!confirm('Wczytać ten zapis? Obecny postęp zostanie zastąpiony (zrób najpierw kopię, jeśli chcesz go zachować).')) return;
    replace(st);
    save();
    toast('Wczytano zapis', 'good');
  };
  const importSave = async (f: File) => loadText(await f.text());
  const pickSave = async () => {
    if (desktop) { const txt = await desktop.importSave(); if (txt) loadText(txt); return; }
    fileRef.current?.click();
  };
  const byBranch = BRANCHES.map((b) => {
    const gs = TAXA.genera.filter((g) => g.branch === b.id);
    return { b, total: gs.length, hatched: gs.filter((g) => s.hatched[g.id]).length };
  });
  return (
    <div className="grid two">
      <div className="col">
        <div className="panel col">
          <h2>📚 Kolekcja według gałęzi</h2>
          {byBranch.map(({ b, total, hatched }) => (
            <div key={b.id} className="col" style={{ gap: 2 }}>
              <div className="row small"><span style={{ color: b.color }}>■</span> {b.namePl}<span className="spacer" />{hatched}/{total}</div>
              <Bar value={hatched} max={total} />
            </div>
          ))}
        </div>
        <div className="panel col">
          <h2>📊 Statystyki</h2>
          <div className="small">Kliknięcia: {fmt(s.stats.clicks)} · skamieniałości: {fmt(s.stats.fossils)} · warstwy: {s.stats.layers} · drobne: {s.stats.minor} · bursztyn: {s.stats.amber}</div>
          <div className="small">Ekstrakcje: {s.stats.extractions} · ewolucje: {s.stats.evolutions} · nieudane syntezy: {s.stats.hatchFails}</div>
          <div className="small">Czas gry: {Math.round(s.playSeconds / 60)} min</div>
        </div>
        <div className="panel col">
          <h2>📜 Dziennik</h2>
          <div className="col small" style={{ maxHeight: 260, overflow: 'auto', gap: 3 }}>
            {s.log.map((l, i) => <div key={i} style={{ color: l.kind === 'good' ? '#8ccf6e' : l.kind === 'bad' ? '#d06a5a' : undefined }}>{new Date(l.t).toLocaleTimeString('pl-PL')} — {l.text}</div>)}
          </div>
        </div>
      </div>
      <div className="col">
        <div className="panel col">
          <h2>💾 Zapis</h2>
          {desktop ? (
            <div className="small muted">Gra zapisuje się sama co 15 s do pliku <b>zapis.json</b> w folderze <b>{saveDir || 'Dokumenty\\SEC'}</b> (obok dwie kopie zapasowe). Żeby przenieść grę na inny komputer, skopiuj ten plik do tego samego folderu na drugim komputerze albo użyj przycisków poniżej.</div>
          ) : (
            <div className="small muted">Gra zapisuje się automatycznie w tej przeglądarce co 15 s. Możesz też zrobić kopię do pliku.</div>
          )}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Btn onClick={exportSave}>Eksportuj do pliku</Btn>
            <Btn onClick={pickSave}>Wczytaj z pliku</Btn>
            {desktop && <Btn onClick={() => { save(); void desktop!.openSaveDir(); }}>Otwórz folder zapisów</Btn>}
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
            <span className="spacer" />
            <Btn onClick={() => { if (confirm('Na pewno zacząć od nowa? Postęp zostanie utracony.')) { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } replace(startGame(Date.now())); } }}>Nowa gra</Btn>
          </div>
        </div>
        <div className="panel col">
          <h2>🛠️ Narzędzia szkicu</h2>
          <label className="row small"><input type="checkbox" checked={s.settings.revealAll} onChange={(e) => act((g) => { g.settings.revealAll = e.target.checked; })} /> Odsłoń całą kolekcję w drzewie i encyklopedii (podgląd)</label>
          <div className="row">
            <Btn onClick={() => setTab('gallery')}>🎨 Galeria sprite'ów</Btn>
            <Btn onClick={() => act((g) => { g.coins += 1e6; g.pb += 1e4; g.mutagen += 100; })}>+ zasoby (test)</Btn>
          </div>
        </div>
        <div className="panel col small">
          <h2>ℹ️ Źródła</h2>
          <div>Dane o {TAXA.genera.length} rodzajach, ich pokrewieństwie, wieku, środowisku i stanowiskach pochodzą z <a href="https://paleobiodb.org" target="_blank" rel="noreferrer">The Paleobiology Database</a> (licencja CC BY 4.0).</div>
          <div>Grafika zwierząt jest generowana proceduralnie z szablonów budowy ciała — to uproszczone przybliżenia, nie rekonstrukcje naukowe. Stadia „Wzmocnione”, „Elitarne” i „Apeks” są fikcyjne.</div>
        </div>
      </div>
    </div>
  );
}

export function GalleryScreen() {
  const [branch, setBranch] = useState<string>('dinosaurs');
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const list = TAXA.genera.filter((g) => (q ? g.name.toLowerCase().includes(q.toLowerCase()) : g.branch === branch));
  const per = 30;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const shown = list.slice(page * per, page * per + per);
  return (
    <div className="col">
      <div className="panel row">
        <h2 style={{ margin: 0 }}>🎨 Galeria sprite'ów</h2>
        {BRANCHES.map((b) => <Btn key={b.id} small on={!q && branch === b.id} onClick={() => { setBranch(b.id); setPage(0); setQ(''); }}>{b.namePl}</Btn>)}
        <input placeholder="szukaj…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ padding: 5, borderRadius: 6, border: '1px solid #45503f', background: '#151912', color: '#e9ecdf' }} />
        <span className="spacer" />
        <Btn small onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>◀</Btn>
        <span className="small">{page + 1}/{pages} ({list.length})</span>
        <Btn small onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1}>▶</Btn>
      </div>
      <div className="gallery">
        {shown.map((g) => (
          <div key={g.id} className="g">
            <div className="small"><b>{g.name}</b> <span className="muted">{g.archetype} · {g.size} · {HABITAT_ICONS[g.habitat]}</span></div>
            <div className="s">{STAGE_NAMES.map((_, st) => <SpriteImg key={st} genusId={g.id} stage={st} scale={st === 0 ? 1 : 1.5} animate />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

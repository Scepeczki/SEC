// Publishes the current version as a GitHub release with the Windows installer.
// The installed game checks these releases and updates itself (electron-updater reads latest.yml).
//
// Usage: 1) bump "version" in package.json  2) add a "## x.y.z" section to CHANGELOG.md
//        3) commit + push  4) npm run release
//
// Needs a GitHub token: GH_TOKEN env, or the one Git Credential Manager already stores for github.com.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const { owner, repo } = pkg.build.publish[0];
const version = pkg.version;
const tag = `v${version}`;

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const r = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  const m = /^password=(.+)$/m.exec(r.stdout ?? '');
  if (!m) throw new Error('Brak tokenu GitHub (ustaw GH_TOKEN albo zaloguj się w Git do github.com).');
  return m[1].trim();
}

function notes() {
  const txt = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8') : '';
  const re = new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm');
  const m = re.exec(txt);
  if (!m) throw new Error(`Dodaj sekcję "## ${version}" do CHANGELOG.md`);
  return m[1].trim();
}

const body = notes();
const GH = token();
const api = async (url, init = {}) => {
  const r = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${GH}`, Accept: 'application/vnd.github+json', 'User-Agent': 'sec-release', ...(init.headers ?? {}) },
  });
  if (!r.ok && r.status !== 404) throw new Error(`${init.method ?? 'GET'} ${url}: ${r.status} ${await r.text()}`);
  return r.status === 404 ? null : r.json();
};

if (await api(`/repos/${owner}/${repo}/releases/tags/${tag}`)) throw new Error(`Wydanie ${tag} już istnieje — podbij wersję w package.json.`);

console.log(`Buduję instalator ${version}…`);
execSync('npm run dist', { stdio: 'inherit' });

const files = [`SEC-Setup-${version}.exe`, `SEC-Setup-${version}.exe.blockmap`, 'latest.yml'].map((f) => path.join('release', f));
for (const f of files) if (!fs.existsSync(f)) throw new Error(`Brak pliku ${f}`);

const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
console.log(`Tworzę wydanie ${tag} na ${owner}/${repo}…`);
const rel = await api(`/repos/${owner}/${repo}/releases`, {
  method: 'POST',
  body: JSON.stringify({ tag_name: tag, target_commitish: head, name: `SEC ${version}`, body, draft: false, prerelease: false }),
});
for (const f of files) {
  const name = path.basename(f);
  process.stdout.write(`  wysyłam ${name}… `);
  await api(`https://uploads.github.com/repos/${owner}/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(f),
  });
  console.log('ok');
}
console.log(`Gotowe: ${rel.html_url}`);

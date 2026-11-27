// Regression checks for the R6.8 website remediation: npm monitoring, self-hosted fonts, the privacy notice,
// and the JSON-LD helper wiring. Run with: node --test tests/site.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function filesUnder(dir, out = []) {
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) filesUnder(rel, out);
    else out.push(rel);
  }
  return out;
}

test('Dependabot monitors npm at the repository root, weekly, alongside github-actions', () => {
  const dependabot = YAML.parse(read('.github/dependabot.yml'));
  const npm = dependabot.updates.filter((u) => u['package-ecosystem'] === 'npm');
  assert.equal(npm.length, 1, 'exactly one npm update entry');
  assert.equal(npm[0].directory, '/');
  assert.equal(npm[0].schedule.interval, 'weekly');
  const actions = dependabot.updates.filter((u) => u['package-ecosystem'] === 'github-actions');
  assert.equal(actions.length, 1, 'the github-actions entry is kept');
});

test('no executable or stylesheet source requests Google Fonts or any other external font host', () => {
  // Documentation (such as src/assets/fonts/README.md, which records where the fonts came from) is not a request,
  // so only code and stylesheets are checked here.
  const hosts = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit|cdn\.jsdelivr|unpkg\.com/;
  for (const rel of filesUnder('src').filter((f) => /\.(astro|css|ts|mjs|js|tsx)$/.test(f))) {
    assert.equal(hosts.test(read(rel)), false, `${rel} must not reference an external font host`);
  }
});

test('the four self-hosted WOFF2 font files exist, with the WOFF2 signature', () => {
  const dir = 'src/assets/fonts';
  const fonts = readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.woff2'));
  assert.equal(fonts.length, 4);
  for (const f of fonts) {
    const head = readFileSync(path.join(root, dir, f)).subarray(0, 4).toString('ascii');
    assert.equal(head, 'wOF2', `${f} must be a WOFF2 file`);
  }
});

test('each self-hosted font has an OFL licence text alongside it', () => {
  for (const name of ['OFL-Inter.txt', 'OFL-JetBrainsMono.txt', 'OFL-SourceSerif4.txt']) {
    const rel = path.join('src/assets/fonts/licenses', name);
    assert.ok(existsSync(path.join(root, rel)), `${rel} must exist`);
    assert.match(read(rel), /SIL Open Font License, Version 1\.1/);
  }
});

test('global.css declares the four @font-face rules with font-display: swap', () => {
  const css = read('src/styles/global.css');
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  assert.equal(faces.length, 4);
  for (const face of faces) {
    assert.match(face, /font-display:\s*swap/);
    assert.match(face, /url\("\.\.\/assets\/fonts\/[^"]+\.woff2"\)/, 'relative path to a local font file');
  }
});

test('the privacy notice exists and the footer links to it', () => {
  assert.ok(existsSync(path.join(root, 'src/pages/privacy.astro')), 'src/pages/privacy.astro must exist');
  assert.match(read('src/components/Footer.astro'), /withBase\('\/privacy\/'\)/);
});

test('the article JSON-LD is written through serializeJsonLd, never through raw JSON.stringify', () => {
  const layout = read('src/layouts/ArticleLayout.astro');
  assert.match(layout, /import \{ serializeJsonLd \} from '\.\.\/lib\/jsonld\.mjs'/);
  assert.match(layout, /set:html=\{serializeJsonLd\(jsonLd\)\}/);
  assert.doesNotMatch(layout, /set:html=\{JSON\.stringify/);
});

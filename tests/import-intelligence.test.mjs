// Tests for scripts/import-intelligence.mjs. Every bundle here is SYNTHETIC and built in code.
// All file writes go to a temporary directory; nothing is written into src/content/articles.
// Run with: node --test tests/import-intelligence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyPlan,
  planImport,
  renderArticle,
  validateArticle,
  validateBundle,
  verificationLabel,
  REQUIRED_ARTICLE_KEYS,
  CATEGORIES,
  CONFIDENCE,
  CLAIM_CLASSES,
  VERIFICATION,
} from '../scripts/import-intelligence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const SYNTHETIC_DESC = 'Synthetic fixture: an approved revision used to test the website importer.';

function makeBody(extra = '') {
  return ['# Synthetic test article', '',
    'The catalogue lists the flaw as exploited.[^C1]', '',
    'A malware family is assessed to be involved.[^C2]', extra].join('\n');
}

// A valid, SYNTHETIC article. Pass overrides to break one rule at a time.
function makeArticle(over = {}) {
  const { body, ...rest } = over;
  const text = body ?? makeBody();
  return {
    article_key: 'cve_investigation:CVE-2026-9001', engine_article_id: 1, revision: 1,
    approved_at: '2026-11-26T09:00:00+00:00', approved_by: 'reviewer.human', state: 'APPROVED',
    title: 'Synthetic test article', slug: 'synthetic-test-article', description: SYNTHETIC_DESC,
    category: 'cve', date: '2026-11-25', updated: '2026-11-25', last_verified: '2026-11-25',
    confidence: 'medium', verification_status: 'unverified', demo: false,
    tags: ['cve', 'test'], cve_ids: ['CVE-2026-9001'],
    references: [{ title: 'CISA KEV (synthetic)', url: 'https://www.cisa.gov/synthetic-fixture',
                   publisher: 'CISA (synthetic)', evidence_id: 'EV-1', authority: 'primary' }],
    claims: [
      { id: 'C1', text: 'The catalogue lists the flaw as exploited.', classification: 'CONFIRMED',
        investigation: 'exploit', evidence_ids: ['EV-1'] },
      { id: 'C2', text: 'A malware family is assessed to be involved.', classification: 'ASSESSED',
        investigation: 'malware', evidence_ids: ['EV-1'] },
    ],
    associations: [{ type: 'malware', statement: 'A malware family is assessed to be involved.', claim_id: 'C2',
                     classification: 'ASSESSED', evidence_ids: ['EV-1'] }],
    body_markdown: text, content_sha256: sha(text), synthetic: true, export_status: 'new',
    ...rest,
  };
}

function makeBundle(articles = [makeArticle()], overrides = {}) {
  return { schema_version: 'intelligence-export/v1', generated_at: '2026-11-28T10:00:00+00:00',
           engine_commit: '0'.repeat(40), synthetic: true, articles, ...overrides };
}

function dirs() {
  const base = mkdtempSync(path.join(tmpdir(), 'cp-import-'));
  const articlesDir = path.join(base, 'articles');
  const proposalsDir = path.join(base, 'proposals');
  mkdirSync(articlesDir, { recursive: true });
  return { base, articlesDir, proposalsDir };
}

// ------------------------------------------------------------ valid input and production refusal

test('a valid synthetic bundle passes when synthetic input is explicitly allowed for tests', () => {
  assert.deepEqual(validateBundle(makeBundle(), { allowSynthetic: true }), []);
});

test('production validation refuses synthetic bundles and synthetic articles', () => {
  assert.ok(validateBundle(makeBundle()).some((e) => e.includes('synthetic bundles are not allowed')));
  assert.ok(validateArticle(makeArticle()).some((e) => e.includes('synthetic test records')));
});

// ------------------------------------------------------------ shared contract with the engine schema

test('the schema file and the importer agree on enumerations and required fields', () => {
  const schema = JSON.parse(readFileSync(path.join(root, 'schemas/intelligence-export-v1.schema.json'), 'utf8'));
  const article = schema.$defs.article;
  assert.deepEqual([...article.required].sort(), [...REQUIRED_ARTICLE_KEYS].sort());
  assert.deepEqual(article.properties.category.enum, CATEGORIES);
  assert.deepEqual(article.properties.confidence.enum, CONFIDENCE);
  assert.deepEqual(article.properties.verification_status.enum, VERIFICATION);
  assert.deepEqual(article.properties.claims.items.properties.classification.enum, CLAIM_CLASSES);
});

// ------------------------------------------------------------ rejection rules, one per case

const REJECTIONS = [
  ['state is not APPROVED', { state: 'PENDING_APPROVAL' }, 'state must be APPROVED'],
  ['demo is true', { demo: true }, 'demo must be false'],
  ['slug is not a website slug', { slug: 'Not A Slug' }, 'slug is not a valid website slug'],
  ['description too short', { description: 'short' }, 'description must be 40 to 220'],
  ['category not allowed', { category: 'news' }, 'category is not allowed'],
  ['body hash does not match', { content_sha256: '0'.repeat(64) }, 'content_sha256 does not match'],
  ['a reference uses http', { references: [{ title: 'x', url: 'http://insecure.example', publisher: 'x', evidence_id: 'EV-1', authority: 'primary' }] }, 'https URL'],
  ['no references', { references: [] }, 'at least one reference'],
  ['reference has no publisher', { references: [{ title: 'x', url: 'https://example.org/a', evidence_id: 'EV-1', authority: 'primary' }] }, 'title and a publisher'],
  ['confirmed status with an unverified claim', { verification_status: 'confirmed', claims: [{ id: 'C1', text: 'x', classification: 'UNVERIFIED', investigation: 'exploit', evidence_ids: ['EV-1'] }], associations: [], body_markdown: makeBody().replace('[^C1]', '[^C1]'), content_sha256: sha(makeBody()) }, 'not every cited claim is CONFIRMED'],
  ['an unverified claim described as confirmed', (() => { const body = makeBody().replace('A malware family is assessed to be involved.[^C2]', 'The vendor confirmed the second stage.[^C2]'); return { body, content_sha256: sha(body), associations: [] }; })(), 'describes it as confirmed'],
  ['body cites a claim that is not in the bundle', (() => { const body = makeBody('\nExtra.[^C9]'); return { body, content_sha256: sha(body) }; })(), 'absent from the bundle: C9'],
  ['malware association without evidence', { associations: [{ type: 'malware', statement: 's', claim_id: 'C2', classification: 'ASSESSED', evidence_ids: [] }] }, 'need direct evidence'],
  ['association backed by an unverified claim', { associations: [{ type: 'threat_actor', statement: 's', claim_id: 'C2', classification: 'UNVERIFIED', evidence_ids: ['EV-1'] }] }, 'CONFIRMED or ASSESSED'],
  ['unknown claim classification', { claims: [{ id: 'C1', text: 'x', classification: 'PROVEN', investigation: 'exploit', evidence_ids: ['EV-1'] }] }, 'unknown classification'],
  ['raw HTML in the body', (() => { const body = makeBody('\n<script>alert(1)</script>'); return { body, content_sha256: sha(body) }; })(), 'raw HTML'],
  ['a script URL in the body', (() => { const body = makeBody('\n[x](javascript:alert(1))'); return { body, content_sha256: sha(body) }; })(), 'raw HTML or a script URL'],
  ['a CVE identifier with the wrong format', { cve_ids: ['CVE-bad'] }, 'cve_ids must match'],
  ['an update without update_of_revision', { export_status: 'update_proposal' }, 'update_of_revision is required'],
];

for (const [label, change, expected] of REJECTIONS) {
  test(`rejects an article where ${label}`, () => {
    const errors = validateArticle(makeArticle(change), { allowSynthetic: true });
    assert.ok(errors.some((e) => e.includes(expected)), `expected "${expected}" in ${JSON.stringify(errors)}`);
  });
}

test('rejects a bundle with the wrong schema version and a duplicate article key', () => {
  const bundle = makeBundle([makeArticle(), makeArticle()], { schema_version: 'intelligence-export/v2' });
  const errors = validateBundle(bundle, { allowSynthetic: true });
  assert.ok(errors.some((e) => e.includes('schema_version must be')));
  assert.ok(errors.some((e) => e.includes('duplicate article_key')));
});

test('a complete, valid article is accepted', () => {
  assert.deepEqual(validateArticle(makeArticle(), { allowSynthetic: true }), []);
});

// ------------------------------------------------------------ safe Markdown and compatibility

test('renderArticle writes demo false, quoted strings and engine identity', () => {
  const out = renderArticle(makeArticle({ title: 'Quote "inside" the title' }));
  assert.match(out, /^---\ntitle: "Quote \\"inside\\" the title"/);
  assert.match(out, /\ndemo: false\n/);
  assert.match(out, /\narticle_key: "cve_investigation:CVE-2026-9001"\n/);
  assert.match(out, /\ncontent_sha256: "[a-f0-9]{64}"\n/);
});

test('renderArticle removes a leading heading that repeats the title', () => {
  const out = renderArticle(makeArticle());   // title and leading heading are both "Synthetic test article"
  const afterFrontmatter = out.slice(out.indexOf('\n---\n') + 5);
  assert.doesNotMatch(afterFrontmatter, /^# Synthetic test article$/m);
  assert.match(afterFrontmatter, /The catalogue lists the flaw as exploited/);
});

test('rendered frontmatter contains every field the website collection requires', () => {
  const out = renderArticle(makeArticle());
  const front = out.split('---\n')[1];
  for (const key of ['title', 'description', 'date', 'category', 'tags', 'references', 'demo']) {
    assert.match(front, new RegExp(`^${key}:`, 'm'), `${key} must be present`);
  }
  const description = JSON.parse(front.match(/^description: (.*)$/m)[1]);
  assert.ok(description.length >= 40 && description.length <= 220, 'description length matches the site rule');
  assert.match(front, /^featured: false$/m);
});

test('a body with a leading heading that differs from the title keeps that heading', () => {
  const body = makeBody().replace('# Synthetic test article', '# Another heading');
  const out = renderArticle(makeArticle({ body, content_sha256: sha(body) }));
  assert.match(out, /# Another heading/);
});

// ------------------------------------------------------------ duplicates and updates

test('planImport creates a new article, and a second identical import is unchanged', () => {
  const { articlesDir, proposalsDir } = dirs();
  const article = makeArticle();
  const first = planImport(makeBundle([article], { synthetic: false }), { articlesDir, proposalsDir });
  assert.equal(first.create.length, 1);
  applyPlan(first);
  const second = planImport(makeBundle([article], { synthetic: false }), { articlesDir, proposalsDir });
  assert.equal(second.create.length, 0);
  assert.equal(second.unchanged.length, 1);
});

test('an existing article that the engine did not write is refused, never overwritten', () => {
  const { articlesDir, proposalsDir } = dirs();
  const hand = path.join(articlesDir, 'synthetic-test-article.md');
  writeFileSync(hand, '---\ntitle: "Hand written"\n---\n\nText.\n');
  const plan = planImport(makeBundle([makeArticle()]), { articlesDir, proposalsDir });
  assert.equal(plan.refused.length, 1);
  assert.match(plan.refused[0].reason, /not written by the engine/);
  assert.equal(readFileSync(hand, 'utf8'), '---\ntitle: "Hand written"\n---\n\nText.\n');
});

test('an existing article belonging to a different key is refused', () => {
  const { articlesDir, proposalsDir } = dirs();
  writeFileSync(path.join(articlesDir, 'synthetic-test-article.md'),
    renderArticle(makeArticle({ article_key: 'cve_investigation:CVE-2026-1111', cve_ids: ['CVE-2026-1111'] })));
  const plan = planImport(makeBundle([makeArticle()]), { articlesDir, proposalsDir });
  assert.match(plan.refused[0].reason, /belongs to cve_investigation:CVE-2026-1111/);
});

test('a higher revision becomes a reviewable proposal file, not an overwrite', () => {
  const { articlesDir, proposalsDir } = dirs();
  const existing = path.join(articlesDir, 'synthetic-test-article.md');
  writeFileSync(existing, renderArticle(makeArticle()));
  const r2body = makeBody().replace('exploited.', 'exploited in one report.');
  const r2 = makeArticle({ revision: 2, body: r2body, content_sha256: sha(r2body) });
  const plan = planImport(makeBundle([r2]), { articlesDir, proposalsDir });
  assert.equal(plan.create.length, 0);
  assert.equal(plan.proposals.length, 1);
  assert.equal(plan.proposals[0].update_of_revision, 1);
  const result = applyPlan(plan);
  assert.equal(result.proposed.length, 1);
  assert.ok(existsSync(path.join(proposalsDir, 'synthetic-test-article.r2.md')));
  assert.match(readFileSync(existing, 'utf8'), /revision: 1/, 'the live article is untouched');
});

test('an older or conflicting revision of an existing article is refused', () => {
  const { articlesDir, proposalsDir } = dirs();
  writeFileSync(path.join(articlesDir, 'synthetic-test-article.md'), renderArticle(makeArticle({ revision: 2 })));
  const plan = planImport(makeBundle([makeArticle({ revision: 1 })]), { articlesDir, proposalsDir });
  assert.equal(plan.refused.length, 1);
});

test('applyPlan writes nothing when any article is refused', () => {
  const { articlesDir, proposalsDir } = dirs();
  writeFileSync(path.join(articlesDir, 'blocked-article.md'), '---\ntitle: "Hand written"\n---\n');
  const good = makeArticle({ slug: 'fresh-synthetic-article' });
  const blocked = makeArticle({ slug: 'blocked-article' });
  const plan = planImport(makeBundle([good, blocked]), { articlesDir, proposalsDir });
  assert.equal(plan.refused.length, 1);
  assert.throws(() => applyPlan(plan), /refusing to write/);
  assert.equal(existsSync(path.join(articlesDir, 'fresh-synthetic-article.md')), false);
});

test('applyPlan never overwrites a file that appears after planning', () => {
  const { articlesDir, proposalsDir } = dirs();
  const plan = planImport(makeBundle([makeArticle()]), { articlesDir, proposalsDir });
  writeFileSync(path.join(articlesDir, 'synthetic-test-article.md'), 'appeared after planning\n');
  assert.throws(() => applyPlan(plan), /EEXIST/);
  assert.equal(readFileSync(path.join(articlesDir, 'synthetic-test-article.md'), 'utf8'), 'appeared after planning\n');
});

// ------------------------------------------------------------ command line

test('the command line refuses a synthetic bundle, exits 1, and changes no article', () => {
  const { base } = dirs();
  const bundlePath = path.join(base, 'bundle.json');
  writeFileSync(bundlePath, JSON.stringify(makeBundle()));
  const before = readdirSync(path.join(root, 'src/content/articles')).sort();
  let status = 0;
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/import-intelligence.mjs'), bundlePath], { stdio: 'pipe' });
  } catch (err) {
    status = err.status;
  }
  assert.equal(status, 1);
  assert.deepEqual(readdirSync(path.join(root, 'src/content/articles')).sort(), before);
});

// ------------------------------------------------------------ verification labels

const claim = (classification) => ({ id: 'C1', text: 'x', classification, investigation: 'exploit', evidence_ids: ['EV-1'] });

test('the label is CONFIRMED only when every claim is CONFIRMED', () => {
  assert.equal(verificationLabel({ claims: [claim('CONFIRMED'), claim('CONFIRMED')] }), 'CONFIRMED');
});

test('one ASSESSED claim makes the label ASSESSED', () => {
  assert.equal(verificationLabel({ claims: [claim('CONFIRMED'), claim('ASSESSED')] }), 'ASSESSED');
});

for (const weak of ['UNVERIFIED', 'UNKNOWN', 'DISPUTED']) {
  test(`a ${weak} claim makes the whole article UNVERIFIED, even beside confirmed claims`, () => {
    assert.equal(verificationLabel({ claims: [claim('CONFIRMED'), claim('ASSESSED'), claim(weak)] }), 'UNVERIFIED');
  });
}

test('the rendered article carries the weakest-claim label in its frontmatter', () => {
  const body = '# Synthetic test article\n\nThe catalogue lists the flaw as exploited.[^C1]\n\nA malware family is assessed to be involved.[^C2]\n';
  const article = makeArticle({ body, content_sha256: sha(body),
    claims: [claim('CONFIRMED'), { ...claim('UNVERIFIED'), id: 'C2' }] });
  const out = renderArticle(article);
  assert.match(out, /^verification_label: "UNVERIFIED"$/m);
});

test('the label component names all three classifications in visible text, not colour alone', () => {
  const src = readFileSync(path.join(root, 'src/components/VerificationLabel.astro'), 'utf8');
  for (const word of ['CONFIRMED', 'ASSESSED', 'UNVERIFIED']) assert.match(src, new RegExp(`${word}:`));
  assert.match(src, /Do not treat this article as confirmed/);
  assert.match(src, /Verification is not recorded/, 'an article with no label must not look verified');
});

test('the article layout shows the label, and the label is not the only place a status appears', () => {
  const layout = readFileSync(path.join(root, 'src/layouts/ArticleLayout.astro'), 'utf8');
  assert.match(layout, /import VerificationLabel from '\.\.\/components\/VerificationLabel\.astro'/);
  assert.match(layout, /label=\{article\.data\.verification_label\}/);
});

test('the content schema accepts the exported label values', () => {
  const config = readFileSync(path.join(root, 'src/content.config.ts'), 'utf8');
  assert.match(config, /verification_label: z\.enum\(\['CONFIRMED', 'ASSESSED', 'UNVERIFIED'\]\)/);
});

// ------------------------------------------------------------ schema synchronisation

const PINNED_SCHEMA_SHA256 = '887e304d57e4d74ca49076d61bef60b320ae003887319fd572a28b248c0f2170';

test('the website schema matches the pinned digest, which the engine test also pins', () => {
  const digest = createHash('sha256').update(readFileSync(path.join(root, 'schemas/intelligence-export-v1.schema.json'))).digest('hex');
  assert.equal(digest, PINNED_SCHEMA_SHA256);
});

test('the website and engine schemas are byte-identical when the engine repository is beside this one', () => {
  const engine = path.join(root, '..', 'cyberpulse-engine', 'schemas', 'intelligence-export-v1.schema.json');
  if (!existsSync(engine)) return; // the engine repository is not present; the pinned digest still applies
  assert.deepEqual(readFileSync(engine), readFileSync(path.join(root, 'schemas/intelligence-export-v1.schema.json')));
});

// ------------------------------------------------------------ reference-definition rule (matches the engine)

const PROSE = '# Synthetic test article\n\nThe catalogue lists the flaw as exploited.[^C1]\n\nOne source suggests a second stage.[^C2]\n';
const DEFS = '\n[^C1]: Source - https://www.cisa.gov/synthetic-fixture - Status: confirmed - evidence EV-1 - retrieved 2026-11-25\n\n'
  + '[^C2]: Source - https://www.cisa.gov/synthetic-fixture - Status: not verified - evidence EV-1 - retrieved 2026-11-25\n';

function withClassification(classification, body) {
  return makeArticle({
    body,
    claims: [
      { id: 'C1', text: 'The catalogue lists the flaw as exploited.', classification: 'CONFIRMED', investigation: 'exploit', evidence_ids: ['EV-1'] },
      { id: 'C2', text: 'One source suggests a second stage.', classification, investigation: 'malware', evidence_ids: ['EV-1'] },
    ],
    associations: [],
    verification_status: classification === 'CONFIRMED' ? 'confirmed' : 'unverified',
  });
}

test('"Status: not verified" in a reference definition is not a false positive', () => {
  assert.deepEqual(validateArticle(withClassification('UNVERIFIED', PROSE + DEFS), { allowSynthetic: true }), []);
});

test('an UNVERIFIED claim described as confirmed in prose is still refused, with definitions present', () => {
  const prose = PROSE.replace('One source suggests a second stage.[^C2]', 'The vendor confirmed a second stage.[^C2]');
  const errors = validateArticle(withClassification('UNVERIFIED', prose + DEFS), { allowSynthetic: true });
  assert.ok(errors.some((e) => e.includes('describes it as confirmed')), JSON.stringify(errors));
});

test('a genuinely confirmed claim is accepted', () => {
  const prose = PROSE.replace('One source suggests a second stage.[^C2]', 'The vendor confirms a second stage.[^C2]');
  assert.deepEqual(validateArticle(withClassification('CONFIRMED', prose + DEFS), { allowSynthetic: true }), []);
});

test('a definition saying "confirmed" cannot upgrade an UNVERIFIED claim, and the label stays UNVERIFIED', () => {
  const defs = DEFS.replace('Status: not verified', 'Status: confirmed');
  const article = withClassification('UNVERIFIED', PROSE + defs);
  assert.deepEqual(validateArticle(article, { allowSynthetic: true }), []);
  assert.equal(verificationLabel(article), 'UNVERIFIED');
});

for (const classification of ['UNVERIFIED', 'UNKNOWN', 'DISPUTED', 'ASSESSED']) {
  test(`${classification} described as confirmed in prose is refused (existing protection unchanged)`, () => {
    const prose = PROSE.replace('One source suggests a second stage.[^C2]', 'The vendor confirmed a second stage.[^C2]');
    const errors = validateArticle(withClassification(classification, prose + DEFS), { allowSynthetic: true });
    assert.ok(errors.some((e) => e.includes('describes it as confirmed')), `${classification}: ${JSON.stringify(errors)}`);
  });
}

test('the engine and the importer use the same reference-definition pattern', () => {
  const jsPattern = '/^\\s*\\[\\^[A-Za-z0-9_-]+\\]:/';
  const js = readFileSync(path.join(root, 'scripts/import-intelligence.mjs'), 'utf8');
  assert.ok(js.includes(jsPattern), 'importer pattern');
  const engine = path.join(root, '..', 'cyberpulse-engine', 'src', 'cyberpulse', 'editorial', 'website_export.py');
  if (!existsSync(engine)) return; // engine repository not beside this one; the pattern is pinned here
  const py = readFileSync(engine, 'utf8');
  assert.ok(py.includes('REFERENCE_DEFINITION_RE = re.compile(r"^\\s*\\[\\^[A-Za-z0-9_-]+\\]:")'), 'engine pattern');
});

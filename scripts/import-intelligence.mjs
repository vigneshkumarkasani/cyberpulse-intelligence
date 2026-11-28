// Offline importer for intelligence-export/v1 bundles produced by the CyberPulse Engine.
//
//   node scripts/import-intelligence.mjs <bundle.json>            dry run: prints the plan, writes nothing
//   node scripts/import-intelligence.mjs <bundle.json> --apply    writes new article files only
//
// Rules:
// - Reads one local JSON file. Makes no network requests and needs no credentials.
// - The whole bundle is refused if any article fails validation. Nothing is written in that case.
// - It never overwrites an article. New articles are created with exclusive write mode.
// - A higher revision of an existing article becomes a proposal file in intelligence-proposals/ for review.
//   Proposals sit outside src/, so the site does not build them.
// - Imported articles are written with demo: false. Synthetic bundles are refused.
// - The rules here mirror cyberpulse-engine/src/cyberpulse/editorial/website_export.py and its JSON Schema
//   (schemas/intelligence-export-v1.schema.json). Tests check that the two stay in step.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 'intelligence-export/v1';
export const CATEGORIES = ['research', 'cve', 'malware', 'threat-actors', 'exploits'];
export const CONFIDENCE = ['high', 'medium', 'low'];
export const VERIFICATION = ['confirmed', 'unverified'];
export const CLAIM_CLASSES = ['CONFIRMED', 'ASSESSED', 'UNVERIFIED', 'DISPUTED', 'UNKNOWN'];
export const ASSOCIATION_TYPES = ['malware', 'threat_actor'];
export const ASSOCIATION_CLASSES = ['CONFIRMED', 'ASSESSED'];
export const AUTHORITY = ['primary', 'secondary', 'unknown'];
export const REQUIRED_BUNDLE_KEYS = ['schema_version', 'generated_at', 'engine_commit', 'synthetic', 'articles'];
export const REQUIRED_ARTICLE_KEYS = [
  'article_key', 'engine_article_id', 'revision', 'approved_at', 'approved_by', 'state', 'title', 'slug',
  'description', 'category', 'date', 'updated', 'last_verified', 'confidence', 'verification_status', 'demo',
  'tags', 'cve_ids', 'references', 'claims', 'associations', 'body_markdown', 'content_sha256', 'synthetic',
  'export_status',
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^[a-z_]+:[A-Za-z0-9._-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/;
const SHA_RE = /^[a-f0-9]{64}$/;
const RAW_HTML_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(\s[^>]*)?\/?>/;
const SCRIPT_URL_RE = /javascript\s*:/i;
const UPGRADE_WORDS_RE = /\b(confirmed|confirms|confirm|verified|verifies|proven|proves)\b/i;
// A reference-definition line, e.g. "[^B4-E5]: Source - https://... - Status: not verified". Same pattern as the engine.
const REFERENCE_DEFINITION_RE = /^\s*\[\^[A-Za-z0-9_-]+\]:/;
const PARAGRAPH_SPLIT_RE = /\n\s*\n/;

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// ---------------------------------------------------------------- validation

export function validateArticle(article, { allowSynthetic = false } = {}) {
  const errors = [];
  if (!article || typeof article !== 'object') return ['article must be an object'];
  const missing = REQUIRED_ARTICLE_KEYS.filter((k) => !(k in article));
  if (missing.length) return [`missing fields: ${missing.join(', ')}`];

  if (!KEY_RE.test(article.article_key)) errors.push('article_key has an invalid format');
  if (article.state !== 'APPROVED') errors.push('state must be APPROVED');
  if (!SLUG_RE.test(article.slug)) errors.push('slug is not a valid website slug');
  if (typeof article.description !== 'string' || article.description.length < 40 || article.description.length > 220) {
    errors.push('description must be 40 to 220 characters');
  }
  if (!CATEGORIES.includes(article.category)) errors.push('category is not allowed');
  if (!CONFIDENCE.includes(article.confidence)) errors.push('confidence is not allowed');
  if (!VERIFICATION.includes(article.verification_status)) errors.push('verification_status is not allowed');
  for (const field of ['date', 'updated', 'last_verified']) {
    if (!DATE_RE.test(String(article[field]))) errors.push(`${field} must be YYYY-MM-DD`);
  }
  if (article.demo !== false) errors.push('demo must be false for exported articles');
  if (!['new', 'update_proposal'].includes(article.export_status)) errors.push('export_status must be new or update_proposal');
  if ((article.export_status === 'update_proposal') !== ('update_of_revision' in article)) {
    errors.push('update_of_revision is required exactly when export_status is update_proposal');
  }
  if (!Array.isArray(article.cve_ids) || article.cve_ids.some((c) => !CVE_RE.test(c))) {
    errors.push('cve_ids must match CVE-YYYY-NNNN');
  }
  if (!Array.isArray(article.tags) || article.tags.length === 0 || article.tags.some((t) => !String(t).trim())) {
    errors.push('tags must be non-empty strings');
  }
  if (article.synthetic && !allowSynthetic) errors.push('synthetic test records are not allowed in production bundles');
  if (typeof article.body_markdown !== 'string' || article.body_markdown.length === 0) {
    errors.push('body_markdown must be a non-empty string');
  } else {
    if (sha256(article.body_markdown) !== article.content_sha256) errors.push('content_sha256 does not match body_markdown');
    if (RAW_HTML_RE.test(article.body_markdown) || SCRIPT_URL_RE.test(article.body_markdown)) {
      errors.push('body_markdown contains raw HTML or a script URL, which the importer refuses');
    }
  }
  if (!SHA_RE.test(article.content_sha256 ?? '')) errors.push('content_sha256 must be 64 hex characters');

  if (!Array.isArray(article.references) || article.references.length === 0) {
    errors.push('at least one reference is required');
  } else {
    for (const ref of article.references) {
      if (typeof ref.url !== 'string' || !ref.url.startsWith('https://')) {
        errors.push('every reference needs an https URL');
        break;
      }
    }
    for (const ref of article.references) {
      if (!AUTHORITY.includes(ref.authority)) {
        errors.push('reference authority is not allowed');
        break;
      }
    }
    for (const ref of article.references) {
      if (typeof ref.title !== 'string' || !ref.title.trim() || typeof ref.publisher !== 'string' || !ref.publisher.trim()) {
        errors.push('every reference needs a title and a publisher');
        break;
      }
    }
  }

  if (!Array.isArray(article.claims) || article.claims.length === 0) {
    errors.push('at least one claim is required');
  } else {
    for (const claim of article.claims) {
      if (!CLAIM_CLASSES.includes(claim.classification)) errors.push(`claim ${claim.id} has an unknown classification`);
    }
    if (article.verification_status === 'confirmed' && article.claims.some((c) => c.classification !== 'CONFIRMED')) {
      errors.push('verification_status is confirmed but not every cited claim is CONFIRMED');
    }
    if (typeof article.body_markdown === 'string') {
      const ids = new Set(article.claims.map((c) => c.id));
      const cited = [...article.body_markdown.matchAll(/\[\^([A-Za-z0-9_-]+)\]/g)].map((m) => m[1]);
      const unknown = [...new Set(cited.filter((id) => !ids.has(id)))];
      if (unknown.length) errors.push(`body cites claims absent from the bundle: ${unknown.join(', ')}`);
      for (const claim of article.claims) {
        if (claim.classification === 'CONFIRMED') continue;
        const marker = `[^${claim.id}]`;
        // Same rule as the engine: reference-definition lines are excluded, then prose is split into paragraphs.
        const prose = article.body_markdown.split('\n').filter((line) => !REFERENCE_DEFINITION_RE.test(line)).join('\n');
        const described = prose.split(PARAGRAPH_SPLIT_RE).some(
          (para) => para.includes(marker) && UPGRADE_WORDS_RE.test(para));
        if (described) errors.push(`claim ${claim.id} is ${claim.classification} but its paragraph describes it as confirmed`);
      }
    }
  }

  if (!Array.isArray(article.associations)) {
    errors.push('associations must be a list');
  } else {
    for (const assoc of article.associations) {
      if (!ASSOCIATION_TYPES.includes(assoc.type)) errors.push('association type is not allowed');
      if (!Array.isArray(assoc.evidence_ids) || assoc.evidence_ids.length === 0) {
        errors.push('malware and threat-actor associations need direct evidence');
      }
      if (!ASSOCIATION_CLASSES.includes(assoc.classification)) {
        errors.push('association is not backed by a CONFIRMED or ASSESSED claim');
      }
    }
  }
  return errors;
}

export function validateBundle(bundle, { allowSynthetic = false } = {}) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return ['bundle must be a JSON object'];
  const errors = REQUIRED_BUNDLE_KEYS.filter((k) => !(k in bundle)).map((k) => `missing ${k}`);
  if (bundle.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (bundle.synthetic && !allowSynthetic) errors.push('synthetic bundles are not allowed');
  if (!Array.isArray(bundle.articles)) return [...errors, 'articles must be a list'];
  const seen = new Set();
  bundle.articles.forEach((article, i) => {
    for (const problem of validateArticle(article, { allowSynthetic })) {
      errors.push(`articles[${i}] (${article?.article_key}): ${problem}`);
    }
    if (article?.article_key) {
      if (seen.has(article.article_key)) errors.push(`duplicate article_key ${article.article_key}`);
      seen.add(article.article_key);
    }
  });
  return errors;
}

// ---------------------------------------------------------------- rendering

// The label an article carries is the WEAKEST of its cited claims. One unverified claim makes the whole
// article UNVERIFIED, so an article can only show CONFIRMED when every claim is CONFIRMED.
export function verificationLabel(article) {
  const classes = article.claims.map((c) => c.classification);
  if (classes.some((c) => ['UNVERIFIED', 'UNKNOWN', 'DISPUTED'].includes(c))) return 'UNVERIFIED';
  if (classes.includes('ASSESSED')) return 'ASSESSED';
  return 'CONFIRMED';
}

// JSON string literals are valid YAML double-quoted scalars, so JSON.stringify is used for every string value.
const yamlString = (value) => JSON.stringify(String(value));

export function renderArticle(article) {
  const lines = [
    '---',
    `title: ${yamlString(article.title)}`,
    `description: ${yamlString(article.description)}`,
    `date: ${article.date}`,
    `updated: ${article.updated}`,
    `category: ${article.category}`,
    `tags: [${article.tags.map(yamlString).join(', ')}]`,
    'featured: false',
    'demo: false',
    `confidence: ${yamlString(article.confidence)}`,
    `verification_status: ${yamlString(article.verification_status)}`,
    `verification_label: ${yamlString(verificationLabel(article))}`,
    `last_verified: ${article.last_verified}`,
    `cve_ids: [${article.cve_ids.map(yamlString).join(', ')}]`,
    `article_key: ${yamlString(article.article_key)}`,
    `revision: ${article.revision}`,
    `content_sha256: ${yamlString(article.content_sha256)}`,
    'references:',
  ];
  for (const ref of article.references) {
    lines.push(`  - title: ${yamlString(ref.title)}`);
    lines.push(`    url: ${yamlString(ref.url)}`);
    lines.push(`    publisher: ${yamlString(ref.publisher)}`);
  }
  lines.push('---', '');
  // The title is already the page heading, so a leading "# title" line in the body would repeat it.
  let body = article.body_markdown.replace(/\r\n/g, '\n');
  const firstLine = body.split('\n', 1)[0];
  if (firstLine.trim() === `# ${article.title}`.trim()) body = body.slice(firstLine.length).replace(/^\n+/, '');
  return `${lines.join('\n')}\n${body.endsWith('\n') ? body : `${body}\n`}`;
}

// ---------------------------------------------------------------- planning

function readExistingIdentity(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const field = (name) => {
    const m = text.match(new RegExp(`^${name}: (.*)$`, 'm'));
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return m[1].trim();
    }
  };
  return { article_key: field('article_key'), revision: Number(field('revision')) || null,
           content_sha256: field('content_sha256') };
}

// Returns what would happen to each article. Nothing is written here.
export function planImport(bundle, { articlesDir, proposalsDir }) {
  const plan = { create: [], proposals: [], unchanged: [], refused: [] };
  for (const article of bundle.articles) {
    const file = path.join(articlesDir, `${article.slug}.md`);
    const item = { article_key: article.article_key, slug: article.slug, revision: article.revision };
    if (!existsSync(file)) {
      plan.create.push({ ...item, file, content: renderArticle(article) });
      continue;
    }
    const existing = readExistingIdentity(file);
    if (!existing.article_key) {
      plan.refused.push({ ...item, reason: `${article.slug}.md already exists and was not written by the engine` });
    } else if (existing.article_key !== article.article_key) {
      plan.refused.push({ ...item, reason: `${article.slug}.md belongs to ${existing.article_key}` });
    } else if (existing.content_sha256 === article.content_sha256 && existing.revision === article.revision) {
      plan.unchanged.push(item);
    } else if (article.revision > (existing.revision ?? 0)) {
      const proposal = path.join(proposalsDir, `${article.slug}.r${article.revision}.md`);
      if (existsSync(proposal)) {
        plan.refused.push({ ...item, reason: `proposal ${path.basename(proposal)} already exists; review it first` });
        continue;
      }
      plan.proposals.push({ ...item, file: proposal, content: renderArticle(article), update_of_revision: existing.revision });
    } else {
      plan.refused.push({ ...item, reason: 'the bundle has an older or conflicting revision of an existing article' });
    }
  }
  return plan;
}

// Writes the plan only if every article can proceed. Files are created with exclusive mode, never overwritten.
export function applyPlan(plan) {
  if (plan.refused.length) throw new Error(`refusing to write: ${plan.refused.length} article(s) refused`);
  for (const item of [...plan.create, ...plan.proposals]) {
    mkdirSync(path.dirname(item.file), { recursive: true });
    writeFileSync(item.file, item.content, { encoding: 'utf8', flag: 'wx' });
  }
  return { created: plan.create.map((c) => c.file), proposed: plan.proposals.map((p) => p.file) };
}

// ---------------------------------------------------------------- command line

function main(argv) {
  const [bundlePath, ...flags] = argv;
  const apply = flags.includes('--apply');
  if (!bundlePath || flags.some((f) => f !== '--apply')) {
    console.error('usage: node scripts/import-intelligence.mjs <bundle.json> [--apply]');
    return 2;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const articlesDir = path.join(root, 'src/content/articles');
  const proposalsDir = path.join(root, 'intelligence-proposals');
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  } catch (err) {
    console.error(`cannot read bundle: ${err.message}`);
    return 1;
  }
  const errors = validateBundle(bundle);
  if (errors.length) {
    console.error('bundle refused; nothing written:');
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  const plan = planImport(bundle, { articlesDir, proposalsDir });
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    create: plan.create.map((c) => c.file),
    proposals: plan.proposals.map((p) => ({ file: p.file, update_of_revision: p.update_of_revision })),
    unchanged: plan.unchanged.map((u) => u.slug),
    refused: plan.refused,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (plan.refused.length) return 1;
  if (apply) applyPlan(plan);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

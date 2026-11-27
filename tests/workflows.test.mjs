// Validates the GitHub Actions workflows and the Dependabot configuration: triggers, permissions, environments,
// deployment guards and action pins. Run with: node --test tests/workflows.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => YAML.parse(readFileSync(path.join(root, rel), 'utf8'));
const ci = load('.github/workflows/ci.yml');
const deploy = load('.github/workflows/deploy.yml');
const dependabot = load('.github/dependabot.yml');
const jobsOf = (wf) => Object.entries(wf.jobs);

// The commits each action was pinned to, resolved from the upstream release tag (see the R6 review notes).
const VERIFIED_PINS = {
  'actions/checkout': ['11d5960a326750d5838078e36cf38b85af677262', 'v4.4.0'],
  'actions/setup-node': ['49933ea5288caeca8642d1e84afbd3f7d6820020', 'v4.4.0'],
  'actions/configure-pages': ['983d7736d9b0ae728b81ab479565c72886d7745b', 'v5.0.0'],
  'actions/upload-pages-artifact': ['fc324d3547104276b827a68afc52ff2a11cc49c9', 'v5.0.0'],
  'actions/deploy-pages': ['d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e', 'v4.0.5'],
};
const DEPLOY_ACTIONS = new Set(['actions/configure-pages', 'actions/upload-pages-artifact', 'actions/deploy-pages']);

test('ci.yml runs on pull_request and push to main only, and never on manual dispatch', () => {
  assert.deepEqual(Object.keys(ci.on).sort(), ['pull_request', 'push']);
  assert.deepEqual(ci.on.push.branches, ['main']);
  assert.deepEqual(ci.on.pull_request.branches, ['main']);
  assert.equal('workflow_dispatch' in ci.on, false);
});

test('ci.yml has read-only workflow and job permissions, and no pages or id-token permission anywhere', () => {
  assert.deepEqual(ci.permissions, { contents: 'read' });
  for (const [name, job] of jobsOf(ci)) {
    assert.deepEqual(job.permissions, { contents: 'read' }, `job ${name}`);
  }
  assert.doesNotMatch(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'), /id-token|pages:\s*(read|write)/);
});

test('ci.yml has no deployment environment and no deployment action', () => {
  for (const [name, job] of jobsOf(ci)) {
    assert.equal('environment' in job, false, `job ${name} must not name an environment`);
    for (const step of job.steps) {
      const action = (step.uses ?? '').split('@')[0];
      assert.equal(DEPLOY_ACTIONS.has(action), false, `job ${name} must not use ${action}`);
    }
  }
  assert.deepEqual(Object.keys(ci.jobs), ['build']);
});

test('deploy.yml runs on a push to main only: no pull_request and no workflow_dispatch', () => {
  assert.deepEqual(Object.keys(deploy.on), ['push']);
  assert.deepEqual(deploy.on.push.branches, ['main']);
  assert.equal('pull_request' in deploy.on, false);
  assert.equal('pull_request_target' in deploy.on, false);
  assert.equal('workflow_dispatch' in deploy.on, false);
});

test('deploy.yml: every job is guarded to refs/heads/main', () => {
  for (const [name, job] of jobsOf(deploy)) {
    assert.match(job.if ?? '', /github\.ref == 'refs\/heads\/main'/, `job ${name}`);
  }
});

test('deploy.yml: pages and id-token permissions appear only where they are needed', () => {
  assert.deepEqual(deploy.permissions, { contents: 'read' });
  assert.deepEqual(deploy.jobs['build-artifact'].permissions, { contents: 'read' });
  assert.deepEqual(deploy.jobs.configure.permissions, { contents: 'read', pages: 'read' });
  assert.deepEqual(deploy.jobs.deploy.permissions, { contents: 'read', pages: 'write', 'id-token': 'write' });
  for (const [name, job] of jobsOf(deploy)) {
    if (name === 'deploy') continue;
    assert.notEqual(job.permissions.pages, 'write', `job ${name} must not hold pages: write`);
    assert.equal('id-token' in job.permissions, false, `job ${name} must not hold id-token`);
  }
});

test('deploy.yml: deployment depends on the build and the Pages check, and uses the github-pages environment', () => {
  assert.deepEqual(deploy.jobs.deploy.needs.slice().sort(), ['build-artifact', 'configure']);
  assert.equal(deploy.jobs.deploy.environment.name, 'github-pages');
});

test('every third-party action is pinned to its verified 40-character SHA, in both workflows', () => {
  for (const wf of [ci, deploy]) {
    for (const [, job] of jobsOf(wf)) {
      for (const step of job.steps) {
        if (!step.uses) continue;
        const [action, ref] = step.uses.split('@');
        assert.match(ref, /^[0-9a-f]{40}$/, `${step.uses} must be pinned to a full SHA`);
        if (VERIFIED_PINS[action]) assert.equal(ref, VERIFIED_PINS[action][0], `${action} pin`);
      }
    }
  }
});

test('the build is the same in validation and in deployment: identical install and build commands', () => {
  const runs = (wf) => jobsOf(wf).flatMap(([, job]) => job.steps.map((s) => s.run).filter(Boolean));
  for (const cmd of ['npm ci', 'npm run build']) {
    assert.ok(runs(ci).includes(cmd), `ci.yml runs ${cmd}`);
    assert.ok(runs(deploy).includes(cmd), `deploy.yml runs ${cmd}`);
  }
});

test('the required check is the job "build" in ci.yml', () => {
  assert.equal(ci.jobs.build.name, 'build');
});

test('Dependabot: github-actions updates weekly', () => {
  assert.equal(dependabot.version, 2);
  const [u] = dependabot.updates;
  assert.equal(u['package-ecosystem'], 'github-actions');
  assert.equal(u.schedule.interval, 'weekly');
});

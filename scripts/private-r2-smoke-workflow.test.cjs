'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const workflow = readFileSync(resolve(__dirname,
  '../.github/workflows/private-r2-smoke.yml'), 'utf8');

test('R2 smoke is a manual, main-only protected environment workflow', () => {
  assert.match(workflow, /^on:\s*\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|workflow_call):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.approval == 'I_APPROVE_DISPOSABLE_R2_SMOKE_ONLY'/);
  assert.match(workflow, /environment: r2-smoke/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: read/);
});

test('R2 smoke uses isolated environment secrets and never alters the application flag', () => {
  for (const secret of [
    'R2_SMOKE_ENDPOINT', 'R2_SMOKE_BUCKET', 'R2_SMOKE_ACCESS_KEY_ID',
    'R2_SMOKE_SECRET_ACCESS_KEY',
  ]) {
    assert.match(workflow, new RegExp('secrets\\.' + secret + '\\s*}}'));
  }
  assert.match(workflow, /vars\.R2_SMOKE_ORIGIN/);
  assert.match(workflow, /SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false'/);
  assert.doesNotMatch(workflow, /\bVITE_/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /deploy|prisma migrate/i);
});

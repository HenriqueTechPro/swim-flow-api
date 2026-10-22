'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const workflow = readFileSync(resolve(__dirname, '../.github/workflows/neon-local-auth-staging-manual.yml'), 'utf8');

test('manual Neon workflow never runs on push, PR, timer or workflow_call', () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_call|repository_dispatch):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.repository == 'HenriqueTechPro\/swim-flow-api'/);
});

test('manual action requires confirmation and a protected staging environment', () => {
  assert.match(workflow, /inputs\.confirmation == 'APPLY_SWIM_FLOW_LOCAL_AUTH_STAGING'/);
  assert.match(workflow, /environment:\s*\n\s+name: swimflow-neon-staging/);
  assert.match(workflow, /concurrency:\s*\n\s+group: swimflow-neon-staging-local-auth-schema/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});

test('secret database URLs are only exposed in preflight and migrate steps', () => {
  const secretPattern = /\$\{\{ secrets\.SWIMFLOW_STAGING_(DATABASE_URL|DIRECT_URL) \}\}/g;
  const secretRefs = [...workflow.matchAll(secretPattern)];
  assert.equal(secretRefs.length, 4);

  const prefix = workflow.split('      - name: Validate strict Neon TLS')[0];
  assert.doesNotMatch(prefix, /secrets\.SWIMFLOW_STAGING_/);
  const validateAndMigrate = workflow.slice(workflow.indexOf('      - name: Validate strict Neon TLS'));
  assert.match(validateAndMigrate, /npm run neon:preflight/);
  assert.match(validateAndMigrate, /npm run neon:local-auth:staging -- --apply/);
  assert.match(workflow, /npm run neon:local-auth:staging -- --check/);
  assert.doesNotMatch(workflow, /migrate reset|db push|prisma migrate dev/);
});

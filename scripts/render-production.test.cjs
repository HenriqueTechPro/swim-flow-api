'use strict';
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const blueprint = readFileSync(resolve(__dirname, '..', 'render-production.yaml'), 'utf8');
const staged = readFileSync(resolve(__dirname, '..', 'render.yaml'), 'utf8');

function envSection(key) {
  const pos = blueprint.indexOf('      - key: ' + key + '\n');
  assert.ok(pos > -1, key + ' must be configured');
  return blueprint.slice(pos, blueprint.indexOf('      - key:', pos + 8) < 0
    ? undefined : blueprint.indexOf('      - key:', pos + 8));
}

test('production is a separate billable, manual-only service; staging remains separate', () => {
  assert.match(blueprint, /^    name: swim-flow-api-production$/m);
  assert.match(blueprint, /^    plan: starter$/m);
  assert.match(blueprint, /^    autoDeployTrigger: off$/m);
  assert.match(blueprint, /^    branch: main$/m);
  assert.match(blueprint, /^    healthCheckPath: \/health$/m);
  assert.match(staged, /^    name: swim-flow-api-staging$/m);
  assert.doesNotMatch(blueprint, /(?:^databases:|name: swim-flow-api-staging)/m);
  assert.equal((blueprint.match(/^  - type: web$/gm) || []).length, 1);
});

test('never migrates, seeds, or imports staging data during Render deploy', () => {
  assert.match(blueprint, /^    buildCommand: npm ci --include=dev && npm run prisma:generate && npm run build$/m);
  assert.match(blueprint, /^    startCommand: npm run start:prod$/m);
  assert.doesNotMatch(blueprint, /(?:migrate:deploy|migrate deploy|db push|seed:smoke|prisma reset)/i);
});

test('database and CORS are secret manual inputs; JWT is unique to production', () => {
  for (const key of ['DATABASE_URL','DIRECT_URL','API_CORS_ORIGIN']) {
    assert.match(envSection(key), /sync: false/);
    assert.doesNotMatch(envSection(key), /\bvalue:|\bgenerateValue:/);
  }
  assert.match(envSection('JWT_ACCESS_SECRET'), /generateValue: true/);
  assert.doesNotMatch(blueprint, /(?:ep-old-lake-|raspy-breeze-|SWIMFLOW_STAGING_DATABASE_URL)/);
});

test('auth and private media remain disabled until explicitly homologated', () => {
  for (const key of [
    'SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED',
    'SWIMFLOW_LOCAL_INVITES_ENABLED',
    'SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED',
    'SWIMFLOW_PRIVATE_BLOB_ENABLED',
    'SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED',
    'SWIMFLOW_R2_STORAGE_ENABLED',
  ]) assert.match(envSection(key), /value: "false"/);
  assert.match(envSection('AUTH_COOKIE_SAME_SITE'), /value: none/);
  assert.match(envSection('AUTH_SECURE_COOKIES'), /value: "true"/);
  assert.match(envSection('SWAGGER_ENABLED'), /value: "false"/);
});

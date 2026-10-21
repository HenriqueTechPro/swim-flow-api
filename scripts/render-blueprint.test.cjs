'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');

const blueprint = readFileSync(resolve(__dirname, '..', 'render.yaml'), 'utf8');

function readEnvVarBlock(key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = blueprint.match(new RegExp(
    '^      - key: ' + escapedKey + '\\n((?:        [^\\n]*\\n)*)',
    'm',
  ));
  return match?.[1] || '';
}

test('Blueprint targets the existing staging API and never provisions a second PostgreSQL', () => {
  assert.match(blueprint, /^services:\s*$/m);
  assert.match(blueprint, /^  - type: web$/m);
  assert.match(blueprint, /^    name: swim-flow-api-staging$/m);
  assert.match(blueprint, /^    runtime: node$/m);
  assert.match(blueprint, /^    plan: free$/m);
  assert.match(blueprint, /^    region: virginia$/m);
  assert.match(blueprint, /^    branch: main$/m);
  assert.doesNotMatch(blueprint, /^databases:/m);
  assert.equal((blueprint.match(/^  - type: web$/gm) || []).length, 1);
});

test('Render only runs NestJS build/start, not a database mutation or seed', () => {
  assert.match(blueprint, /^    buildCommand: npm ci && npm run prisma:generate && npm run build$/m);
  assert.match(blueprint, /^    startCommand: npm run start:prod$/m);
  assert.match(blueprint, /^    autoDeployTrigger: off$/m);
  assert.match(blueprint, /^    healthCheckPath: \/health$/m);
  assert.doesNotMatch(blueprint, /(?:migrate\s+deploy|migrate:deploy|db\s+push|seed:smoke|prisma\s+reset)/i);
});

test('secrets are prompted for initial setup and never committed', () => {
  for (const key of [
    'DATABASE_URL', 'DIRECT_URL', 'API_CORS_ORIGIN',
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
  ]) {
    assert.match(readEnvVarBlock(key), /^        sync: false$/m, key);
    assert.doesNotMatch(readEnvVarBlock(key), /\bvalue:|generateValue:/, key);
  }
  assert.match(readEnvVarBlock('JWT_ACCESS_SECRET'), /^        generateValue: true$/m);
  assert.match(readEnvVarBlock('NODE_ENV'), /^        value: production$/m);
  assert.match(readEnvVarBlock('NODE_VERSION'), /^        value: "22"$/m);
});

test('cross-site refresh cookie safety and disabled production Swagger', () => {
  assert.match(readEnvVarBlock('AUTH_COOKIE_SAME_SITE'), /^        value: none$/m);
  assert.match(readEnvVarBlock('AUTH_SECURE_COOKIES'), /^        value: "true"$/m);
  assert.match(readEnvVarBlock('AUTH_COOKIE_PATH'), /^        value: \/api\/auth$/m);
  assert.match(readEnvVarBlock('SWAGGER_ENABLED'), /^        value: "false"$/m);
});

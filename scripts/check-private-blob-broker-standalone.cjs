#!/usr/bin/env node
'use strict';

// The standalone Vercel project has its own rootDirectory and must not pull
// NestJS or access files above that root at runtime. These 3 copied modules
// MUST be byte-for-byte identical to the canonical, security-tested modules
// in scripts/. CI fails whenever either copy drifts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = [
  'private-blob-broker-auth-v1.cjs',
  'private-blob-broker-readonly-receiver.cjs',
  'private-blob-broker-postgres-nonce.cjs',
];

for (const file of modules) {
  const source = fs.readFileSync(path.join(root, 'scripts', file));
  const copy = fs.readFileSync(path.join(root, 'blob-broker', 'lib', file));
  assert.deepEqual(copy, source, 'standalone broker copy drift: ' + file);
}

const config = JSON.parse(
  fs.readFileSync(path.join(root, 'blob-broker', 'package.json'), 'utf8'),
);
assert.equal(config.private, true);
assert.equal(config.dependencies['@vercel/blob'], '2.8.2');
assert.ok(!('dotenv' in (config.dependencies || {})));
const locked = JSON.parse(
  fs.readFileSync(path.join(root, 'blob-broker', 'package-lock.json'), 'utf8'),
);
assert.equal(locked.lockfileVersion, 3);
assert.equal(locked.name, config.name);
assert.deepEqual(locked.packages[''].dependencies, config.dependencies);
assert.equal(locked.packages['node_modules/@vercel/blob'].version, '2.8.2');
assert.ok(/^8\.[0-9]+\.[0-9]+$/.test(locked.packages['node_modules/pg'].version));
for (const [key, value] of Object.entries(locked.packages)) {
  if (!key) continue;
  assert.equal(typeof value.integrity, 'string',
    'locked package missing integrity metadata: ' + key);
}


const vercel = JSON.parse(
  fs.readFileSync(path.join(root, 'blob-broker', 'vercel.json'), 'utf8'),
);
assert.deepEqual(Object.keys(vercel.functions), ['api/probe.js']);
assert.ok(vercel.functions['api/probe.js'].maxDuration <= 10);

process.stdout.write(
  'PASS: broker standalone package matches canonical security modules; no Nest, no extra routes.\n',
);

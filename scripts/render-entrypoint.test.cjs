'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { verifyVersionedMigrations } = require('./neon-local-auth-staging.cjs');

const ROOT = resolve(__dirname, '..');

test('NestJS production entrypoint matches the compiled artifact after npm run build', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const build = JSON.parse(readFileSync(resolve(ROOT, 'tsconfig.build.json'), 'utf8'));
  assert.equal(pkg.scripts['start:prod'], 'node dist/main.js');
  assert.equal(build.compilerOptions.rootDir, './src');
  assert.deepEqual(build.include, ['src/**/*.ts']);
  assert.ok(build.exclude.includes('scripts'));
  assert.ok(existsSync(resolve(ROOT, 'dist', 'main.js')), 'Missing dist/main.js after Nest build');
  assert.ok(!existsSync(resolve(ROOT, 'dist', 'src', 'main.js')), 'Entry point displaced under dist/src');
  assert.ok(!existsSync(resolve(ROOT, 'dist', 'scripts', 'seed-smoke.js')), 'Seed must not enter production build');
});

test('versioned Prisma migrations remain immutable and LF-only on Windows', () => {
  const attrs = readFileSync(resolve(ROOT, '.gitattributes'), 'utf8');
  assert.match(attrs, /^prisma\/migrations\/\*\*\/migration\.sql text eol=lf$/m);
  assert.equal(verifyVersionedMigrations(ROOT), true, 'Versioned SQL bytes differ from reviewed checksums');
});

/**
 * Generate the first versioned Prisma migration from the current Prisma schema.
 * This does not connect to a database or apply changes.
 *
 * Usage:
 *   npm ci
 *   npm run prisma:generate
 *   node scripts/create-neon-baseline.cjs
 *   git add prisma/migrations
 *
 * REVIEW migration.sql before applying it to a new, empty Neon database.
 */
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const migrations = join(root, 'prisma', 'migrations');
const filename = join(migrations, '20261020000000_init_neon', 'migration.sql');

if (existsSync(filename)) {
  console.error('Baseline migration already exists. Refusing to overwrite.');
  process.exit(1);
}

const executable = join(root, 'node_modules', 'prisma', 'build', 'index.js');
const run = spawnSync(process.execPath, [
  executable, 'migrate', 'diff',
  '--from-empty',
  '--to-schema-datamodel', join(root, 'prisma', 'schema.prisma'),
  '--script',
], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

if (run.status !== 0 || !run.stdout.trim()) {
  console.error(run.stderr || 'Prisma migrate diff did not generate SQL.');
  process.exit(1);
}

mkdirSync(join(migrations, '20261020000000_init_neon'), { recursive: true });
writeFileSync(filename, run.stdout, { encoding: 'utf8', flag: 'wx' });
console.log('Generated ' + filename);
console.log('Review the SQL and commit this file before running prisma migrate deploy.');

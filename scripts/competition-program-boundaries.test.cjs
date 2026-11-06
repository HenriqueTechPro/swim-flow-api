'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const root = join(__dirname, '..');
const prisma = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(join(root, 'prisma/migrations/20261106000000_competition_program_separated_identity/migration.sql'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/database-quality.yml'), 'utf8');

test('competition schedule tables have independent pool and water program identities', () => {
  for (const model of ['PoolProgramRace', 'PoolProgramHeat', 'OpenWaterProgramRace', 'OpenWaterProgramStart']) {
    assert.match(prisma, new RegExp('model ' + model + ' \\{'));
  }
  assert.match(prisma, /poolProgramRaces PoolProgramRace\[\]/);
  assert.match(prisma, /openWaterProgramRaces OpenWaterProgramRace\[\]/);
  assert.match(prisma, /enum RaceGenderScope \{/);
});

test('only new empty schedules are created; current sporting results are never modified', () => {
  for (const table of ['pool_program_races', 'pool_program_heats', 'open_water_program_races', 'open_water_program_starts']) {
    assert.match(migration, new RegExp('CREATE TABLE "' + table + '"'));
  }
  assert.doesNotMatch(
    migration,
    /(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+TABLE)\s+"?(?:pool_results|open_water_results|student_season_categories)"?/i,
  );
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /race_gender_scope/);
  assert.match(workflow, /verify-competition-program-postgres\.cjs/);
  assert.match(workflow, /SWIMFLOW_DISPOSABLE_DB: 'yes'/);
});

test('disposable PostgreSQL smoke script must keep a hard local-only guard', () => {
  const script = readFileSync(join(root, 'scripts/verify-competition-program-postgres.cjs'), 'utf8');
  assert.match(script, /SWIMFLOW_DISPOSABLE_DB/);
  assert.match(script, /localhost/);
  assert.match(script, /parsed\.pathname !== '\/swimflow'/);
  assert.match(script, /poolResult\.count\(\)/);
  assert.match(script, /openWaterResult\.count\(\)/);
});

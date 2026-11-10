#!/usr/bin/env node
'use strict';

/**
 * Read-only catalog/migration drift audit for an existing Neon database.
 * Never creates/updates rows, applies migrations, or prints database credentials.
 * This script is NOT a migration or a repair tool.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');

const CATALOG_MIGRATION = '20261108130000_complete_swimming_category_catalog';
const CATALOG_SQL = 'SELECT name::text AS "name", age_min AS "ageMin", age_max AS "ageMax", sort_order AS "sortOrder" FROM public.categories';
const HISTORY_SQL = "SELECT migration_name AS \"name\", finished_at IS NOT NULL AS \"finished\", rolled_back_at IS NOT NULL AS \"rolledBack\" FROM public._prisma_migrations WHERE migration_name = '" + CATALOG_MIGRATION + "'";
const DATABASE_SQL = 'SELECT current_database() AS "database"';

function loadExpectedCatalog(sql = readFileSync(
  join(__dirname, '..', 'prisma', 'migrations', CATALOG_MIGRATION, 'migration.sql'),
  'utf8',
)) {
  const result = new Map();
  const pattern = /\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/g;
  for (const match of sql.matchAll(pattern)) {
    const [, name, ageMin, ageMax, sortOrder] = match;
    if (result.has(name)) throw new Error('Duplicate category in reviewed migration.');
    result.set(name, {
      ageMin: Number(ageMin),
      ageMax: Number(ageMax),
      sortOrder: Number(sortOrder),
    });
  }
  if (result.size !== 28) throw new Error('Reviewed migration must contain exactly 28 categories.');
  return result;
}

function summarizeCatalog(rows, history, expected) {
  if (!Array.isArray(rows) || !Array.isArray(history)) {
    throw new Error('Invalid database catalog response.');
  }
  const actual = new Map();
  const duplicateNames = [];
  for (const row of rows) {
    if (!row || typeof row.name !== 'string') {
      throw new Error('Invalid category row.');
    }
    if (actual.has(row.name)) duplicateNames.push(row.name);
    actual.set(row.name, row);
  }

  const missing = [];
  const mismatched = [];
  for (const [name, canonical] of expected) {
    const row = actual.get(name);
    if (!row) {
      missing.push(name);
      continue;
    }
    for (const field of ['ageMin', 'ageMax', 'sortOrder']) {
      if (row[field] === null || !Number.isInteger(Number(row[field])) ||
          Number(row[field]) !== canonical[field]) {
        mismatched.push({
          name, field, expected: canonical[field],
          actual: row[field] == null ? null : Number(row[field]),
        });
      }
    }
  }
  const unexpected = [...actual.keys()].filter((name) => !expected.has(name));
  const recorded = history.length === 1 &&
    history[0].name === CATALOG_MIGRATION &&
    history[0].finished === true &&
    history[0].rolledBack === false;
  const migrationStatus = recorded ? 'recorded' :
    history.length === 0 ? 'missing' : 'incomplete';

  return {
    migration: CATALOG_MIGRATION,
    migrationStatus,
    expectedCount: expected.size,
    actualCount: rows.length,
    duplicateNames,
    missing,
    unexpected,
    mismatched,
    ready: recorded && duplicateNames.length === 0 &&
      missing.length === 0 && unexpected.length === 0 && mismatched.length === 0,
  };
}

async function auditCategoryCatalog(env, createClient, expected = loadExpectedCatalog()) {
  checkNeonEnvironment(env);
  if (typeof createClient !== 'function') throw new Error('A database client factory is required.');
  let client;
  try {
    client = createClient(env.DIRECT_URL);
    // Fixed, parameter-free SELECT statements only. No arbitrary SQL inputs.
    const databaseRows = await client.$queryRawUnsafe(DATABASE_SQL);
    const expectedDatabase = decodeURIComponent(new URL(env.DIRECT_URL).pathname.slice(1));
    if (!Array.isArray(databaseRows) || databaseRows.length !== 1 ||
        databaseRows[0]?.database !== expectedDatabase) {
      throw new Error('Unexpected database.');
    }
    const rows = await client.$queryRawUnsafe(CATALOG_SQL);
    const history = await client.$queryRawUnsafe(HISTORY_SQL);
    return summarizeCatalog(rows, history, expected);
  } catch {
    // Driver failures may include private connection strings. Never relay them.
    throw new Error('Read-only category audit could not verify the selected Neon database.');
  } finally {
    await Promise.allSettled([client?.$disconnect()]);
  }
}

async function main() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const result = await auditCategoryCatalog(process.env, (url) =>
      new PrismaClient({ datasources: { db: { url } }, log: [] }));
    process.stdout.write(JSON.stringify(result) + '\n');
    if (!result.ready) process.exitCode = 2;
  } catch (error) {
    process.stderr.write('Category audit failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
module.exports = {
  CATALOG_SQL, HISTORY_SQL, DATABASE_SQL, CATALOG_MIGRATION,
  loadExpectedCatalog, summarizeCatalog, auditCategoryCatalog,
};

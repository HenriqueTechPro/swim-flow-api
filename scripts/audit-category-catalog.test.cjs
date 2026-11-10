'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  CATALOG_MIGRATION, CATALOG_SQL, HISTORY_SQL, DATABASE_SQL,
  loadExpectedCatalog, summarizeCatalog, auditCategoryCatalog,
} = require('./audit-category-catalog.cjs');

const env = Object.freeze({
  DATABASE_URL: 'postgresql://fictional:fictional@ep-demo-pooler.us-east-1.aws.neon.tech/swimflow?sslmode=require',
  DIRECT_URL: 'postgresql://fictional:fictional@ep-demo.us-east-1.aws.neon.tech/swimflow?sslmode=require',
});
const expected = loadExpectedCatalog();
const rows = [...expected].map(([name, item]) => ({ name, ...item }));
const successfulHistory = [{ name: CATALOG_MIGRATION, finished: true, rolledBack: false }];

function fixture(options = {}) {
  const queries = [];
  let disconnects = 0;
  const client = {
    $queryRawUnsafe: async (sql) => {
      queries.push(sql);
      if (options.fail) throw new Error('PRIVATE_CREDENTIAL_DO_NOT_LOG');
      if (sql === DATABASE_SQL) return [{ database: options.database || 'swimflow' }];
      if (sql === CATALOG_SQL) return options.rows || rows;
      if (sql === HISTORY_SQL) return options.history || successfulHistory;
      throw new Error('Unexpected SQL');
    },
    $disconnect: async () => { disconnects += 1; },
  };
  return { createClient: () => client, queries, disconnected: () => disconnects };
}

test('reads the 28 canonical rows from the reviewed, existing Prisma migration', () => {
  assert.equal(expected.size, 28);
  assert.deepEqual(expected.get('Sênior'), { ageMin: 20, ageMax: 24, sortOrder: 12 });
  assert.deepEqual(expected.get('Master B'), { ageMin: 30, ageMax: 34, sortOrder: 15 });
});

test('flags missing migration even when all 28 catalog rows already exist', () => {
  const summary = summarizeCatalog(rows, [], expected);
  assert.equal(summary.actualCount, 28);
  assert.equal(summary.migrationStatus, 'missing');
  assert.equal(summary.ready, false);
  assert.deepEqual(summary.mismatched, []);
});

test('reports legacy order mismatch without modifying existing categories', () => {
  const altered = rows.map((row) =>
    row.name === 'Sênior' ? { ...row, sortOrder: 11 } :
    row.name === 'Master B' ? { ...row, sortOrder: 12 } : row);
  const snapshot = JSON.stringify(altered);
  const summary = summarizeCatalog(altered, successfulHistory, expected);
  assert.deepEqual(summary.mismatched.map((x) => [x.name, x.field, x.expected, x.actual]), [
    ['Sênior', 'sortOrder', 12, 11],
    ['Master B', 'sortOrder', 15, 12],
  ]);
  assert.equal(summary.ready, false);
  assert.equal(JSON.stringify(altered), snapshot);
});

test('detects missing, duplicated and unexpected category names without repairing them', () => {
  const modified = rows.slice(1).concat([rows[1], { name: 'Not-a-category', ageMin: 1, ageMax: 2, sortOrder: 99 }]);
  const summary = summarizeCatalog(modified, successfulHistory, expected);
  assert.deepEqual(summary.missing, ['Pré-Mirim']);
  assert.deepEqual(summary.duplicateNames, ['Mirim 1']);
  assert.deepEqual(summary.unexpected, ['Not-a-category']);
  assert.equal(summary.ready, false);
});

test('accepts a successful retry after an explicitly rolled-back Prisma attempt', () => {
  const history = [
    { name: CATALOG_MIGRATION, finished: false, rolledBack: true },
    { name: CATALOG_MIGRATION, finished: true, rolledBack: false },
  ];
  const result = summarizeCatalog(rows, history, expected);
  assert.equal(result.migrationStatus, 'recorded');
  assert.equal(result.ready, true);
});

test('rejects unresolved failed attempts, even after another successful attempt', () => {
  const failed = { name: CATALOG_MIGRATION, finished: false, rolledBack: false };
  const succeeded = { name: CATALOG_MIGRATION, finished: true, rolledBack: false };
  for (const history of [[failed], [failed, succeeded]]) {
    const result = summarizeCatalog(rows, history, expected);
    assert.equal(result.migrationStatus, 'incomplete');
    assert.equal(result.ready, false);
  }
});

test('does not mistake rolled-back-only history for a recorded migration', () => {
  const result = summarizeCatalog(rows, [
    { name: CATALOG_MIGRATION, finished: false, rolledBack: true },
  ], expected);
  assert.equal(result.migrationStatus, 'incomplete');
  assert.equal(result.ready, false);
});

test('success only when the catalog and successful migration history match', async () => {
  const mock = fixture();
  const summary = await auditCategoryCatalog(env, mock.createClient, expected);
  assert.equal(summary.ready, true);
  assert.equal(summary.migrationStatus, 'recorded');
  assert.deepEqual(mock.queries, [DATABASE_SQL, CATALOG_SQL, HISTORY_SQL]);
  assert.ok(mock.queries.every((sql) => /^SELECT\b/i.test(sql)));
  assert.ok(mock.queries.every((sql) => !/\b(UPDATE|INSERT|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(sql)));
  assert.equal(mock.disconnected(), 1);
});

test('rejects wrong database and sanitizes driver failures with guaranteed disconnect', async () => {
  for (const scenario of [{ database: 'wrong' }, { fail: true }]) {
    const mock = fixture(scenario);
    await assert.rejects(auditCategoryCatalog(env, mock.createClient, expected),
      (error) => error instanceof Error && /Read-only category audit/.test(error.message) &&
        !error.message.includes('PRIVATE_CREDENTIAL_DO_NOT_LOG'));
    assert.equal(mock.disconnected(), 1);
  }
});

test('rejects invalid Neon endpoint before a connection is opened', async () => {
  let opened = false;
  await assert.rejects(auditCategoryCatalog(
    { ...env, DATABASE_URL: env.DIRECT_URL },
    () => { opened = true; throw new Error('should not connect'); },
    expected,
  ), /pooled Neon host/);
  assert.equal(opened, false);
});

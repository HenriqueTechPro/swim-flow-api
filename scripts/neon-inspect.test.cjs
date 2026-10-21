'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { inspectNeonDatabase } = require('./neon-inspect.cjs');

const env = Object.freeze({
  DATABASE_URL: 'postgresql://test:fictional@ep-pool-pooler.us-east-1.aws.neon.tech/swimflow?sslmode=require',
  DIRECT_URL: 'postgresql://test:fictional@ep-pool.us-east-1.aws.neon.tech/swimflow?sslmode=require',
});

function fixtures({ relations = 0, enums = 0, directDatabase = 'swimflow',
  pooledDatabase = 'swimflow', failDirect = false, failPooled = false } = {}) {
  const calls = [];
  const disconnected = [];
  const clients = (url) => {
    const pooled = url.includes('-pooler.');
    return {
      $queryRawUnsafe: async (sql) => {
        calls.push({ pooled, sql });
        if (pooled && failPooled) throw new Error('PASSWORD_SHOULD_NEVER_LEAK');
        if (!pooled && failDirect) throw new Error('PASSWORD_SHOULD_NEVER_LEAK');
        return [pooled ? { database: pooledDatabase } :
          { database: directDatabase, relations, enums }];
      },
      $disconnect: async () => { disconnected.push(pooled ? 'pooled' : 'direct'); },
    };
  };
  return { clients, calls, disconnected };
}

test('connects direct and pooled Neon URLs with fixed SELECTs, reports empty only when both counts are zero', async () => {
  const mock = fixtures();
  const result = await inspectNeonDatabase(env, mock.clients);
  assert.deepEqual(result, {
    direct: 'connected', pooled: 'connected', candidateEmpty: true,
    userRelations: 0, userEnums: 0,
  });
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(mock.calls.map(x => x.pooled), [false, true]);
  assert.ok(mock.calls.every(x => /^\s*SELECT\b/i.test(x.sql)));
  assert.ok(mock.calls.every(x => !/\b(INSERT|DELETE|UPDATE|CREATE|DROP|ALTER|TRUNCATE)\b/i.test(x.sql)));
  assert.deepEqual(mock.disconnected.sort(), ['direct', 'pooled']);
});

test('reports nonempty on any existing user relation or enum', async () => {
  for (const sample of [{ relations: 1 }, { enums: 1 }, { relations: 2, enums: 2 }]) {
    const mock = fixtures(sample);
    const result = await inspectNeonDatabase(env, mock.clients);
    assert.equal(result.candidateEmpty, false);
    assert.equal(result.userRelations, sample.relations || 0);
    assert.equal(result.userEnums, sample.enums || 0);
  }
});

test('rejects unexpected database response even if endpoints are syntactically valid', async () => {
  for (const config of [
    { pooledDatabase: 'different' },
    { directDatabase: 'different' },
    { relations: -1 },
  ]) {
    const mock = fixtures(config);
    await assert.rejects(
      inspectNeonDatabase(env, mock.clients),
      /inspection could not verify/,
    );
    assert.deepEqual(mock.disconnected.sort(), ['direct', 'pooled']);
  }
});

test('errors never leak Prisma credentials and both clients disconnect after failure', async () => {
  for (const fail of [{ failDirect: true }, { failPooled: true }]) {
    const mock = fixtures(fail);
    await assert.rejects(inspectNeonDatabase(env, mock.clients), (error) =>
      error instanceof Error &&
      !error.message.includes('PASSWORD_SHOULD_NEVER_LEAK') &&
      !error.message.includes('fictional'));
    assert.deepEqual(mock.disconnected.sort(), ['direct', 'pooled']);
  }
});

test('invalid config is rejected without opening any database connection', async () => {
  let opened = false;
  await assert.rejects(
    inspectNeonDatabase({ ...env, DATABASE_URL: env.DIRECT_URL }, () => {
      opened = true;
      throw new Error('Should not run');
    }),
    /pooled Neon host/,
  );
  assert.equal(opened, false);
});

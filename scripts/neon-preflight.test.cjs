'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  checkNeonConfiguration,
  inspectEmptyNeonDatabase,
  run,
} = require('./neon-preflight.cjs');

const valid = {
  DATABASE_URL: 'postgresql://app:mock-secret@ep-project-123-pooler.c-2.us-east-2.aws.neon.tech/swimflow?sslmode=require&connection_limit=1',
  DIRECT_URL: 'postgresql://app:mock-secret@ep-project-123.c-2.us-east-2.aws.neon.tech/swimflow?sslmode=require',
};

test('validates matching pooled/direct Neon URLs, TLS and single database', () => {
  assert.deepEqual(checkNeonConfiguration(valid), {
    valid: true, provider: 'neon-postgresql', tls: true, sameDatabase: true,
  });
});

test('rejects local/Supabase/plaintext credentials and unsafe migration target', () => {
  const bad = [
    { DATABASE_URL: valid.DATABASE_URL.replace('.neon.tech', '.supabase.co') },
    { DIRECT_URL: valid.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DIRECT_URL: valid.DIRECT_URL.replace('swimflow', 'postgres') },
    { DIRECT_URL: valid.DIRECT_URL.replace('swimflow', 'swimflow?schema=tenant&foo=x') },
    { DATABASE_URL: valid.DATABASE_URL.replace('-pooler.', '.') },
    { DIRECT_URL: valid.DIRECT_URL.replace('ep-project-123.', 'ep-other-321.') },
    { DIRECT_URL: valid.DIRECT_URL.replace('app:', 'different:') },
    { DIRECT_URL: valid.DIRECT_URL.replace('mock-secret', 'other-secret') },
    { DIRECT_URL: valid.DIRECT_URL.replace('swimflow', 'otherschema') },
    { DIRECT_URL: 'not-a-connection-url' },
    { DIRECT_URL: undefined },
  ];
  for (const change of bad) {
    assert.throws(() => checkNeonConfiguration({ ...valid, ...change }));
  }
});

test('all errors are redacted, including invalid connection attempts', async () => {
  const secret = 'DO-NOT-LEAK-CREDENTIAL';
  const paired = {
    DATABASE_URL: valid.DATABASE_URL.replace('mock-secret', secret),
    DIRECT_URL: valid.DIRECT_URL.replace('mock-secret', secret),
  };
  await assert.rejects(
    run(['--connect'], paired, () => { throw new Error('password=' + secret); }),
    (error) => !error.message.includes(secret) && /initialize/.test(error.message),
  );
  const client = {
    $queryRawUnsafe: async () => { throw new Error('db-url password=' + secret); },
    $disconnect: async () => { throw new Error('disconnection password=' + secret); },
  };
  await assert.rejects(
    run(['--connect'], paired, () => client),
    (error) => !error.message.includes(secret) && /Unable to verify/.test(error.message),
  );
});

test('default and --check mode never contacts the network', async () => {
  let calls = 0;
  const factory = () => { calls++; throw new Error('must not open database'); };
  await run([], valid, factory);
  await run(['--check'], valid, factory);
  assert.equal(calls, 0);
});

test('explicit --connect uses direct URL and read-only catalog query', async () => {
  let statement;
  let disconnected = 0;
  const db = {
    $queryRawUnsafe: async (sql) => {
      statement = sql;
      return [];
    },
    $disconnect: async () => { disconnected++; },
  };
  await run(['--connect'], valid, (url) => {
    assert.equal(url, valid.DIRECT_URL);
    return db;
  });
  assert.match(statement, /^SELECT 1 AS present FROM pg_class/);
  assert.match(statement, /UNION ALL SELECT 1 AS present FROM pg_type/);
  assert.match(statement, /pg_namespace/);
  assert.doesNotMatch(statement, /\b(?:INSERT|UPDATE|DELETE|DROP|CREATE)\b/i);
  assert.equal(disconnected, 1);
});

test('rejects a nonempty schema before initial Prisma baseline and disconnects', async () => {
  let disconnects = 0;
  const db = {
    $queryRawUnsafe: async () => [{ table_name: 'profiles' }],
    $disconnect: async () => { disconnects++; },
  };
  await assert.rejects(run(['--connect'], valid, () => db), /existing tables/);
  assert.equal(disconnects, 1);
});

test('invalid flags and malformed config do not contact Neon', async () => {
  await assert.rejects(run(['--migrate'], valid), /Usage/);
  await assert.rejects(run(['--connect'], { ...valid, DIRECT_URL: undefined }), /DIRECT_URL/);
  await assert.rejects(
    inspectEmptyNeonDatabase({ $queryRawUnsafe: async () => 'not rows' }),
    /Unexpected catalog response/,
  );
});

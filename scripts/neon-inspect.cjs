#!/usr/bin/env node
'use strict';

/**
 * Read-only inspection of a candidate Neon database. Never creates tables,
 * applies migrations, reads application data, or prints database credentials.
 * No connection is attempted by unit tests.
 */
const { checkNeonEnvironment } = require('./neon-preflight.cjs');

const DIRECT_PROBE = `
SELECT
  current_database() AS "database",
  (SELECT COUNT(*)::integer
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%'
      AND n.nspname NOT IN ('information_schema', 'neon', 'neon_monitor')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  ) AS "relations",
  (SELECT COUNT(*)::integer
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname NOT LIKE 'pg_%'
      AND n.nspname NOT IN ('information_schema', 'neon', 'neon_monitor')
      AND t.typtype = 'e'
  ) AS "enums"
`;
const POOLED_PROBE = 'SELECT current_database() AS "database"';

function requireSingleRow(rows, expectedDatabase) {
  if (!Array.isArray(rows) || rows.length !== 1 ||
    rows[0] === null || typeof rows[0] !== 'object' ||
    rows[0].database !== expectedDatabase) {
    throw new Error('The connection did not verify the expected database.');
  }
  return rows[0];
}

function requireCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Database inspection returned an invalid object count.');
  }
  return count;
}

async function inspectNeonDatabase(env, createClient) {
  checkNeonEnvironment(env);
  if (typeof createClient !== 'function') {
    throw new Error('Database inspection requires a database client factory.');
  }
  const expectedDatabase = new URL(env.DIRECT_URL).pathname.slice(1);
  let direct;
  let pooled;
  try {
    direct = createClient(env.DIRECT_URL);
    pooled = createClient(env.DATABASE_URL);
    // These two calls are fixed, parameter-free SELECT statements.
    // Never interpolate user input or execute migration commands.
    const directRows = await direct.$queryRawUnsafe(DIRECT_PROBE);
    const pooledRows = await pooled.$queryRawUnsafe(POOLED_PROBE);
    const directRow = requireSingleRow(directRows, expectedDatabase);
    requireSingleRow(pooledRows, expectedDatabase);
    const relations = requireCount(directRow.relations);
    const enums = requireCount(directRow.enums);
    return {
      direct: 'connected',
      pooled: 'connected',
      candidateEmpty: relations === 0 && enums === 0,
      userRelations: relations,
      userEnums: enums,
    };
  } catch {
    // Prisma errors can contain connection details. Never relay them.
    throw new Error('Neon inspection could not verify both connections and schema state.');
  } finally {
    // Cleanup is essential when an earlier probe fails. Never mask the result
    // with a secondary disconnect error.
    await Promise.allSettled([
      direct?.$disconnect(),
      pooled?.$disconnect(),
    ]);
  }
}

async function main() {
  try {
    // Lazy loading keeps pure unit tests independent of generated Prisma client.
    const { PrismaClient } = require('@prisma/client');
    const result = await inspectNeonDatabase(process.env, (url) =>
      new PrismaClient({
        datasources: { db: { url } },
        // Do not emit Prisma engine connection errors to CLI logs:
        // they may include private hostnames or database identifiers.
        log: [],
      }),
    );
    // No hostname, username, database name, password or connection string.
    process.stdout.write(JSON.stringify(result) + '\n');
    if (!result.candidateEmpty) {
      process.stderr.write(
        'Neon contains existing user relations or enums. Do not apply the initial migration; review the destination manually.\n',
      );
      process.exitCode = 2;
    }
  } catch (error) {
    // Only known messages from our own validator/inspection are emitted.
    process.stderr.write('Neon read-only inspection failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
module.exports = {
  inspectNeonDatabase,
  requireCount,
  requireSingleRow,
  DIRECT_PROBE,
  POOLED_PROBE,
};

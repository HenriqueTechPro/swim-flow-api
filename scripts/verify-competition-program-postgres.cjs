#!/usr/bin/env node
'use strict';

// Only for the GitHub Actions disposable PostgreSQL database.
// This verifies structural separation without touching sporting history.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const connection = process.env.DATABASE_URL || '';
let parsed;
try {
  parsed = new URL(connection);
} catch {
  throw new Error('Expected a disposable local PostgreSQL URL');
}
if (
  process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes' ||
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  parsed.pathname !== '/swimflow'
) {
  throw new Error(
    'Refusing non-disposable DB; requires SWIMFLOW_DISPOSABLE_DB=yes and localhost/swimflow',
  );
}

const db = new PrismaClient();
const eventId = randomUUID();
const poolIds = [];
const waterIds = [];

async function expectCode(action, code, reason) {
  await assert.rejects(action, (error) => {
    assert.equal(error?.code, code, reason + ': expected Prisma error ' + code);
    return true;
  });
}

async function expectSqlCheck(action, reason) {
  await assert.rejects(action, (error) => {
    assert.equal(error?.code, 'P2010', reason + ': expected a raw DB constraint error');
    assert.equal(error?.meta?.code, '23514', reason + ': expected PostgreSQL CHECK violation');
    return true;
  });
}

async function main() {
  const baseline = {
    poolResults: await db.poolResult.count(),
    openWaterResults: await db.openWaterResult.count(),
  };
  assert.equal(await db.poolProgramRace.count(), 0, 'New pool race table must start empty');
  assert.equal(await db.openWaterProgramRace.count(), 0, 'New water race table must start empty');

  try {
    await db.event.create({
      data: {
        id: eventId,
        title: 'Temporary CI Festival — not sporting data',
        type: 'Festival',
        date: new Date('2026-11-06T00:00:00.000Z'),
        startTime: new Date('1970-01-01T08:00:00.000Z'),
        endTime: new Date('1970-01-01T12:00:00.000Z'),
        location: 'Disposable DB',
        status: 'Concluido',
      },
    });

    const poolDefinition = {
      eventId,
      sessionCode: 'MORNING',
      raceNumber: 1,
      style: 'Livre',
      distanceMeters: 50,
      poolLengthMeters: '20.00',
      format: 'INDIVIDUAL',
      categorySnapshot: 'Petiz 2',
      genderScope: 'FEMININO',
    };
    const pool = await db.poolProgramRace.create({ data: poolDefinition });
    poolIds.push(pool.id);

    // Same event/session/race number in OPEN WATER is not a pool race collision.
    // A course identity never receives a pool length or a pool style.
    const waterDefinition = {
      eventId,
      sessionCode: 'MORNING',
      raceNumber: 1,
      distanceMeters: 1500,
      bodyType: 'SEA',
      routeKey: 'beach-loop-2026',
      format: 'TRAVESSIA',
      categorySnapshot: 'Petiz 2',
      genderScope: 'FEMININO',
    };
    const water = await db.openWaterProgramRace.create({ data: waterDefinition });
    waterIds.push(water.id);
    assert.equal(pool.eventId, water.eventId);
    assert.notEqual(pool.id, water.id);
    assert.equal(Number(pool.poolLengthMeters), 20);
    assert.equal(water.routeKey, 'beach-loop-2026');

    await expectCode(
      () => db.poolProgramRace.create({ data: poolDefinition }),
      'P2002',
      'Duplicate race in same event and session',
    );
    await expectCode(
      () => db.openWaterProgramRace.create({ data: waterDefinition }),
      'P2002',
      'Duplicate water course in same event and session',
    );

    const nextPool = await db.poolProgramRace.create({
      data: { ...poolDefinition, raceNumber: 2, poolLengthMeters: '25.00' },
    });
    poolIds.push(nextPool.id);
    assert.notEqual(Number(pool.poolLengthMeters), Number(nextPool.poolLengthMeters));
    const nextSession = await db.poolProgramRace.create({
      data: { ...poolDefinition, sessionCode: 'AFTERNOON' },
    });
    poolIds.push(nextSession.id);

    const poolHeat = await db.poolProgramHeat.create({
      data: { raceId: pool.id, heatNumber: 1 },
    });
    const waterStart = await db.openWaterProgramStart.create({
      data: { raceId: water.id, waveNumber: 1 },
    });
    assert.equal(poolHeat.plannedStartAt, null);
    assert.equal(waterStart.plannedStartAt, null);

    await expectCode(
      () => db.poolProgramHeat.create({ data: { raceId: pool.id, heatNumber: 1 } }),
      'P2002',
      'Same pool race cannot have duplicate heat number',
    );
    await expectCode(
      () => db.openWaterProgramStart.create({ data: { raceId: water.id, waveNumber: 1 } }),
      'P2002',
      'Same open-water race cannot have duplicate start number',
    );
    await expectCode(
      () => db.poolProgramHeat.create({ data: { raceId: water.id, heatNumber: 3 } }),
      'P2003',
      'An open-water race ID must not be accepted by pool heat FK',
    );
    await expectCode(
      () => db.openWaterProgramStart.create({ data: { raceId: pool.id, waveNumber: 3 } }),
      'P2003',
      'A pool race ID must not be accepted by open-water start FK',
    );

    await expectSqlCheck(
      () => db.$executeRawUnsafe(
        'UPDATE "pool_program_races" SET "distance_meters" = 0 WHERE "id" = $1::uuid',
        pool.id,
      ),
      'Pool distance must stay positive',
    );
    await expectSqlCheck(
      () => db.$executeRawUnsafe(
        'UPDATE "open_water_program_races" SET "route_key" = \'  \' WHERE "id" = $1::uuid',
        water.id,
      ),
      'Water route key must be identifiable',
    );
    await expectSqlCheck(
      () => db.$executeRawUnsafe(
        'UPDATE "pool_program_heats" SET "heat_number" = 0 WHERE "id" = $1::uuid',
        poolHeat.id,
      ),
      'Pool heat number must be positive',
    );
    await expectSqlCheck(
      () => db.$executeRawUnsafe(
        'UPDATE "open_water_program_starts" SET "wave_number" = 0 WHERE "id" = $1::uuid',
        waterStart.id,
      ),
      'Open-water start number must be positive',
    );
    await expectCode(
      () => db.event.delete({ where: { id: eventId } }),
      'P2003',
      'A scheduled event may not be silently deleted',
    );

    assert.equal(await db.poolResult.count(), baseline.poolResults);
    assert.equal(await db.openWaterResult.count(), baseline.openWaterResults);
    console.log(
      'PASS: independent pool races/heats and open-water routes/starts; ' +
      'FKs, uniqueness, positive checks and unchanged sporting-result counts',
    );
  } finally {
    // Dispose only our own fixture. Never delete historical results.
    await db.poolProgramHeat.deleteMany({ where: { raceId: { in: poolIds } } });
    await db.openWaterProgramStart.deleteMany({ where: { raceId: { in: waterIds } } });
    await db.poolProgramRace.deleteMany({ where: { eventId } });
    await db.openWaterProgramRace.deleteMany({ where: { eventId } });
    await db.event.deleteMany({ where: { id: eventId } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});

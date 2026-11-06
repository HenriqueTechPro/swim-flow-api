import {
  createPoolProgramRaceSchema,
  createOpenWaterProgramRaceSchema,
  createPoolProgramHeatSchema,
  createOpenWaterProgramStartSchema,
  programRaceListSchema,
} from './competition-program';

describe('Separated competition program contracts', () => {
  const common = {
    eventId: '88888888-8888-4888-8888-888888888888',
    sessionCode: 'MANHA',
    raceNumber: 3,
    distanceMeters: 50,
    categorySnapshot: 'Petiz 2',
    genderScope: 'FEMININO',
  } as const;

  it('accepts a 20m pool race, preserving its exact course length', () => {
    const parsed = createPoolProgramRaceSchema.parse({
      ...common,
      style: 'Livre',
      poolLengthMeters: 20,
    });
    expect(parsed).toMatchObject({
      poolLengthMeters: 20,
      style: 'Livre',
      format: 'INDIVIDUAL',
    });
    expect('routeKey' in parsed).toBe(false);
  });

  it('accepts an open-water course with route, body and no pool length', () => {
    const parsed = createOpenWaterProgramRaceSchema.parse({
      ...common,
      distanceMeters: 1500,
      bodyType: 'SEA',
      routeKey: 'beach-loop-2026',
    });
    expect(parsed).toMatchObject({
      routeKey: 'beach-loop-2026',
      bodyType: 'SEA',
      format: 'TRAVESSIA',
    });
    expect('poolLengthMeters' in parsed).toBe(false);
  });

  it('rejects mixing water metadata into pools or a pool length into open water', () => {
    expect(
      createPoolProgramRaceSchema.safeParse({
        ...common,
        style: 'Livre',
        poolLengthMeters: 25,
        routeKey: 'wrong',
      }).success,
    ).toBe(false);
    expect(
      createOpenWaterProgramRaceSchema.safeParse({
        ...common,
        bodyType: 'SEA',
        routeKey: 'sea',
        poolLengthMeters: 25,
      }).success,
    ).toBe(false);
  });

  it('requires positive sport numbers and explicit category and gender snapshots', () => {
    expect(
      createPoolProgramRaceSchema.safeParse({
        ...common,
        style: 'Livre',
        poolLengthMeters: 0,
      }).success,
    ).toBe(false);
    expect(
      createPoolProgramRaceSchema.safeParse({
        ...common,
        style: 'Livre',
        poolLengthMeters: 25,
        raceNumber: 0,
      }).success,
    ).toBe(false);
    expect(
      createOpenWaterProgramRaceSchema.safeParse({
        ...common,
        bodyType: 'SEA',
        routeKey: ' ',
      }).success,
    ).toBe(false);
    expect(
      createOpenWaterProgramRaceSchema.safeParse({
        ...common,
        bodyType: 'SEA',
        routeKey: 'route',
        genderScope: 'UNKNOWN',
      }).success,
    ).toBe(false);
  });

  it('only accepts heat and start identities for the correct route', () => {
    const pool = createPoolProgramHeatSchema.parse({
      raceId: common.eventId,
      heatNumber: 1,
      plannedStartAt: '2026-11-06T14:00:00-03:00',
    });
    const openWater = createOpenWaterProgramStartSchema.parse({
      raceId: common.eventId,
      waveNumber: 1,
    });
    expect(pool).toMatchObject({ heatNumber: 1 });
    expect(openWater).toMatchObject({ waveNumber: 1 });
    expect(
      createPoolProgramHeatSchema.safeParse({
        raceId: common.eventId,
        waveNumber: 1,
      }).success,
    ).toBe(false);
    expect(
      createOpenWaterProgramStartSchema.safeParse({
        raceId: common.eventId,
        heatNumber: 1,
      }).success,
    ).toBe(false);
  });

  it('requires exact event UUID and bounded pagination', () => {
    expect(
      programRaceListSchema.parse({ eventId: common.eventId }),
    ).toMatchObject({
      page: 1,
      perPage: 20,
    });
    expect(
      programRaceListSchema.safeParse({ eventId: common.eventId, perPage: 101 })
        .success,
    ).toBe(false);
    expect(
      programRaceListSchema.safeParse({ eventId: 'any text' }).success,
    ).toBe(false);
    expect(programRaceListSchema.safeParse({}).success).toBe(false);
  });
});

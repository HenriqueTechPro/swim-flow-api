import {
  CompetitiveResultPolicy,
  type OpenWaterResultInput,
  type PoolResultInput,
} from './competitive-result.policy';

const pool: PoolResultInput = {
  discipline: 'POOL',
  studentId: 'student-1',
  distanceMeters: 100,
  poolLengthMeters: 25,
  style: 'Livre',
  status: 'CLASSIFIED',
  format: 'INDIVIDUAL',
  durationMs: 64_570,
  position: 2,
};

const openWater: OpenWaterResultInput = {
  discipline: 'OPEN_WATER',
  studentId: 'student-1',
  distanceMeters: 1500,
  routeKey: 'village-itaparica-2026',
  bodyType: 'SEA',
  status: 'CLASSIFIED',
  format: 'TRAVESSIA',
  durationMs: 1_320_000,
  position: 4,
};

describe('CompetitiveResultPolicy', () => {
  it('separates pool and open water at the type and policy level', () => {
    expect(CompetitiveResultPolicy.automaticPersonalBestKey(pool))
      .toBe('POOL:Livre:100:25.00');
    expect(CompetitiveResultPolicy.automaticPersonalBestKey(openWater))
      .toBeNull();
  });

  it('does not compare short-course and long-course pool results', () => {
    expect(CompetitiveResultPolicy.automaticPersonalBestKey(pool))
      .not.toBe(
        CompetitiveResultPolicy.automaticPersonalBestKey({
          ...pool,
          poolLengthMeters: 50,
        }),
      );
  });

  it('supports valid 20m pools but does not assume them equal to 25m pools', () => {
    expect(CompetitiveResultPolicy.automaticPersonalBestKey({
      ...pool,
      poolLengthMeters: 20,
    })).toBe('POOL:Livre:100:20.00');
  });

  it('does not invent an automatic PB for an unknown pool or a relay', () => {
    expect(CompetitiveResultPolicy.automaticPersonalBestKey({
      ...pool, poolLengthMeters: null,
    })).toBeNull();
    expect(CompetitiveResultPolicy.automaticPersonalBestKey({
      ...pool, format: 'RELAY',
    })).toBeNull();
  });

  it('rejects an invalid zero or negative race distance', () => {
    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...pool, distanceMeters: 0 }),
    ).toThrow('distanceMeters');
    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...openWater, distanceMeters: -10 }),
    ).toThrow('distanceMeters');
  });

  it('stores missing durations as null only for non-classified outcomes', () => {
    expect(() =>
      CompetitiveResultPolicy.assertValid({
        ...openWater, status: 'DID_NOT_START', durationMs: null, position: null,
      }),
    ).not.toThrow();

    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...pool, durationMs: null }),
    ).toThrow('Classified results require a recorded duration');
  });

  it('rejects placement for disqualified races', () => {
    expect(() =>
      CompetitiveResultPolicy.assertValid({
        ...openWater, status: 'DISQUALIFIED', durationMs: null,
      }),
    ).toThrow('Only classified');
  });

  it('does not accept invalid optional numbers or fabricated zero positions', () => {
    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...pool, poolLengthMeters: Infinity }),
    ).toThrow('poolLengthMeters');
    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...pool, durationMs: 0 }),
    ).toThrow('durationMs');
    expect(() =>
      CompetitiveResultPolicy.assertValid({ ...pool, position: 0 }),
    ).toThrow('position');
  });

  it('groups matching open-water routes descriptively, without treating them as pool PBs', () => {
    expect(CompetitiveResultPolicy.openWaterRouteGroupKey(openWater))
      .toBe('OPEN_WATER:SEA:village-itaparica-2026:1500:TRAVESSIA');
    expect(CompetitiveResultPolicy.openWaterRouteGroupKey({
      ...openWater, routeKey: null,
    })).toBeNull();
  });
});

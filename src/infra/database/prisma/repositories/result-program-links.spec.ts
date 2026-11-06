import { describe, expect, it, jest } from '@jest/globals';
import type { CreateResultRequest } from '@/domain/results/application/dtos/result-requests';
import type { PrismaService } from '../prisma.service';
import { validateProgramLinks } from './result-program-links';

const eventId = '88888888-8888-4888-8888-888888888888';
const poolRaceId = '11111111-1111-4111-8111-111111111111';
const poolHeatId = '22222222-2222-4222-8222-222222222222';

const poolInput: CreateResultRequest = {
  studentId: '77777777-7777-4777-8777-777777777777',
  discipline: 'Piscina',
  competitionType: 'Piscina',
  style: 'Livre',
  distance: '50m',
  poolLengthMeters: 20,
  eventFormat: 'Prova Individual',
  resultStatus: 'Classificado',
  time: '00:35.10',
  date: '2026-11-06',
  category: 'Petiz 2',
};

function mockPrisma() {
  const poolProgramRace = {
    findUnique: jest.fn(async () => ({
      id: poolRaceId,
      eventId,
      style: 'Livre',
      distanceMeters: 50,
      poolLengthMeters: 20,
      format: 'INDIVIDUAL',
      categorySnapshot: 'Petiz 2',
    })),
    count: jest.fn(async () => 0),
  };
  const poolProgramHeat = {
    findUnique: jest.fn(async () => ({ raceId: poolRaceId })),
  };
  const openWaterProgramRace = {
    count: jest.fn(async () => 0),
    findUnique: jest.fn(async () => null),
  };
  const openWaterProgramStart = {
    findUnique: jest.fn(async () => null),
  };
  return {
    client: { poolProgramRace, poolProgramHeat, openWaterProgramRace, openWaterProgramStart } as unknown as PrismaService,
    poolProgramRace, poolProgramHeat, openWaterProgramRace,
  };
}

describe('explicit result-program links', () => {
  it('leaves historical results without program links untouched', async () => {
    const db = mockPrisma();
    await expect(validateProgramLinks(db.client, poolInput, undefined, {})).resolves.toBeUndefined();
    expect(db.poolProgramRace.findUnique).not.toHaveBeenCalled();
    expect(db.poolProgramHeat.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a matching 20m pool race and its heat', async () => {
    const db = mockPrisma();
    await expect(validateProgramLinks(db.client, poolInput, eventId, {
      poolProgramRaceId: poolRaceId, poolProgramHeatId: poolHeatId,
    })).resolves.toBeUndefined();
    expect(db.poolProgramHeat.findUnique).toHaveBeenCalled();
  });

  it('rejects race from another event even if its distance matches', async () => {
    const db = mockPrisma();
    await expect(validateProgramLinks(db.client, poolInput, '99999999-9999-4999-8999-999999999999', {
      poolProgramRaceId: poolRaceId,
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects mixed disciplines and a heat without its race', async () => {
    const db = mockPrisma();
    await expect(validateProgramLinks(db.client, poolInput, eventId, {
      openWaterProgramRaceId: poolRaceId,
    })).rejects.toThrow('Pool results cannot use open-water links');
    await expect(validateProgramLinks(db.client, poolInput, eventId, {
      poolProgramHeatId: poolHeatId,
    })).rejects.toThrow('A pool heat requires the matching pool race');
  });

  it('rejects programs with a conflicting regulatory category', async () => {
    const db = mockPrisma();
    await expect(validateProgramLinks(db.client, { ...poolInput, category: 'Mirim 1' }, eventId, {
      poolProgramRaceId: poolRaceId,
    })).rejects.toThrow('Pool result does not match selected race');
  });
});

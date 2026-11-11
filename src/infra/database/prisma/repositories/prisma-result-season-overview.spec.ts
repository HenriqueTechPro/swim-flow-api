import type { PrismaService } from '../prisma.service';
import { PrismaResultSeasonsRepository } from './prisma-result-seasons-repository';

describe('Prisma season overview (read only)', () => {
  const season = {
    id: '88888888-8888-4888-8888-888888888888',
    year: 2026,
    label: '2026',
    startsOn: new Date('2026-01-01T00:00:00.000Z'),
    endsOn: new Date('2026-12-31T00:00:00.000Z'),
    status: 'ACTIVE' as const,
  };
  const poolCount = jest.fn();
  const openWaterCount = jest.fn();
  const poolRaceCount = jest.fn();
  const openWaterRaceCount = jest.fn();
  const eventCount = jest.fn();
  const eventList = jest.fn();
  const seasonLookup = jest.fn();
  const prisma = {
    season: { findUnique: seasonLookup },
    event: { count: eventCount, findMany: eventList },
    poolResult: { count: poolCount },
    openWaterResult: { count: openWaterCount },
    poolProgramRace: { count: poolRaceCount },
    openWaterProgramRace: { count: openWaterRaceCount },
  };
  const repo = new PrismaResultSeasonsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    seasonLookup.mockResolvedValue(season);
    eventCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    eventList.mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Festival', date: season.startsOn },
    ]);
    poolCount.mockResolvedValueOnce(45).mockResolvedValueOnce(3);
    openWaterCount.mockResolvedValueOnce(20).mockResolvedValueOnce(5);
    poolRaceCount.mockResolvedValue(8);
    openWaterRaceCount.mockResolvedValue(2);
  });

  it('counts stored season links separately by modality and reports unlinked records', async () => {
    const result = await repo.overview(season.id, { discipline: 'all' });
    expect(result).toMatchObject({
      season: { id: season.id, year: 2026 },
      events: { linked: 4, withoutSeasonInPeriod: 2 },
      races: { pool: 8, openWater: 2 },
      results: {
        pool: 45,
        openWater: 20,
        poolWithoutSeasonInPeriod: 3,
        openWaterWithoutSeasonInPeriod: 5,
      },
    });
    expect(prisma.poolResult.count).toHaveBeenNthCalledWith(1, {
      where: { seasonId: season.id },
    });
    expect(prisma.poolResult.count).toHaveBeenNthCalledWith(2, {
      where: {
        seasonId: null,
        heldOn: { gte: season.startsOn, lte: season.endsOn },
      },
    });
    expect(prisma.event.count).toHaveBeenNthCalledWith(2, {
      where: {
        seasonId: null,
        date: { gte: season.startsOn, lte: season.endsOn },
      },
    });
  });

  it('filters results, official race snapshots and event by declared keys', async () => {
    const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await repo.overview(season.id, {
      discipline: 'Piscina',
      eventId,
      category: 'Petiz',
      studentSearch: 'Ana',
    });
    expect(prisma.openWaterResult.count).not.toHaveBeenCalled();
    expect(prisma.openWaterProgramRace.count).not.toHaveBeenCalled();
    expect(prisma.poolResult.count).toHaveBeenCalledWith({
      where: {
        seasonId: season.id,
        eventId,
        categorySnapshot: { contains: 'Petiz', mode: 'insensitive' },
        student: { name: { contains: 'Ana', mode: 'insensitive' } },
      },
    });
    expect(prisma.poolProgramRace.count).toHaveBeenCalledWith({
      where: {
        event: { seasonId: season.id, id: eventId },
        categorySnapshot: { contains: 'Petiz', mode: 'insensitive' },
      },
    });
  });

  it('rejects missing seasons before counting or writing any record', async () => {
    seasonLookup.mockResolvedValue(null);
    await expect(repo.overview(season.id, {})).rejects.toThrow('Season not found');
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.poolResult.count).not.toHaveBeenCalled();
  });
});

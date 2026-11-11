import type { PrismaService } from '../prisma.service';
import { PrismaResultSeasonsRepository } from './prisma-result-seasons-repository';

describe('Historical student composition (Prisma)', () => {
  const seasonId = '88888888-8888-4888-8888-888888888888';
  const season = {
    id: seasonId,
    year: 2026,
    label: '2026',
    startsOn: new Date('2026-01-01T00:00:00.000Z'),
    endsOn: new Date('2026-12-31T00:00:00.000Z'),
    status: 'ACTIVE',
  };
  const lookup = jest.fn();
  const count = jest.fn();
  const repo = new PrismaResultSeasonsRepository({
    season: { findUnique: lookup },
    student: { count },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    lookup.mockResolvedValue(season);
    // Category, union of participants, pool, open-water, class enrollment
    count
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(27)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(43);
  });

  it('counts unique students with stored category, results, and enrollment overlap', async () => {
    const result = await repo.studentComposition(seasonId);
    expect(result).toMatchObject({
      season: { id: seasonId, year: 2026 },
      categoriesRegistered: 60,
      participants: { distinct: 27, pool: 20, openWater: 15 },
      enrolledDuringPeriod: 43,
    });
    expect(count).toHaveBeenNthCalledWith(1, {
      where: { seasonCategories: { some: { seasonId } } },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [
          { poolResults: { some: { seasonId } } },
          { openWaterResults: { some: { seasonId } } },
        ],
      },
    });
    expect(count).toHaveBeenNthCalledWith(3, {
      where: { poolResults: { some: { seasonId } } },
    });
    expect(count).toHaveBeenNthCalledWith(4, {
      where: { openWaterResults: { some: { seasonId } } },
    });
    expect(count).toHaveBeenNthCalledWith(5, {
      where: {
        studentClasses: {
          some: {
            fromDate: { lte: season.endsOn },
            OR: [
              { toDate: null },
              { toDate: { gte: season.startsOn } },
            ],
          },
        },
      },
    });
  });

  it('returns 404 before any student reads when the season does not exist', async () => {
    lookup.mockResolvedValue(null);
    await expect(repo.studentComposition(seasonId)).rejects.toThrow(
      'Season not found',
    );
    expect(count).not.toHaveBeenCalled();
  });
});

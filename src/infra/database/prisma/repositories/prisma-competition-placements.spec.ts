import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaResultsRepository } from './prisma-results-repository';

describe('PrismaResultsRepository recorded competition placements', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const prisma = {
    poolResult: { findMany, count },
    $transaction: jest.fn(
      async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    ),
  };
  const repository = new PrismaResultsRepository(
    prisma as unknown as PrismaService,
    {} as CacheRepository,
    {} as EnvService,
  );
  const query = {
    competition: 'Festival Interno',
    date: '2026-03-31',
    category: 'Petiz 2',
    gender: 'Feminino' as const,
    style: 'Livre' as const,
    distance: '50m',
    poolLengthMeters: 20,
    page: 2,
    perPage: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    count.mockResolvedValue(4);
    findMany.mockResolvedValue([
      {
        id: 'result-a',
        studentId: 'student-a',
        student: { name: 'Ana' },
        position: 3,
        durationMs: 32100,
      },
    ]);
  });

  it('reads exact historical race scope and persists positions, not time ranks', async () => {
    const result = await repository.listCompetitionPlacements(query);
    const where = {
      competitionSnapshot: query.competition,
      heldOn: new Date('2026-03-31T00:00:00.000Z'),
      categorySnapshot: query.category,
      student: { gender: 'Feminino' },
      style: 'Livre',
      distanceMeters: 50,
      poolLengthMeters: 20,
      format: 'INDIVIDUAL',
      status: 'CLASSIFIED',
      durationMs: { gt: 0 },
      position: { gt: 0 },
    };
    expect(findMany).toHaveBeenCalledWith({
      where,
      select: {
        id: true,
        studentId: true,
        student: { select: { name: true } },
        position: true,
        durationMs: true,
      },
      orderBy: [
        { position: 'asc' },
        { durationMs: 'asc' },
        { id: 'asc' },
      ],
      skip: 1,
      take: 1,
    });
    expect(count).toHaveBeenCalledWith({ where });
    expect(result.total).toBe(4);
    expect(result.items[0]).toMatchObject({
      resultId: 'result-a',
      position: 3,
      time: '00:32.10',
      poolLengthMeters: 20,
    });
    expect(result.items[0]).not.toHaveProperty('birthDate');
  });

  it('never invents a position for an inconsistent database row', async () => {
    findMany.mockResolvedValue([
      {
        id: 'result-b',
        studentId: 'student-b',
        student: { name: 'Bia' },
        position: null,
        durationMs: 30000,
      },
    ]);
    await expect(
      repository.listCompetitionPlacements(query),
    ).rejects.toThrow('Invalid stored classified placement');
  });
});

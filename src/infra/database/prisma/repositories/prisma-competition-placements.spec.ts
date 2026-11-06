import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaResultsRepository } from './prisma-results-repository';

describe('PrismaResultsRepository recorded competition placements', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const prisma = {
    poolResult: { findMany, count },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
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
        eventId: null,
        heldOn: new Date('2026-03-31T00:00:00.000Z'),
        competitionSnapshot: 'Festival Interno',
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
      eventId: null,
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
        eventId: true,
        heldOn: true,
        competitionSnapshot: true,
        studentId: true,
        student: { select: { name: true } },
        position: true,
        durationMs: true,
      },
      orderBy: [{ position: 'asc' }, { durationMs: 'asc' }, { id: 'asc' }],
      skip: 1,
      take: 1,
    });
    expect(count).toHaveBeenCalledWith({ where });
    expect(result.total).toBe(4);
    expect(result.items[0]).toMatchObject({
      resultId: 'result-a',
      eventId: null,
      competition: 'Festival Interno',
      date: '2026-03-31',
      position: 3,
      time: '00:32.10',
      poolLengthMeters: 20,
    });
    expect(result.items[0]).not.toHaveProperty('birthDate');
  });

  it('isolates linked rows by event ID regardless of renamed event title', async () => {
    const eventId = '88888888-8888-4888-8888-888888888888';
    findMany.mockResolvedValue([
      {
        id: 'result-a',
        eventId,
        heldOn: new Date('2026-03-31T00:00:00.000Z'),
        competitionSnapshot: 'Original title',
        studentId: 'student-a',
        student: { name: 'Ana' },
        position: 2,
        durationMs: 32000,
      },
    ]);
    const response = await repository.listCompetitionPlacements({
      eventId,
      category: query.category,
      gender: query.gender,
      style: query.style,
      distance: query.distance,
      poolLengthMeters: query.poolLengthMeters,
      page: 1,
      perPage: 20,
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.eventId).toBe(eventId);
    expect(where).not.toHaveProperty('competitionSnapshot');
    expect(where).not.toHaveProperty('heldOn');
    expect(count).toHaveBeenCalledWith({ where });
    expect(response.items[0]).toMatchObject({
      eventId,
      competition: 'Original title',
      date: '2026-03-31',
      position: 2,
    });
  });

  it('rejects missing legacy identity or mixed scopes', async () => {
    const legacy = {
      category: query.category,
      gender: query.gender,
      style: query.style,
      distance: query.distance,
      poolLengthMeters: query.poolLengthMeters,
    };
    await expect(repository.listCompetitionPlacements(legacy)).rejects.toThrow(
      'Legacy placements require competition and date',
    );
    await expect(
      repository.listCompetitionPlacements({
        ...query,
        eventId: '88888888-8888-4888-8888-888888888888',
      }),
    ).rejects.toThrow('Event identity cannot be mixed');
    expect(findMany).not.toHaveBeenCalled();
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
    await expect(repository.listCompetitionPlacements(query)).rejects.toThrow(
      'Invalid stored classified placement',
    );
  });
});

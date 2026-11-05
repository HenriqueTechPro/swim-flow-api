import type { PrismaService } from '../prisma.service';
import { PrismaResultSeasonsRepository } from './prisma-result-seasons-repository';

describe('PrismaResultSeasonsRepository', () => {
  const season2026 = {
    id: '88888888-8888-4888-8888-888888888888',
    year: 2026,
    label: 'Temporada 2025/2026',
    startsOn: new Date('2025-09-01T00:00:00.000Z'),
    endsOn: new Date('2026-08-31T00:00:00.000Z'),
    status: 'ACTIVE' as const,
  };
  const input = {
    year: 2026,
    label: season2026.label,
    startsOn: '2025-09-01',
    endsOn: '2026-08-31',
    status: 'ACTIVE' as const,
  };

  let prisma: {
    season: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let repo: PrismaResultSeasonsRepository;

  const references = {
    studentCategories: 0,
    events: 0,
    poolResults: 0,
    openWaterResults: 0,
  };

  beforeEach(() => {
    prisma = {
      season: {
        findMany: jest.fn().mockResolvedValue([season2026]),
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          year: season2026.year,
          startsOn: season2026.startsOn,
          endsOn: season2026.endsOn,
          _count: references,
        }),
        create: jest.fn().mockResolvedValue(season2026),
        update: jest.fn().mockResolvedValue(season2026),
      },
    };
    repo = new PrismaResultSeasonsRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('paginates and sorts selected season fields', async () => {
    const result = await repo.list({ page: 2, perPage: 1 });
    expect(prisma.season.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        year: true,
        label: true,
        startsOn: true,
        endsOn: true,
        status: true,
      },
      orderBy: [{ year: 'desc' }, { id: 'asc' }],
      skip: 1,
      take: 1,
    });
    expect(result).toEqual({
      items: [
        {
          id: season2026.id,
          year: 2026,
          label: season2026.label,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          status: 'ACTIVE',
        },
      ],
      page: 2,
      perPage: 1,
      total: 3,
    });
  });

  it('returns an empty page without inventing a default season', async () => {
    prisma.season.findMany.mockResolvedValue([]);
    prisma.season.count.mockResolvedValue(0);
    const result = await repo.list();
    expect(result).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
    });
    expect(prisma.season.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('caps the requested page size at 100 in repository callers', async () => {
    await repo.list({ page: 1, perPage: 999 });
    expect(prisma.season.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('creates a season without changing linked records', async () => {
    const created = await repo.create(input);
    expect(prisma.season.findFirst).toHaveBeenCalledWith({
      where: {
        startsOn: { lte: season2026.endsOn },
        endsOn: { gte: season2026.startsOn },
      },
      select: { id: true },
    });
    expect(prisma.season.create).toHaveBeenCalledWith({
      data: {
        year: 2026,
        label: season2026.label,
        startsOn: season2026.startsOn,
        endsOn: season2026.endsOn,
        status: 'ACTIVE',
      },
      select: expect.objectContaining({ id: true, status: true }),
    });
    expect(created).toMatchObject({
      id: season2026.id,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
    });
  });

  it('rejects overlapping periods without writing', async () => {
    prisma.season.findFirst.mockResolvedValueOnce({ id: 'another-season' });
    await expect(repo.create(input)).rejects.toThrow(
      'Season dates overlap with another season',
    );
    expect(prisma.season.create).not.toHaveBeenCalled();
  });

  it('edits label and status with linked records', async () => {
    prisma.season.findUnique.mockResolvedValueOnce({
      year: season2026.year,
      startsOn: season2026.startsOn,
      endsOn: season2026.endsOn,
      _count: { ...references, poolResults: 2 },
    });
    await repo.update(season2026.id, {
      ...input,
      label: 'Novo nome',
      status: 'CLOSED',
    });
    expect(prisma.season.findFirst).not.toHaveBeenCalled();
    expect(prisma.season.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: season2026.id },
        data: expect.objectContaining({
          label: 'Novo nome',
          status: 'CLOSED',
        }),
      }),
    );
  });

  it.each([
    'studentCategories',
    'events',
    'poolResults',
    'openWaterResults',
  ] as const)(
    'locks year and dates when %s is linked',
    async (relation) => {
      prisma.season.findUnique.mockResolvedValue({
        year: season2026.year,
        startsOn: season2026.startsOn,
        endsOn: season2026.endsOn,
        _count: { ...references, [relation]: 1 },
      });
      await expect(
        repo.update(season2026.id, { ...input, endsOn: '2026-12-31' }),
      ).rejects.toThrow('Season year and dates cannot change');
      await expect(
        repo.update(season2026.id, { ...input, year: 2027 }),
      ).rejects.toThrow('Season year and dates cannot change');
      expect(prisma.season.update).not.toHaveBeenCalled();
    },
  );

  it('rejects overlapping date changes on an unlinked season', async () => {
    prisma.season.findFirst.mockResolvedValueOnce({
      id: 'different-season',
    });
    await expect(
      repo.update(season2026.id, { ...input, startsOn: '2025-08-01' }),
    ).rejects.toThrow('Season dates overlap with another season');
    expect(prisma.season.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: season2026.id },
        }),
      }),
    );
    expect(prisma.season.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a season that no longer exists', async () => {
    prisma.season.findUnique.mockResolvedValueOnce(null);
    await expect(repo.update(season2026.id, input)).rejects.toThrow(
      'Season not found',
    );
    expect(prisma.season.update).not.toHaveBeenCalled();
  });
});

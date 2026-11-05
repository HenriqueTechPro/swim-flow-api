import type { PrismaService } from '../prisma.service';
import { PrismaResultSeasonsRepository } from './prisma-result-seasons-repository';

describe('PrismaResultSeasonsRepository', () => {
  const season2026 = {
    id: '88888888-8888-4888-8888-888888888888',
    year: 2026,
    label: 'Temporada 2026',
    startsOn: new Date('2025-09-01T00:00:00.000Z'),
    endsOn: new Date('2026-08-31T00:00:00.000Z'),
    status: 'ACTIVE' as const,
  };

  let prisma: {
    season: { findMany: jest.Mock; count: jest.Mock };
  };
  let repo: PrismaResultSeasonsRepository;

  beforeEach(() => {
    prisma = {
      season: {
        findMany: jest.fn().mockResolvedValue([season2026]),
        count: jest.fn().mockResolvedValue(3),
      },
    };
    repo = new PrismaResultSeasonsRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('returns only season selection fields in paginated, stable order', async () => {
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
          label: 'Temporada 2026',
          startsOn: '2025-09-01',
          endsOn: '2026-08-31',
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
});

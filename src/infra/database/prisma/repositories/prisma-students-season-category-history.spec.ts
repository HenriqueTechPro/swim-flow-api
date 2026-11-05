import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaStudentsRepository } from './prisma-students-repository';

describe('PrismaStudentsRepository season-category history', () => {
  const studentId = '11111111-1111-4111-8111-111111111111';
  const findMany = jest.fn();
  const prisma = { studentSeasonCategory: { findMany } };
  const repository = new PrismaStudentsRepository(
    prisma as unknown as PrismaService,
    {} as CacheRepository,
    {} as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only selected season/category fields ordered by year', async () => {
    findMany.mockResolvedValue([{
      assignedAt: new Date('2026-01-10T12:00:00Z'),
      season: {
        id: '22222222-2222-4222-8222-222222222222',
        year: 2026,
        label: 'Temporada 2026',
        status: 'ACTIVE',
        startsOn: new Date('2026-01-01T00:00:00Z'),
        endsOn: new Date('2026-12-31T00:00:00Z'),
      },
      category: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Mirim_1',
      },
    }]);

    const result = await repository.listSeasonCategories(studentId);
    expect(findMany).toHaveBeenCalledWith({
      where: { studentId },
      select: {
        assignedAt: true,
        season: {
          select: {
            id: true,
            year: true,
            label: true,
            status: true,
            startsOn: true,
            endsOn: true,
          },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ season: { year: 'desc' } }, { assignedAt: 'desc' }],
    });
    expect(result).toEqual([{
      seasonId: '22222222-2222-4222-8222-222222222222',
      year: 2026,
      seasonLabel: 'Temporada 2026',
      seasonStatus: 'ACTIVE',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      categoryId: '33333333-3333-4333-8333-333333333333',
      category: 'Mirim 1',
      assignedAt: '2026-01-10T12:00:00.000Z',
    }]);
    expect(result[0]).not.toHaveProperty('studentId');
    expect(result[0]).not.toHaveProperty('birthDate');
  });

  it('does not invent a season when no assignment exists', async () => {
    findMany.mockResolvedValue([]);
    await expect(repository.listSeasonCategories(studentId)).resolves.toEqual([]);
  });
});

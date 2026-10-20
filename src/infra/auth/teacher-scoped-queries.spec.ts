import type { PrismaService } from '@/infra/database/prisma/prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import { PrismaStudentsRepository } from '@/infra/database/prisma/repositories/prisma-students-repository';
import { PrismaClassesRepository } from '@/infra/database/prisma/repositories/prisma-classes-repository';

const profileId = '88888888-8888-4888-8888-888888888888';

describe('Teacher-scoped collection queries', () => {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const env = { cacheTtlSeconds: 45 };
  const prisma = {
    category: { findMany: jest.fn().mockResolvedValue([]) },
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    swimmingClass: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (promises: Promise<unknown>[]) => Promise.all(promises)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
  });

  it('limits student pages by current class AND authenticated teacher profile', async () => {
    const repository = new PrismaStudentsRepository(
      prisma as unknown as PrismaService,
      cache as unknown as CacheRepository,
      env as EnvService,
    );
    await repository.list({ page: 1, perPage: 20, teacherProfileId: profileId });

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        studentClasses: {
          some: {
            toDate: null,
            swimmingClass: {
              classTeachers: {
                some: { teacher: { profileId, status: 'Ativo' } },
              },
            },
          },
        },
      }),
    }));
    expect(prisma.student.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ studentClasses: expect.any(Object) }),
    }));
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('limits class listings to explicit assignments and partitions teacher cache', async () => {
    const repository = new PrismaClassesRepository(
      prisma as unknown as PrismaService,
      cache as unknown as CacheRepository,
      env as EnvService,
    );
    await repository.list({ page: 1, perPage: 20, teacherProfileId: profileId });

    expect(prisma.swimmingClass.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        classTeachers: {
          some: { teacher: { profileId, status: 'Ativo' } },
        },
      }),
    }));
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('does not accidentally constrain administrator queries to a teacher', async () => {
    const repository = new PrismaStudentsRepository(
      prisma as unknown as PrismaService,
      cache as unknown as CacheRepository,
      env as EnvService,
    );
    await repository.list({ page: 1, perPage: 10 });

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ studentClasses: expect.anything() }),
    }));
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('teacher:admin'),
      expect.any(String),
      45,
    );
  });
});

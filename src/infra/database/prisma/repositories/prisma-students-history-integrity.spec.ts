import { AppError } from '@/shared/errors/app-error';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaStudentsRepository } from './prisma-students-repository';

describe('PrismaStudentsRepository season category integrity', () => {
  const studentId = 'd0ecb783-7543-4cec-93c5-eb3c5ce5d521';
  const seasonId = '75c30c3f-3cff-4b10-9f8c-c1adb27b9f6b';
  const tx = {
    student: {
      update: jest.fn().mockResolvedValue(undefined),
      findUniqueOrThrow: jest.fn(),
    },
    studentSeasonCategory: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    poolResult: { count: jest.fn() },
    openWaterResult: { count: jest.fn() },
    studentGuardian: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    studentClass: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue(undefined),
    },
  };
  const prisma = {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: studentId,
        studentClasses: [],
      }),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
  const repo = new PrismaStudentsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    { cacheTtlSeconds: 60 } as EnvService,
  );
  const input = {
    name: 'Atleta',
    gender: 'Masculino' as const,
    birthDate: '2018-02-10',
    level: 'Iniciante',
    phone: '',
    status: 'Ativo',
    photo: null,
    categoryId: 'cat-new',
    levelId: 'level-1',
    seasonId,
    parentId: null,
    classId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.studentSeasonCategory.findUnique.mockResolvedValue({
      categoryId: 'cat-old',
    });
    tx.poolResult.count.mockResolvedValue(0);
    tx.openWaterResult.count.mockResolvedValue(0);
    tx.student.findUniqueOrThrow.mockResolvedValue({
      id: studentId,
      name: 'Atleta',
      gender: 'Masculino',
      birthDate: new Date('2018-02-10'),
      photo: null,
      phone: '',
      status: 'Ativo',
      achievements: 0,
      category: { name: 'Mirim_1' },
      level: { name: 'Iniciante' },
      guardians: [],
      studentClasses: [],
    });
  });

  it.each([
    ['pool', 1, 0],
    ['open water', 0, 1],
  ])('rejects a changed category with linked %s results', async (
    _discipline,
    poolCount,
    openWaterCount,
  ) => {
    tx.poolResult.count.mockResolvedValue(poolCount);
    tx.openWaterResult.count.mockResolvedValue(openWaterCount);

    await expect(repo.update(studentId, input)).rejects.toMatchObject({
      statusCode: 409,
    });
    const scope = {
      studentId,
      OR: [
        { seasonId },
        { event: { is: { seasonId } } },
      ],
    };
    expect(tx.poolResult.count).toHaveBeenCalledWith({ where: scope });
    expect(tx.openWaterResult.count).toHaveBeenCalledWith({ where: scope });
    expect(tx.student.update).not.toHaveBeenCalled();
    expect(tx.studentSeasonCategory.upsert).not.toHaveBeenCalled();
    expect(tx.studentGuardian.updateMany).not.toHaveBeenCalled();
    expect(cache.deleteMatching).not.toHaveBeenCalled();
  });

  it('allows updates that preserve the recorded season category', async () => {
    tx.studentSeasonCategory.findUnique.mockResolvedValue({
      categoryId: input.categoryId,
    });
    tx.poolResult.count.mockResolvedValue(2);

    await repo.update(studentId, input);

    expect(tx.poolResult.count).not.toHaveBeenCalled();
    expect(tx.studentSeasonCategory.upsert).toHaveBeenCalledWith({
      where: {
        studentId_seasonId: { studentId, seasonId },
      },
      create: {
        studentId,
        seasonId,
        categoryId: input.categoryId,
      },
      update: { categoryId: input.categoryId },
    });
  });

  it('allows corrections without a linked competition result', async () => {
    await repo.update(studentId, input);
    expect(tx.poolResult.count).toHaveBeenCalledTimes(1);
    expect(tx.openWaterResult.count).toHaveBeenCalledTimes(1);
    expect(tx.studentSeasonCategory.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not create old associations when there is no season', async () => {
    await repo.update(studentId, { ...input, seasonId: undefined });
    expect(tx.studentSeasonCategory.findUnique).not.toHaveBeenCalled();
    expect(tx.studentSeasonCategory.upsert).not.toHaveBeenCalled();
    expect(tx.poolResult.count).not.toHaveBeenCalled();
  });

  it('allows first association for a season without rewriting older ones', async () => {
    tx.studentSeasonCategory.findUnique.mockResolvedValue(null);
    await repo.update(studentId, input);
    expect(tx.poolResult.count).not.toHaveBeenCalled();
    expect(tx.studentSeasonCategory.upsert).toHaveBeenCalledTimes(1);
  });
});

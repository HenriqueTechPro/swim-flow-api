import { Prisma } from '@prisma/client';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaStudentsRepository } from './prisma-students-repository';

describe('PrismaStudentsRepository protected hard delete', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const relations = [
    'guardians',
    'exStudents',
    'poolResults',
    'openWaterResults',
    'studentClasses',
    'attendanceRecords',
    'anthropometricAssessments',
    'progressReportObservations',
    'technicalAssessments',
    'levelHistory',
    'seasonCategories',
  ] as const;
  const emptyCounts = () =>
    Object.fromEntries(relations.map((name) => [name, 0]));
  const student = {
    id,
    name: 'Atleta',
    gender: 'Masculino',
    birthDate: new Date('2018-01-01'),
    category: { name: 'Mirim_1' },
    level: { name: 'Iniciante' },
    phone: '',
    photo: null,
    achievements: 0,
    status: 'Ativo',
    guardians: [],
    studentClasses: [],
  };
  const tx = {
    $queryRaw: jest.fn(),
    student: {
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const cache = { deleteMatching: jest.fn() };
  const repository = new PrismaStudentsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    { cacheTtlSeconds: 60 } as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id }]);
    tx.student.findUniqueOrThrow.mockResolvedValue({
      ...student,
      _count: emptyCounts(),
    });
    tx.student.delete.mockResolvedValue({ id });
    cache.deleteMatching.mockResolvedValue(undefined);
  });

  it('locks the student and permits only a record without linked data', async () => {
    const deleted = await repository.remove(id);

    expect(deleted.id).toBe(id);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.student.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id },
      include: expect.objectContaining({
        _count: {
          select: Object.fromEntries(relations.map((name) => [name, true])),
        },
      }),
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.student.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(tx.student.delete).toHaveBeenCalledWith({ where: { id } });
    expect(cache.deleteMatching).toHaveBeenCalledWith('students:list:');
    expect(cache.deleteMatching).toHaveBeenCalledWith('parents:list:');
  });

  it.each(relations)('preserves students with linked %s', async (relation) => {
    tx.student.findUniqueOrThrow.mockResolvedValue({
      ...student,
      _count: { ...emptyCounts(), [relation]: 1 },
    });

    await expect(repository.remove(id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(tx.student.delete).not.toHaveBeenCalled();
    expect(cache.deleteMatching).not.toHaveBeenCalled();
  });

  it.each([{ photo: 'private-photo-reference' }, { achievements: 1 }])(
    'does not erase student-owned data: %o',
    async (changes) => {
      tx.student.findUniqueOrThrow.mockResolvedValue({
        ...student,
        ...changes,
        _count: emptyCounts(),
      });
      await expect(repository.remove(id)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(tx.student.delete).not.toHaveBeenCalled();
    },
  );

  it('returns 404 without reading or deleting when the row does not exist', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(repository.remove(id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(tx.student.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.student.delete).not.toHaveBeenCalled();
    expect(cache.deleteMatching).not.toHaveBeenCalled();
  });

  it('reports a database FK restriction as a conflict without invalidating caches', async () => {
    tx.student.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('foreign key', {
        code: 'P2003',
        clientVersion: '6.19.3',
      }),
    );

    await expect(repository.remove(id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(cache.deleteMatching).not.toHaveBeenCalled();
  });
});

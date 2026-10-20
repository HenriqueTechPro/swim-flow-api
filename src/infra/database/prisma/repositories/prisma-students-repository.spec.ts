import { PrismaStudentsRepository } from './prisma-students-repository';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';

describe('PrismaStudentsRepository season snapshots', () => {
  const studentId = 'd0ecb783-7543-4cec-93c5-eb3c5ce5d521';
  const seasonId = '75c30c3f-3cff-4b10-9f8c-c1adb27b9f6b';
  const tx = {
    student: {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      findUniqueOrThrow: jest.fn(),
    },
    studentSeasonCategory: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    studentClass: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    studentGuardian: {
      create: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  };

  const prisma = {
    student: { findUnique: jest.fn().mockResolvedValue({ id: studentId, studentClasses: [] }) },
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'Mirim_1' }]) },
    level: { findMany: jest.fn().mockResolvedValue([{ id: 'level-1', name: 'Iniciante' }]) },
    season: { findFirst: jest.fn().mockResolvedValue({ id: seasonId, year: 2027 }) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  const cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
  const env = { cacheTtlSeconds: 60 };

  const repository = new PrismaStudentsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    env as unknown as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.student.create.mockResolvedValue({ id: studentId });
    tx.student.findUniqueOrThrow.mockResolvedValue({
      id: studentId,
      name: 'Aluno',
      gender: 'Masculino',
      birthDate: new Date('2018-02-10'),
      photo: null,
      phone: '(71) 99999-1111',
      status: 'Ativo',
      achievements: 0,
      category: { name: 'Mirim_1' },
      level: { name: 'Iniciante' },
      guardians: [],
      studentClasses: [],
    });
  });

  it('reads the active season alongside category and level references', async () => {
    expect(await repository.listReferenceData()).toMatchObject({
      activeSeasonId: seasonId,
      activeSeasonYear: 2027,
    });
  });

  it('persists the category snapshot for the active season atomically with student creation', async () => {
    await repository.create({
      name: 'Aluno',
      gender: 'Masculino',
      birthDate: '2018-02-10',
      level: 'Iniciante',
      phone: '(71) 99999-1111',
      status: 'Ativo',
      categoryId: 'cat-1',
      levelId: 'level-1',
      seasonId,
    });

    expect(tx.studentSeasonCategory.create).toHaveBeenCalledWith({
      data: {
        studentId,
        seasonId,
        categoryId: 'cat-1',
      },
    });
    expect(cache.deleteMatching).toHaveBeenCalledWith('students:list:');
  });

  it('changes the principal guardian without deleting secondary links', async () => {
    const newPrincipalId = '3da94e43-29ea-49e6-9a14-7f7a1331cd34';
    await repository.update(studentId, {
      name: 'Aluno',
      gender: 'Masculino',
      birthDate: '2018-02-10',
      level: 'Iniciante',
      phone: '(71) 99999-1111',
      status: 'Ativo',
      categoryId: 'cat-1',
      levelId: 'level-1',
      parentId: newPrincipalId,
      classId: null,
    });

    expect(tx.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: { studentId, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.studentGuardian.upsert).toHaveBeenCalledWith({
      where: { studentId_parentId: { studentId, parentId: newPrincipalId } },
      create: { studentId, parentId: newPrincipalId, isPrimary: true },
      update: { isPrimary: true },
    });
    expect(cache.deleteMatching).toHaveBeenCalledWith('parents:list:');
  });

  it('removes only the primary designation when no principal is requested', async () => {
    await repository.update(studentId, {
      name: 'Aluno',
      gender: 'Masculino',
      birthDate: '2018-02-10',
      level: 'Iniciante',
      phone: '(71) 99999-1111',
      status: 'Ativo',
      categoryId: 'cat-1',
      levelId: 'level-1',
      parentId: null,
      classId: null,
    });

    expect(tx.studentGuardian.updateMany).toHaveBeenCalled();
    expect(tx.studentGuardian.upsert).not.toHaveBeenCalled();
  });

  it('does not fabricate a season category when no season exists', async () => {
    await repository.create({
      name: 'Aluno',
      gender: 'Masculino',
      birthDate: '2018-02-10',
      level: 'Iniciante',
      phone: '(71) 99999-1111',
      status: 'Ativo',
      categoryId: 'cat-1',
      levelId: 'level-1',
    });

    expect(tx.studentSeasonCategory.create).not.toHaveBeenCalled();
  });
});

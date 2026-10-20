import { PrismaParentsRepository } from './prisma-parents-repository';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { CreateParentRepositoryInput } from '@/domain/parents/application/repositories/parents-repository';

const firstStudent = '7ee70455-7fb9-4a2f-8412-7f422d5ff4c9';
const primaryParent = '83c31be4-abde-494e-8928-10889019b832';
const nextParent = 'e64c2b40-454d-496f-a197-f7032c63b1ad';

const input: CreateParentRepositoryInput = {
  name: 'Responsavel de teste',
  childrenIds: [firstStudent],
  email: 'guardian@example.test',
  phone: '(71) 99999-0000',
  profession: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  status: 'Ativo',
};

describe('PrismaParentsRepository guardian synchronization', () => {
  const tx = {
    parent: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    student: { findMany: jest.fn() },
    studentGuardian: {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    parent: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: (db: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
  const repo = new PrismaParentsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    { cacheTtlSeconds: 60 } as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.studentGuardian.findMany.mockReset();
    tx.parent.create.mockResolvedValue({ id: nextParent });
    tx.parent.findUniqueOrThrow.mockResolvedValue({
      id: nextParent,
      name: input.name,
      photo: null,
      cpf: null,
      birthDate: null,
      phone: input.phone,
      email: input.email,
      profession: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      status: 'Ativo',
      studentGuardians: [{ student: { id: firstStudent, name: 'Atleta' } }],
    });
    tx.student.findMany.mockResolvedValue([{ id: firstStudent }]);
    tx.studentGuardian.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ studentId: firstStudent }]);
  });

  it('adds another guardian as secondary when a principal already exists', async () => {
    const parent = await repo.create(input);

    expect(parent.childrenIds).toEqual([firstStudent]);
    expect(tx.studentGuardian.createMany).toHaveBeenCalledWith({
      data: [{ parentId: nextParent, studentId: firstStudent, isPrimary: false, canReceiveUpdates: false }],
      skipDuplicates: true,
    });
    expect(cache.deleteMatching).toHaveBeenCalledWith('students:list:');
    expect(cache.deleteMatching).toHaveBeenCalledWith('parents:list:');
  });

  it('chooses a principal only when none exists', async () => {
    tx.studentGuardian.findMany.mockReset();
    tx.studentGuardian.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await repo.create(input);

    expect(tx.studentGuardian.createMany).toHaveBeenCalledWith({
      data: [{ parentId: nextParent, studentId: firstStudent, isPrimary: true, canReceiveUpdates: false }],
      skipDuplicates: true,
    });
  });

  it('rolls back if any child identifier is unknown', async () => {
    tx.student.findMany.mockResolvedValueOnce([]);

    await expect(repo.create(input)).rejects.toThrow('selected students do not exist');
    expect(tx.studentGuardian.createMany).not.toHaveBeenCalled();
    expect(tx.studentGuardian.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes an adult without deleting any student record', async () => {
    prisma.parent.findUnique.mockResolvedValueOnce(
      await tx.parent.findUniqueOrThrow(),
    );

    await repo.remove(nextParent);

    expect(tx.parent.delete).toHaveBeenCalledWith({ where: { id: nextParent } });
    // Deletion of the adult cascades only the StudentGuardian join rows in SQL.
    expect(tx.student.findMany).not.toHaveBeenCalled();
    expect(tx.studentGuardian.deleteMany).not.toHaveBeenCalled();
  });

  it('never assigns adult notifications permission from the parent form', async () => {
    await repo.create(input);
    expect(tx.studentGuardian.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ canReceiveUpdates: false })],
      }),
    );
  });
});

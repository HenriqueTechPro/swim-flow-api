import { Prisma } from '@prisma/client';
import { PrismaExStudentsRepository } from './prisma-ex-students-repository';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import { AppError } from '@/shared/errors/app-error';

const studentId = '933e49e3-f5e2-436d-a21b-950465b813a2';
const departureId = '90e3f80e-163a-4298-98e1-c6bcb7f2fac1';

const snapshot = {
  id: departureId,
  studentId,
  name: 'Atleta',
  category: 'Petiz 1',
  level: 'Intermediário',
  exitDateAt: new Date('2026-09-01'),
  exitReason: 'Falta_de_tempo',
  exitNotes: null,
  phone: '',
  responsible: 'Responsável',
  parentId: null,
  achievements: 2,
  lastCompetition: '',
  birthDate: new Date('2015-01-01'),
  reactivatedAt: null,
  voidedAt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
};

describe('PrismaExStudentsRepository departure integrity', () => {
  let transactionClient: {
    student: { findUnique: jest.Mock; updateMany: jest.Mock };
    exStudent: {
      findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock;
      update: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock;
    };
  };
  let db: { $transaction: jest.Mock };
  let repository: PrismaExStudentsRepository;
  let cache: { deleteMatching: jest.Mock };

  beforeEach(() => {
    transactionClient = {
      student: {
        findUnique: jest.fn().mockResolvedValue({
          id: studentId, name: snapshot.name, birthDate: snapshot.birthDate,
          category: { name: 'Petiz_1' }, level: { name: snapshot.level },
          guardians: [], phone: '', achievements: 2,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      exStudent: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(snapshot),
        update: jest.fn().mockImplementation(async (args: { data: object }) => ({
          ...snapshot, ...args.data,
        })),
      },
    };
    db = {
      $transaction: jest.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)),
    };
    cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
    repository = new PrismaExStudentsRepository(
      db as unknown as PrismaService,
      cache as unknown as CacheRepository,
      { cacheTtlSeconds: 60 } as EnvService,
    );
  });

  it('reactivates transactionally without deleting the historical row', async () => {
    const record = await repository.reactivate(departureId);

    expect(transactionClient.student.updateMany).toHaveBeenCalledWith({
      where: { id: studentId, status: 'Inativo' },
      data: { status: 'Ativo' },
    });
    expect(transactionClient.exStudent.update).toHaveBeenCalledWith({
      where: { id: departureId },
      data: { reactivatedAt: expect.any(Date) },
    });
    expect(record.reactivatedAt).not.toBeNull();
    expect(cache.deleteMatching).toHaveBeenCalledWith('students:list:');
  });

  it('prevents a second reactivation of a completed departure', async () => {
    transactionClient.exStudent.findUnique.mockResolvedValue({
      ...snapshot, reactivatedAt: new Date(),
    });
    await expect(repository.reactivate(departureId)).rejects.toBeInstanceOf(AppError);
    expect(transactionClient.student.updateMany).not.toHaveBeenCalled();
  });

  it('replays the complete archive transaction once after a PostgreSQL P2034 rollback', async () => {
    db.$transaction.mockImplementationOnce(async () => {
      throw new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '6.19.3',
      });
    });
    const archived = await repository.create({
      studentId, exitDate: '2026-09-01', exitReason: 'Falta de tempo',
    });

    expect(archived.id).toBe(departureId);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(transactionClient.exStudent.create).toHaveBeenCalledTimes(1);
    expect(cache.deleteMatching).toHaveBeenCalledWith('ex-students:list:');
  });

  it('does not create an active departure when student is already inactive', async () => {
    transactionClient.student.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.create({
      studentId, exitDate: '2026-09-01', exitReason: 'Falta de tempo',
    })).rejects.toThrow('Student is already inactive');
    expect(transactionClient.exStudent.create).not.toHaveBeenCalled();
  });

  it('preserves invalidated departure as a voided historical record', async () => {
    const row = await repository.remove(departureId);
    expect(row.voidedAt).not.toBeNull();
    expect(transactionClient.exStudent.update).toHaveBeenCalledWith({
      where: { id: departureId },
      data: { voidedAt: expect.any(Date) },
    });
  });

  it('rejects updates after the departure closes concurrently', async () => {
    transactionClient.exStudent.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.update(departureId, {
      exitDate: '2026-09-01',
      exitReason: 'Falta de tempo',
      achievements: 2,
      lastCompetition: '',
    })).rejects.toThrow('Departure was closed during update');
  });

  it('rejects future departure dates without touching the database', async () => {
    await expect(repository.create({
      studentId, exitDate: '2099-12-31', exitReason: 'Falta de tempo',
    })).rejects.toThrow('Invalid exit date');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates', async () => {
    await expect(repository.create({
      studentId, exitDate: '2026-02-30', exitReason: 'Falta de tempo',
    })).rejects.toThrow('Invalid exit date');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

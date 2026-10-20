import { PrismaResultsRepository } from './prisma-results-repository';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { CreateResultRepositoryInput } from '@/domain/results/application/repositories/results-repository';

const studentId = '77777777-7777-4777-8777-777777777777';

describe('PrismaResultsRepository canonical storage', () => {
  const cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
  const env = { cacheTtlSeconds: 60 };
  let prisma: {
    student: { findUnique: jest.Mock };
    poolResult: { create: jest.Mock };
    openWaterResult: { create: jest.Mock };
  };
  let repo: PrismaResultsRepository;

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: studentId }) },
      poolResult: { create: jest.fn() },
      openWaterResult: { create: jest.fn() },
    };
    repo = new PrismaResultsRepository(
      prisma as unknown as PrismaService,
      cache as unknown as CacheRepository,
      env as unknown as EnvService,
    );
    cache.deleteMatching.mockClear();
  });

  const base = {
    studentId,
    discipline: 'Piscina',
    competitionType: 'Piscina',
    style: 'Livre',
    distance: '100m',
    courseType: 'Piscina Curta',
    eventFormat: 'Prova Individual',
    time: '01:04.57',
    date: '2026-10-20',
    resultStatus: 'Classificado',
    category: 'Petiz 1',
    position: 1,
  } satisfies CreateResultRepositoryInput;

  it('persists a pool result in meters/milliseconds, not as text', async () => {
    prisma.poolResult.create.mockImplementation(async (args: { data: object }) => ({
      id: 'pool-1', ...args.data,
      poolLengthMeters: 25, student: { name: 'Atleta' },
    }));

    const result = await repo.create(base);

    expect(prisma.poolResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        distanceMeters: 100,
        durationMs: 64570,
        poolLengthMeters: 25,
        status: 'CLASSIFIED',
        categorySnapshot: 'Petiz 1',
      }),
    }));
    expect(prisma.openWaterResult.create).not.toHaveBeenCalled();
    expect(result.durationMs).toBe(64570);
  });

  it('preserves a custom 20-meter pool length without using a 25m label', async () => {
    prisma.poolResult.create.mockImplementation(async (args: { data: object }) => ({
      id: 'pool-20', ...args.data,
      student: { name: 'Atleta' },
    }));

    const result = await repo.create({
      ...base,
      courseType: undefined,
      poolLengthMeters: 20,
    });

    expect(prisma.poolResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ poolLengthMeters: 20 }),
    }));
    expect(result.courseType).toBeUndefined();
    expect(result.poolLengthMeters).toBe(20);
  });

  it('writes open-water non-starters with null duration and null position', async () => {
    prisma.openWaterResult.create.mockImplementation(async (args: { data: object }) => ({
      id: 'water-1', ...args.data,
      student: { name: 'Atleta' },
    }));

    const result = await repo.create({
      studentId,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      style: 'Livre',
      distance: '1.5km',
      courseType: 'Mar',
      routeKey: 'Village Itaparica',
      eventFormat: 'Travessia',
      time: null,
      date: '2026-10-20',
      resultStatus: 'Não largou',
      position: null,
    });

    expect(prisma.openWaterResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        distanceMeters: 1500,
        bodyType: 'SEA',
        routeKey: 'Village Itaparica',
        durationMs: null,
        position: null,
        status: 'DID_NOT_START',
      }),
    }));
    expect(prisma.poolResult.create).not.toHaveBeenCalled();
    expect(result.durationMs).toBeNull();
  });

  it('rejects a classified swimmer without a time', async () => {
    await expect(repo.create({ ...base, time: null })).rejects.toThrow(
      'Classified results require a recorded duration',
    );
    expect(prisma.poolResult.create).not.toHaveBeenCalled();
  });

  it('rejects an explicit pool-length contradiction', async () => {
    await expect(repo.create({ ...base, poolLengthMeters: 50 })).rejects.toThrow(
      'Pool length conflicts',
    );
  });

  it('rejects a fractional distance that cannot be represented as whole meters', async () => {
    await expect(repo.create({ ...base, distance: '0.5m' })).rejects.toThrow(
      'Distance must be a positive whole number',
    );
  });
});

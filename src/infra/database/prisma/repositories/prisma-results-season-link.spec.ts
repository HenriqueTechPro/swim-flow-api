import type { CreateResultRepositoryInput } from '@/domain/results/application/repositories/results-repository';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import { PrismaResultsRepository } from './prisma-results-repository';

const studentId = '77777777-7777-4777-8777-777777777777';
const seasonId = '88888888-8888-4888-8888-888888888888';
const otherSeasonId = '99999999-9999-4999-8999-999999999999';

const season = {
  startsOn: new Date('2025-09-01T00:00:00.000Z'),
  endsOn: new Date('2026-08-31T00:00:00.000Z'),
};

const base = {
  studentId,
  discipline: 'Piscina',
  competitionType: 'Piscina',
  style: 'Livre',
  distance: '100m',
  courseType: 'Piscina Curta',
  eventFormat: 'Prova Individual',
  time: '01:04.57',
  date: '2026-05-20',
  resultStatus: 'Classificado',
  category: 'Petiz 1',
  position: 1,
} satisfies CreateResultRepositoryInput;

describe('PrismaResultsRepository season links', () => {
  let prisma: {
    season: { findUnique: jest.Mock };
    student: { findUnique: jest.Mock };
    poolResult: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    openWaterResult: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let repo: PrismaResultsRepository;

  beforeEach(() => {
    prisma = {
      season: { findUnique: jest.fn().mockResolvedValue(season) },
      student: {
        findUnique: jest.fn().mockResolvedValue({ id: studentId }),
      },
      poolResult: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      openWaterResult: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    prisma.poolResult.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pool-result',
      ...data,
      student: { name: 'Atleta' },
      }),
    );
    prisma.openWaterResult.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'open-water-result',
      ...data,
      student: { name: 'Atleta' },
      }),
    );
    const cache = { deleteMatching: jest.fn().mockResolvedValue(undefined) };
    repo = new PrismaResultsRepository(
      prisma as unknown as PrismaService,
      cache as unknown as CacheRepository,
      { cacheTtlSeconds: 60 } as EnvService,
    );
  });

  it('stores an explicitly selected season without changing the historic category', async () => {
    const result = await repo.create({ ...base, seasonId });
    expect(prisma.season.findUnique).toHaveBeenCalledWith({
      where: { id: seasonId },
      select: { startsOn: true, endsOn: true },
    });
    expect(prisma.poolResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seasonId,
          categorySnapshot: 'Petiz 1',
          heldOn: new Date('2026-05-20T00:00:00.000Z'),
        }),
      }),
    );
    expect(result.seasonId).toBe(seasonId);
  });

  it('does not invent a season when the field is omitted', async () => {
    await repo.create(base);
    expect(prisma.season.findUnique).not.toHaveBeenCalled();
    const data = prisma.poolResult.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('seasonId');
  });

  it('rejects a missing season or result outside its inclusive dates', async () => {
    prisma.season.findUnique.mockResolvedValueOnce(null);
    await expect(repo.create({ ...base, seasonId })).rejects.toThrow(
      'Selected season does not exist',
    );
    await expect(
      repo.create({ ...base, seasonId, date: '2026-09-01' }),
    ).rejects.toThrow('Result date is outside the selected season');
    expect(prisma.poolResult.create).not.toHaveBeenCalled();
  });

  it('can link open-water results without changing the original discipline', async () => {
    const result = await repo.create({
      studentId,
      seasonId,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      style: 'Livre',
      distance: '1.5km',
      courseType: 'Mar',
      routeKey: 'Circuito Norte',
      eventFormat: 'Travessia',
      date: '2026-05-20',
      resultStatus: 'Não largou',
      time: null,
      position: null,
    });
    expect(prisma.openWaterResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ seasonId }),
      }),
    );
    expect(result.seasonId).toBe(seasonId);
  });

  it('preserves the existing association and rejects an incompatible date edit', async () => {
    prisma.poolResult.findUnique.mockResolvedValue({
      id: 'pool-result',
      seasonId,
    });
    prisma.poolResult.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pool-result',
      ...data,
      seasonId,
      student: { name: 'Atleta' },
      }),
    );

    await repo.update('pool-result', {
      ...base,
      personalBest: false,
      improvement: 0,
    });
    const saved = prisma.poolResult.update.mock.calls[0][0].data;
    expect(saved).not.toHaveProperty('seasonId');
    expect(prisma.season.findUnique).toHaveBeenCalled();

    await expect(
      repo.update('pool-result', {
        ...base,
        date: '2027-01-15',
        personalBest: false,
        improvement: 0,
      }),
    ).rejects.toThrow('Result date is outside the selected season');
    expect(prisma.poolResult.update).toHaveBeenCalledTimes(1);
  });

  it('unlinks only when explicitly null and allows replacing a valid season', async () => {
    prisma.poolResult.findUnique.mockResolvedValue({
      id: 'pool-result',
      seasonId,
    });
    prisma.poolResult.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pool-result',
      ...data,
      student: { name: 'Atleta' },
      }),
    );

    const unlinked = await repo.update('pool-result', {
      ...base,
      seasonId: null,
      date: '2028-01-01',
      personalBest: false,
      improvement: 0,
    });
    expect(prisma.season.findUnique).not.toHaveBeenCalled();
    expect(prisma.poolResult.update.mock.calls[0][0].data.seasonId).toBeNull();
    expect(unlinked.seasonId).toBeNull();

    await repo.update('pool-result', {
      ...base,
      seasonId: otherSeasonId,
      personalBest: false,
      improvement: 0,
    });
    expect(prisma.season.findUnique).toHaveBeenCalledWith({
      where: { id: otherSeasonId },
      select: { startsOn: true, endsOn: true },
    });
    expect(prisma.poolResult.update.mock.calls[1][0].data.seasonId).toBe(
      otherSeasonId,
    );
  });
});

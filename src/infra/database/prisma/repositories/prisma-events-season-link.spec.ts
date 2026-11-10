import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { CreateEventRepositoryInput } from '@/domain/events/application/repositories/events-repository';
import { PrismaEventsRepository } from './prisma-events-repository';

describe('Event explicit season links (Prisma)', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const seasonId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const otherSeasonId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const input = {
    title: 'Festival anual',
    type: 'Festival',
    date: '2027-05-10',
    startTime: '08:00',
    endTime: '12:00',
    location: 'Piscina Central',
    status: 'Agendado',
  } satisfies CreateEventRepositoryInput;
  const row = {
    id,
    seasonId,
    title: input.title,
    description: '',
    type: 'Festival',
    date: new Date('2027-05-10T00:00:00.000Z'),
    startTime: new Date('1970-01-01T08:00:00.000Z'),
    endTime: new Date('1970-01-01T12:00:00.000Z'),
    location: input.location,
    status: 'Agendado',
  };
  const prisma = {
    season: { findUnique: jest.fn() },
    event: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    poolResult: { count: jest.fn() },
    openWaterResult: { count: jest.fn() },
    poolProgramRace: { count: jest.fn() },
    openWaterProgramRace: { count: jest.fn() },
  };
  const cache = { deleteMatching: jest.fn() };
  const repo = new PrismaEventsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    {} as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.season.findUnique.mockResolvedValue({
      startsOn: new Date('2027-01-01T00:00:00.000Z'),
      endsOn: new Date('2027-12-31T00:00:00.000Z'),
    });
    prisma.event.findUnique.mockResolvedValue(row);
    prisma.event.create.mockResolvedValue(row);
    prisma.event.update.mockResolvedValue(row);
    prisma.poolResult.count.mockResolvedValue(0);
    prisma.openWaterResult.count.mockResolvedValue(0);
    prisma.poolProgramRace.count.mockResolvedValue(0);
    prisma.openWaterProgramRace.count.mockResolvedValue(0);
    cache.deleteMatching.mockResolvedValue(undefined);
  });

  it('saves explicit season without inferring it from the date', async () => {
    const result = await repo.create({ ...input, seasonId });
    expect(result.seasonId).toBe(seasonId);
    expect(prisma.season.findUnique).toHaveBeenCalledWith({
      where: { id: seasonId },
      select: { startsOn: true, endsOn: true },
    });
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ seasonId }),
    });
    await repo.create(input);
    const omitted = prisma.event.create.mock.calls[1][0] as {
      data: Record<string, unknown>;
    };
    expect(omitted.data).not.toHaveProperty('seasonId');
  });

  it('rejects missing seasons and dates outside the range', async () => {
    prisma.season.findUnique.mockResolvedValueOnce(null);
    await expect(repo.create({ ...input, seasonId })).rejects.toThrow(
      'Selected season does not exist',
    );
    await expect(
      repo.create({ ...input, seasonId, date: '2028-01-01' }),
    ).rejects.toThrow('Event date is outside the selected season');
    await expect(
      repo.create({ ...input, seasonId, date: '2027-02-30' }),
    ).rejects.toThrow('Event date is outside the selected season');
    expect(prisma.event.create).not.toHaveBeenCalled();
    await repo.create({ ...input, seasonId, date: '2027-01-01' });
    await repo.create({ ...input, seasonId, date: '2027-12-31' });
    expect(prisma.event.create).toHaveBeenCalledTimes(2);
  });

  it('keeps season on PUT omission and validates edited date', async () => {
    await repo.update(id, { ...input, title: 'Novo título' });
    const saved = prisma.event.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(saved.data).not.toHaveProperty('seasonId');
    await expect(
      repo.update(id, { ...input, date: '2028-01-01' }),
    ).rejects.toThrow('Event date is outside the selected season');
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
  });

  it(
      'accepts explicit re-link or null unlink without linked results',
      async () => {
      await repo.update(id, { ...input, seasonId: otherSeasonId });
      const relink = prisma.event.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
      };
      expect(relink.data.seasonId).toBe(otherSeasonId);
      await repo.update(id, { ...input, seasonId: null, date: '2028-05-01' });
      const unlink = prisma.event.update.mock.calls[1][0] as {
      data: Record<string, unknown>;
      };
      expect(unlink.data.seasonId).toBeNull();
    },
  );

  it('blocks re-link and unlink when results are linked to event', async () => {
    prisma.poolResult.count.mockResolvedValue(1);
    await expect(
      repo.update(id, { ...input, seasonId: otherSeasonId }),
    ).rejects.toThrow('linked results or scheduled races');
    await expect(
      repo.update(id, { ...input, seasonId: null }),
    ).rejects.toThrow('linked results or scheduled races');
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});

import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { UpdateEventRepositoryInput } from '@/domain/events/application/repositories/events-repository';
import { PrismaEventsRepository } from './prisma-events-repository';

describe('Event identity protection with linked results (Prisma)', () => {
  const id = '88888888-8888-4888-8888-888888888888';
  const row = {
    id,
    title: 'Festival Interno',
    description: '',
    type: 'Festival',
    date: new Date('2026-03-31T00:00:00.000Z'),
    startTime: new Date('1970-01-01T14:00:00.000Z'),
    endTime: new Date('1970-01-01T17:00:00.000Z'),
    location: 'Piscina',
    status: 'Concluido',
  };
  const input = {
    title: 'Festival Interno',
    description: 'Atualização',
    type: 'Festival',
    date: '2026-03-31',
    startTime: '14:00',
    endTime: '17:00',
    location: 'Piscina',
    status: 'Concluído',
  } satisfies UpdateEventRepositoryInput;
  const prisma = {
    event: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
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
    prisma.event.findUnique.mockResolvedValue(row);
    prisma.event.update.mockResolvedValue(row);
    prisma.event.delete.mockResolvedValue(row);
    prisma.poolResult.count.mockResolvedValue(1);
    prisma.openWaterResult.count.mockResolvedValue(0);
    prisma.poolProgramRace.count.mockResolvedValue(0);
    prisma.openWaterProgramRace.count.mockResolvedValue(0);
    cache.deleteMatching.mockResolvedValue(undefined);
  });

  it('allows editing the title and description without changing the event identity', async () => {
    await repo.update(id, { ...input, title: 'Outro título' });
    expect(prisma.poolResult.count).not.toHaveBeenCalled();
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
  });

  it('protects date, event type and cancellation while results exist', async () => {
    await expect(
      repo.update(id, { ...input, date: '2026-04-01' }),
    ).rejects.toThrow('Event has linked results');
    await expect(
      repo.update(id, { ...input, type: 'Reunião' }),
    ).rejects.toThrow('Event has linked results');
    await expect(
      repo.update(id, { ...input, status: 'Cancelado' }),
    ).rejects.toThrow('Event has linked results');
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('rejects deleting a referenced competition', async () => {
    await expect(repo.remove(id)).rejects.toThrow('Event has linked results');
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });

  it('checks open-water results separately', async () => {
    prisma.poolResult.count.mockResolvedValue(0);
    prisma.openWaterResult.count.mockResolvedValue(1);
    await expect(repo.remove(id)).rejects.toThrow('Event has linked results');
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });

  it('prevents editing or deleting an event scheduled for pool races', async () => {
    prisma.poolResult.count.mockResolvedValue(0);
    prisma.poolProgramRace.count.mockResolvedValue(1);
    await expect(
      repo.update(id, { ...input, date: '2026-04-01' }),
    ).rejects.toThrow('linked results or scheduled races');
    await expect(repo.remove(id)).rejects.toThrow(
      'linked results or scheduled races',
    );
    expect(prisma.event.update).not.toHaveBeenCalled();
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });

  it('prevents cancellation with open-water start programming', async () => {
    prisma.poolResult.count.mockResolvedValue(0);
    prisma.openWaterProgramRace.count.mockResolvedValue(1);
    await expect(
      repo.update(id, { ...input, status: 'Cancelado' }),
    ).rejects.toThrow('linked results or scheduled races');
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('allows identity changes and deletion when no results refer to the event', async () => {
    prisma.poolResult.count.mockResolvedValue(0);
    prisma.openWaterResult.count.mockResolvedValue(0);
    await repo.update(id, { ...input, date: '2026-04-01' });
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
    await repo.remove(id);
    expect(prisma.event.delete).toHaveBeenCalledTimes(1);
  });
});

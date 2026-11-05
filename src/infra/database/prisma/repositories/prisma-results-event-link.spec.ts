import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import type { PrismaService } from '../prisma.service';
import type { CreateResultRepositoryInput } from '@/domain/results/application/repositories/results-repository';
import { PrismaResultsRepository } from './prisma-results-repository';

describe('Result event ID integrity (Prisma)', () => {
  const eventId = '88888888-8888-4888-8888-888888888888';
  const studentId = '77777777-7777-4777-8777-777777777777';
  const seasonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const event = {
    id: eventId,
    date: new Date('2026-03-31T00:00:00.000Z'),
    type: 'Festival',
    status: 'Concluido',
    seasonId: null as string | null,
  };
  const poolRow = {
    id: '99999999-9999-4999-8999-999999999999',
    studentId,
    eventId,
    seasonId: null,
    student: { name: 'Atleta' },
    style: 'Livre',
    distanceMeters: 50,
    poolLengthMeters: 25,
    format: 'INDIVIDUAL',
    durationMs: 34210,
    heldOn: new Date('2026-03-31T00:00:00.000Z'),
    position: 1,
    status: 'CLASSIFIED',
    competitionSnapshot: 'Festival',
    categorySnapshot: 'Petiz 2',
    notes: null,
  };
  const prisma = {
    student: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    season: { findUnique: jest.fn() },
    poolResult: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    openWaterResult: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const cache = { deleteMatching: jest.fn() };
  const repo = new PrismaResultsRepository(
    prisma as unknown as PrismaService,
    cache as unknown as CacheRepository,
    {} as EnvService,
  );
  const input = {
    studentId,
    eventId,
    discipline: 'Piscina',
    competitionType: 'Piscina',
    courseType: 'Piscina Curta',
    eventFormat: 'Prova Individual',
    style: 'Livre',
    distance: '50m',
    time: '00:34.21',
    date: '2026-03-31',
    competition: 'Festival',
    category: 'Petiz 2',
    resultStatus: 'Classificado',
    position: 1,
  } satisfies CreateResultRepositoryInput;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findUnique.mockResolvedValue({ id: studentId });
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.season.findUnique.mockResolvedValue(null);
    prisma.poolResult.findUnique.mockResolvedValue(null);
    prisma.openWaterResult.findUnique.mockResolvedValue(null);
    prisma.poolResult.create.mockImplementation(
      async (args: { data: { eventId?: string | null } }) => ({
        ...poolRow,
        ...args.data,
        eventId: args.data.eventId ?? null,
      }),
    );
    prisma.poolResult.update.mockImplementation(
      async (args: { data: { eventId?: string | null } }) => ({
        ...poolRow,
        ...args.data,
        eventId: args.data.eventId === undefined ? eventId : args.data.eventId,
      }),
    );
    cache.deleteMatching.mockResolvedValue(undefined);
  });

  it('persists explicit event ID, validates day and returns the event identity', async () => {
    const result = await repo.create(input);
    expect(result.eventId).toBe(eventId);
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: eventId },
      select: {
        id: true,
        date: true,
        type: true,
        status: true,
        seasonId: true,
      },
    });
    expect(prisma.poolResult.create.mock.calls[0][0].data).toMatchObject({
      eventId,
      categorySnapshot: 'Petiz 2',
    });
  });

  it('does not infer an event identity from a competition name', async () => {
    const result = await repo.create({ ...input, eventId: undefined });
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
    expect(prisma.poolResult.create.mock.calls[0][0].data).not.toHaveProperty(
      'eventId',
    );
    expect(result.eventId).toBeNull();
  });

  it('rejects missing events, meetings and cancelled events before writing', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(repo.create(input)).rejects.toThrow(
      'Selected event does not exist',
    );
    prisma.event.findUnique.mockResolvedValue({ ...event, type: 'Reuniao' });
    await expect(repo.create(input)).rejects.toThrow(
      'not a competition or festival',
    );
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      status: 'Cancelado',
    });
    await expect(repo.create(input)).rejects.toThrow('Cancelled events');
    expect(prisma.poolResult.create).not.toHaveBeenCalled();
  });

  it('rejects mismatched or empty event dates', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      date: new Date('2026-04-01T00:00:00.000Z'),
    });
    await expect(repo.create(input)).rejects.toThrow('date must match');
    prisma.event.findUnique.mockResolvedValue({ ...event, date: null });
    await expect(repo.create(input)).rejects.toThrow('date must match');
    expect(prisma.poolResult.create).not.toHaveBeenCalled();
  });

  it('requires explicitly consistent seasons when the event has a season', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...event, seasonId });
    await expect(repo.create(input)).rejects.toThrow(
      'Result season must match',
    );
    prisma.season.findUnique.mockResolvedValue({
      startsOn: new Date('2026-01-01T00:00:00.000Z'),
      endsOn: new Date('2026-12-31T00:00:00.000Z'),
    });
    const result = await repo.create({ ...input, seasonId });
    expect(result.eventId).toBe(eventId);
    expect(prisma.poolResult.create.mock.calls[0][0].data).toMatchObject({
      eventId,
      seasonId,
    });
  });

  it('preserves an existing event when omitted in PUT and rejects moving the result date', async () => {
    prisma.poolResult.findUnique.mockResolvedValue({
      id: poolRow.id,
      eventId,
      seasonId: null,
    });
    const update = {
      ...input,
      eventId: undefined,
      personalBest: false,
      improvement: 0,
    };
    const result = await repo.update(poolRow.id, update);
    expect(result.eventId).toBe(eventId);
    expect(prisma.poolResult.update.mock.calls[0][0].data).not.toHaveProperty(
      'eventId',
    );
    prisma.poolResult.update.mockClear();
    await expect(
      repo.update(poolRow.id, { ...update, date: '2026-04-01' }),
    ).rejects.toThrow('date must match');
    expect(prisma.poolResult.update).not.toHaveBeenCalled();
  });

  it('unlinks with explicit null', async () => {
    prisma.poolResult.findUnique.mockResolvedValue({
      id: poolRow.id,
      eventId,
      seasonId: null,
    });
    const result = await repo.update(poolRow.id, {
      ...input,
      eventId: null,
      personalBest: false,
      improvement: 0,
    });
    expect(result.eventId).toBeNull();
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
    expect(prisma.poolResult.update.mock.calls[0][0].data).toMatchObject({
      eventId: null,
    });
  });

  it('validates event ID for open-water results as well', async () => {
    prisma.openWaterResult.create.mockImplementation(
      async (args: { data: object }) => ({
        ...poolRow,
        ...args.data,
        bodyType: 'SEA',
        routeKey: 'Rota A',
        format: 'TRAVESSIA',
      }),
    );
    const result = await repo.create({
      ...input,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      distance: '1.5km',
      eventFormat: 'Travessia',
      routeKey: 'Rota A',
    });
    expect(result.eventId).toBe(eventId);
    expect(prisma.openWaterResult.create.mock.calls[0][0].data).toMatchObject({
      eventId,
      routeKey: 'Rota A',
    });
  });
});

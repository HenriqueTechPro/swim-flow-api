import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { CompetitionProgramRepository } from '@/domain/competition-program/application/repositories/competition-program-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

describe('Competition program (authenticated API)', () => {
  let app: INestApplication<App>;
  const eventId = '88888888-8888-4888-8888-888888888888';
  const raceId = '77777777-7777-4777-8777-777777777777';
  const repository = {
    createPoolRace: jest.fn(),
    listPoolRaces: jest.fn(),
    createPoolHeat: jest.fn(),
    listPoolHeats: jest.fn(),
    createOpenWaterRace: jest.fn(),
    listOpenWaterRaces: jest.fn(),
    createOpenWaterStart: jest.fn(),
    listOpenWaterStarts: jest.fn(),
  };

  beforeEach(async () => {
    for (const method of Object.values(repository)) method.mockReset();
    repository.listPoolRaces.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 } as never);
    repository.listOpenWaterRaces.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 } as never);
    repository.listPoolHeats.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 } as never);
    repository.listOpenWaterStarts.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 } as never);
    repository.createPoolRace.mockImplementation(async (input: never) => ({ id: raceId, ...input }) as never);
    repository.createOpenWaterRace.mockImplementation(async (input: never) => ({ id: raceId, ...input }) as never);
    repository.createPoolHeat.mockImplementation(async (input: never) => ({ id: raceId, ...input }) as never);
    repository.createOpenWaterStart.mockImplementation(async (input: never) => ({ id: raceId, ...input }) as never);
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(CompetitionProgramRepository).useValue(repository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not list all races without an exact event ID', async () => {
    await request(app.getHttpServer())
      .get('/api/competition-program/pool/races')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/competition-program/open-water/races?eventId=invalid')
      .expect(400);
    expect(repository.listPoolRaces).not.toHaveBeenCalled();
    expect(repository.listOpenWaterRaces).not.toHaveBeenCalled();
  });

  it('lists separate pool and open-water programs by explicit event ID', async () => {
    await request(app.getHttpServer())
      .get(`/api/competition-program/pool/races?eventId=${eventId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/competition-program/open-water/races?eventId=${eventId}`)
      .expect(200);
    expect(repository.listPoolRaces).toHaveBeenCalledWith({
      eventId,
      page: 1,
      perPage: 20,
    });
    expect(repository.listOpenWaterRaces).toHaveBeenCalledWith({
      eventId,
      page: 1,
      perPage: 20,
    });
  });

  it('allows creating a 20m pool race without mixing water-body metadata', async () => {
    const payload = {
      eventId,
      sessionCode: 'MANHA',
      raceNumber: 1,
      style: 'Livre',
      distanceMeters: 50,
      poolLengthMeters: 20,
      categorySnapshot: 'Petiz 2',
      genderScope: 'FEMININO',
    };
    const response = await request(app.getHttpServer())
      .post('/api/competition-program/pool/races')
      .send(payload)
      .expect(201);
    expect(response.body.data.poolLengthMeters).toBe(20);
    expect(repository.createPoolRace).toHaveBeenCalledWith({
      ...payload,
      format: 'INDIVIDUAL',
    });
    await request(app.getHttpServer())
      .post('/api/competition-program/pool/races')
      .send({ ...payload, routeKey: 'sea' })
      .expect(400);
  });

  it('creates distinct open-water courses and start waves', async () => {
    const payload = {
      eventId,
      sessionCode: 'MANHA',
      raceNumber: 1,
      distanceMeters: 1500,
      bodyType: 'SEA',
      routeKey: 'beach-loop-2026',
      categorySnapshot: 'Petiz 2',
      genderScope: 'FEMININO',
    };
    const race = await request(app.getHttpServer())
      .post('/api/competition-program/open-water/races')
      .send(payload)
      .expect(201);
    expect(race.body.data.routeKey).toBe('beach-loop-2026');
    expect(repository.createOpenWaterRace).toHaveBeenCalledWith({
      ...payload,
      format: 'TRAVESSIA',
    });
    await request(app.getHttpServer())
      .post('/api/competition-program/open-water/starts')
      .send({ raceId, waveNumber: 1 })
      .expect(201);
    expect(repository.createOpenWaterStart).toHaveBeenCalledWith({ raceId, waveNumber: 1 });
  });

  it('does not confuse pool heat numbers with open-water wave numbers', async () => {
    await request(app.getHttpServer())
      .post('/api/competition-program/pool/heats')
      .send({ raceId, heatNumber: 1 })
      .expect(201);
    expect(repository.createPoolHeat).toHaveBeenCalledWith({ raceId, heatNumber: 1 });
    await request(app.getHttpServer())
      .post('/api/competition-program/pool/heats')
      .send({ raceId, waveNumber: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/competition-program/pool/heats?raceId=${raceId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/competition-program/open-water/starts?raceId=${raceId}`)
      .expect(200);
  });
});

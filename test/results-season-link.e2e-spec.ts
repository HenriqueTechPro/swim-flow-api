import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { InMemoryResultsRepository } from './repositories/in-memory-results-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

const seasonId = '88888888-8888-4888-8888-888888888888';

const payload = {
  studentId: '77777777-7777-4777-8777-777777777777',
  discipline: 'Piscina',
  competitionType: 'Piscina',
  courseType: 'Piscina Curta',
  eventFormat: 'Prova Individual',
  style: 'Livre',
  distance: '50m',
  time: '00:34.21',
  date: '2026-05-20',
  competition: 'Festival',
  resultStatus: 'Classificado',
  category: 'Petiz 2',
  position: 1,
};

describe('Results season link contract (e2e)', () => {
  let app: INestApplication<App>;
  let repository: InMemoryResultsRepository;

  beforeEach(async () => {
    repository = new InMemoryResultsRepository();
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ResultsRepository).useValue(repository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports season create, preservation and explicit unlink', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/results')
      .send({ ...payload, seasonId })
      .expect(201);
    const resultId = created.body.data.id as string;
    expect(created.body.data.seasonId).toBe(seasonId);

    const unchanged = await request(app.getHttpServer())
      .put(`/api/results/${resultId}`)
      .send({ ...payload, date: '2026-05-21' })
      .expect(200);
    expect(unchanged.body.data.seasonId).toBe(seasonId);

    const unlinked = await request(app.getHttpServer())
      .put(`/api/results/${resultId}`)
      .send({ ...payload, seasonId: null })
      .expect(200);
    expect(unlinked.body.data.seasonId).toBeNull();
    expect(unlinked.body.data.category).toBe('Petiz 2');

    await request(app.getHttpServer())
      .post('/api/results')
      .send({ ...payload, seasonId: 'invalid-uuid' })
      .expect(400);
  });
});

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { makeResult } from './factories/make-result';
import { InMemoryResultsRepository } from './repositories/in-memory-results-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

describe('Ranking calendar-year filter (e2e)', () => {
  let app: INestApplication<App>;
  let resultsRepository: InMemoryResultsRepository;

  beforeEach(async () => {
    resultsRepository = new InMemoryResultsRepository();
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ResultsRepository).useValue(resultsRepository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('filters by year and preserves unfiltered rankings', async () => {
    resultsRepository.studentGenders.set('student-ana', 'Feminino');
    resultsRepository.studentGenders.set('student-bia', 'Feminino');
    resultsRepository.studentGenders.set('student-caio', 'Masculino');
    resultsRepository.items.push(
      makeResult({
        id: 'ana-2025',
        studentId: 'student-ana',
        date: '2025-12-31',
        time: '00:29.00',
        timeInSeconds: 29,
      }),
      makeResult({
        id: 'ana-2026',
        studentId: 'student-ana',
        date: '2026-01-01',
        time: '00:32.00',
        timeInSeconds: 32,
      }),
      makeResult({
        id: 'bia-2026',
        studentId: 'student-bia',
        date: '2026-12-31',
        time: '00:32.00',
        timeInSeconds: 32,
      }),
      makeResult({
        id: 'caio-2027',
        studentId: 'student-caio',
        date: '2027-01-01',
        time: '00:27.00',
        timeInSeconds: 27,
      }),
    );

    const query = new URLSearchParams({
      page: '1',
      perPage: '25',
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      style: 'Livre',
      distance: '50m',
      eventFormat: 'Prova Individual',
      category: 'Petiz 2',
    });
    const path = `/api/results/ranking?${query.toString()}`;

    const year2026 = await request(app.getHttpServer())
      .get(`${path}&year=2026&gender=Feminino`)
      .expect(200);
    expect(year2026.body.meta.total).toBe(2);
    expect(year2026.body.data).toEqual([
      expect.objectContaining({ resultId: 'ana-2026', rank: 1 }),
      expect.objectContaining({ resultId: 'bia-2026', rank: 1 }),
    ]);

    const year2025 = await request(app.getHttpServer())
      .get(`${path}&year=2025`)
      .expect(200);
    expect(year2025.body.data[0].resultId).toBe('ana-2025');

    const combined = await request(app.getHttpServer())
      .get(path)
      .expect(200);
    expect(combined.body.meta.total).toBe(3);
    expect(combined.body.data[0].resultId).toBe('caio-2027');

    await request(app.getHttpServer()).get(`${path}&year=1899`).expect(400);
    await request(app.getHttpServer()).get(`${path}&year=2026.5`).expect(400);
    await request(app.getHttpServer()).get(`${path}&year=invalid`).expect(400);
  });
});

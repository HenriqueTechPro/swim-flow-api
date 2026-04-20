import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { makeResult } from './factories/make-result';
import { InMemoryResultsRepository } from './repositories/in-memory-results-repository';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('PublicResultsController (e2e)', () => {
  let app: INestApplication<App>;
  let resultsRepository: InMemoryResultsRepository;

  beforeEach(async () => {
    resultsRepository = new InMemoryResultsRepository();

    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(ResultsRepository)
        .useValue(resultsRepository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists public results without authentication', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'public-result-1',
        studentId: 'student-public-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        notes: 'nota interna',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/public/results?discipline=Piscina')
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: 'public-result-1',
      studentId: 'student-public-1',
      studentName: 'Ana',
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      style: 'Livre',
      distance: '50m',
      eventFormat: 'Prova Individual',
      category: 'Petiz 2',
    });
    expect(response.body.data[0].notes).toBeUndefined();
  });

  it('generates a public ranking without authentication', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'result-1',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:33.90',
        timeInSeconds: 33.9,
      }),
      makeResult({
        id: 'result-2',
        studentId: 'student-2',
        studentName: 'Bruno',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:32.50',
        timeInSeconds: 32.5,
      }),
      makeResult({
        id: 'result-3',
        studentId: 'student-3',
        studentName: 'Caio',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:32.50',
        timeInSeconds: 32.5,
      }),
      makeResult({
        id: 'result-4',
        studentId: 'student-4',
        studentName: 'Duda',
        discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        style: 'Livre',
        distance: '5km',
        eventFormat: 'Travessia',
        category: 'Petiz 2',
        time: '01:12:45.32',
        timeInSeconds: 4365.32,
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/public/results/ranking?page=1&perPage=10&discipline=Piscina&competitionType=Piscina&courseType=Piscina%20Curta&style=Livre&distance=50m&eventFormat=Prova%20Individual&category=Petiz%202',
      )
      .expect(200);

    expect(response.body.meta.total).toBe(3);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data[0]).toMatchObject({
      rank: 1,
      studentId: 'student-2',
      resultId: 'result-2',
      timeInSeconds: 32.5,
    });
  });

  it('lists public ranking contexts without authentication', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'context-1',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
      }),
      makeResult({
        id: 'context-2',
        studentId: 'student-2',
        studentName: 'Bruno',
        discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        style: 'Livre',
        distance: '5km',
        eventFormat: 'Travessia',
        category: 'Junior',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/public/results/contexts?discipline=Piscina')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      discipline: 'Piscina',
      style: 'Livre',
      distance: '50m',
      category: 'Petiz 2',
    });
  });
});

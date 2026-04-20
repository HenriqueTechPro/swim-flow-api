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
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

describe('ResultsController (e2e)', () => {
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

  it('lists, creates, updates and deletes results', async () => {
    const listBefore = await request(app.getHttpServer())
      .get('/api/results')
      .expect(200);
    expect(listBefore.body.data).toEqual([]);

    const createResponse = await request(app.getHttpServer())
      .post('/api/results')
      .send({
        studentId: '77777777-7777-4777-8777-777777777777',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        eventFormat: 'Prova Individual',
        resultStatus: 'Classificado',
        style: 'Livre',
        distance: '50m',
        time: '00:34.21',
        date: '2026-03-31',
        competition: 'Festival Interno',
        position: 1,
        category: 'Petiz 2',
        notes: 'Resultado criado no e2e',
      })
      .expect(201);

    const resultId = createResponse.body.data.id as string;
    expect(createResponse.body.data.style).toBe('Livre');
    expect(createResponse.body.data.distance).toBe('50m');

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/results/${resultId}`)
      .send({
        studentId: '77777777-7777-4777-8777-777777777777',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        eventFormat: 'Prova Individual',
        resultStatus: 'Classificado',
        style: 'Livre',
        distance: '50m',
        time: '00:33.80',
        date: '2026-03-31',
        competition: 'Festival Interno',
        position: 1,
        personalBest: true,
        improvement: -0.41,
        category: 'Petiz 2',
        notes: 'Melhorou o tempo',
      })
      .expect(200);

    expect(updateResponse.body.data.timeInSeconds).toBe(33.8);
    expect(updateResponse.body.data.personalBest).toBe(true);

    const listAfter = await request(app.getHttpServer())
      .get('/api/results')
      .expect(200);
    expect(listAfter.body.data).toHaveLength(1);
    expect(listAfter.body.meta.total).toBe(1);

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/results/${resultId}`)
      .expect(200);

    expect(deleteResponse.body.data.id).toBe(resultId);

    const listFinal = await request(app.getHttpServer())
      .get('/api/results')
      .expect(200);
    expect(listFinal.body.data).toEqual([]);
  });

  it('filters and paginates results list', async () => {
    resultsRepository.items.push(
      makeResult({
        studentId: 'student-1',
        date: '2026-03-31',
        studentName: 'Ana',
        style: 'Livre',
        distance: '50m',
        competition: 'Festival A',
        category: 'Petiz 2',
      }),
      makeResult({
        studentId: 'student-2',
        date: '2025-03-31',
        studentName: 'Bruno',
        style: 'Costas',
        distance: '100m',
        competition: 'Festival B',
        category: 'Infantil 1',
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/results?page=1&perPage=1&search=ana&style=Livre&distance=50m&competition=Festival%20A&category=Petiz%202&startDate=2026-01-01&endDate=2026-12-31&studentId=student-1',
      )
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].studentName).toBe('Ana');
    expect(response.body.meta.total).toBe(1);
  });


  it('lists record holders for the filtered context without duplicate record groups', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'record-1',
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
        id: 'record-2',
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
        id: 'record-3',
        studentId: 'student-3',
        studentName: 'Caio',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '100m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '01:10.20',
        timeInSeconds: 70.2,
      }),
      makeResult({
        id: 'record-4',
        studentId: 'student-4',
        studentName: 'Duda',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        resultStatus: 'Desclassificado',
        time: '00:31.00',
        timeInSeconds: 31,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/results/records?discipline=Piscina')
      .expect(200);

    expect(response.body.meta.total).toBe(2);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({ id: 'record-2', distance: '50m' });
    expect(response.body.data[1]).toMatchObject({ id: 'record-3', distance: '100m' });
  });
  it('generates a ranking using only equivalent classified results', async () => {
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
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Infantil 1',
        time: '00:31.90',
        timeInSeconds: 31.9,
      }),
      makeResult({
        id: 'result-5',
        studentId: 'student-5',
        studentName: 'Eva',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        resultStatus: 'Desclassificado',
        time: '00:31.00',
        timeInSeconds: 31,
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/results/ranking?page=1&perPage=2&discipline=Piscina&competitionType=Piscina&courseType=Piscina%20Curta&style=Livre&distance=50m&eventFormat=Prova%20Individual&category=Petiz%202',
      )
      .expect(200);

    expect(response.body.meta.total).toBe(3);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      rank: 1,
      studentId: 'student-2',
      resultId: 'result-2',
      timeInSeconds: 32.5,
    });
    expect(response.body.data[1]).toMatchObject({
      rank: 1,
      studentId: 'student-3',
      resultId: 'result-3',
      timeInSeconds: 32.5,
    });
  });

  it('returns official contexts, style distribution and evolution analytics', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'analytics-1',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        date: '2026-01-10',
        time: '00:33.90',
        timeInSeconds: 33.9,
      }),
      makeResult({
        id: 'analytics-2',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        date: '2026-02-10',
        time: '00:33.10',
        timeInSeconds: 33.1,
      }),
      makeResult({
        id: 'analytics-3',
        studentId: 'student-2',
        studentName: 'Bruno',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Costas',
        distance: '100m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        date: '2026-02-14',
        time: '01:11.20',
        timeInSeconds: 71.2,
      }),
      makeResult({
        id: 'analytics-4',
        studentId: 'student-3',
        studentName: 'Caio',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        resultStatus: 'Desclassificado',
        date: '2026-02-18',
        time: '00:32.50',
        timeInSeconds: 32.5,
      }),
    );

    const contextsResponse = await request(app.getHttpServer())
      .get('/api/results/contexts?discipline=Piscina&category=Petiz%202')
      .expect(200);

    expect(contextsResponse.body.data).toHaveLength(2);
    expect(contextsResponse.body.data[0]).toMatchObject({
      discipline: 'Piscina',
      category: 'Petiz 2',
    });

    const distributionResponse = await request(app.getHttpServer())
      .get('/api/results/style-distribution?discipline=Piscina&category=Petiz%202')
      .expect(200);

    expect(distributionResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'Livre', count: 3 }),
        expect.objectContaining({ style: 'Costas', count: 1 }),
      ]),
    );

    const evolutionResponse = await request(app.getHttpServer())
      .get(
        '/api/results/evolution?discipline=Piscina&category=Petiz%202&chartStartDate=2026-01-01&chartEndDate=2026-12-31',
      )
      .expect(200);

    expect(evolutionResponse.body.data.students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentId: 'student-1', studentName: 'Ana' }),
        expect.objectContaining({ studentId: 'student-2', studentName: 'Bruno' }),
      ]),
    );
    expect(evolutionResponse.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ monthKey: '2026-01' }),
        expect.objectContaining({ monthKey: '2026-02' }),
      ]),
    );
  });
});


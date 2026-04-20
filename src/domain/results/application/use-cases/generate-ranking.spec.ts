import { beforeEach, describe, expect, it } from '@jest/globals';
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository';
import { makeResult } from '../../../../../test/factories/make-result';
import { GenerateRankingUseCase } from './generate-ranking';

describe('GenerateRankingUseCase', () => {
  let resultsRepository: InMemoryResultsRepository;
  let sut: GenerateRankingUseCase;

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository();
    sut = new GenerateRankingUseCase(resultsRepository);
  });

  it('builds a ranking using the best classified result per student under the same conditions', async () => {
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
        time: '00:34.20',
        timeInSeconds: 34.2,
        date: '2026-03-20',
      }),
      makeResult({
        id: 'result-2',
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
        date: '2026-04-01',
      }),
      makeResult({
        id: 'result-3',
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
        date: '2026-03-25',
      }),
      makeResult({
        id: 'result-4',
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
        date: '2026-03-26',
      }),
      makeResult({
        id: 'result-5',
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
        date: '2026-03-27',
      }),
      makeResult({
        id: 'result-6',
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
        date: '2026-03-28',
      }),
    );

    const { ranking, meta } = await sut.execute({
      page: 1,
      perPage: 10,
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      style: 'Livre',
      distance: '50m',
      eventFormat: 'Prova Individual',
      category: 'Petiz 2',
    });

    expect(meta.total).toBe(3);
    expect(ranking).toHaveLength(3);
    expect(ranking[0]).toMatchObject({
      rank: 1,
      studentId: 'student-2',
      resultId: 'result-3',
      timeInSeconds: 32.5,
    });
    expect(ranking[1]).toMatchObject({
      rank: 1,
      studentId: 'student-3',
      resultId: 'result-4',
      timeInSeconds: 32.5,
    });
    expect(ranking[2]).toMatchObject({
      rank: 3,
      studentId: 'student-1',
      resultId: 'result-2',
      timeInSeconds: 33.9,
    });
  });
});

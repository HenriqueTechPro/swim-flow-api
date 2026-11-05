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
  it('uses the recorded result year and category snapshot without reclassifying prior seasons', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'mirim-2025',
        studentId: 'same-athlete',
        category: 'Mirim 2',
        date: '2025-12-31',
        time: '00:30.00',
        timeInSeconds: 30,
      }),
      makeResult({
        id: 'petiz-2026',
        studentId: 'same-athlete',
        category: 'Petiz 1',
        date: '2026-01-01',
        time: '00:32.00',
        timeInSeconds: 32,
      }),
      makeResult({
        id: 'petiz-2026-late',
        studentId: 'other-athlete',
        category: 'Petiz 1',
        date: '2026-12-31',
        time: '00:33.00',
        timeInSeconds: 33,
      }),
      makeResult({
        id: 'petiz-2027',
        studentId: 'future-athlete',
        category: 'Petiz 1',
        date: '2027-01-01',
        time: '00:28.00',
        timeInSeconds: 28,
      }),
    );

    const request = {
      page: 1,
      perPage: 10,
      discipline: 'Piscina' as const,
      competitionType: 'Piscina' as const,
      courseType: 'Piscina Curta' as const,
      style: 'Livre' as const,
      distance: '50m',
      eventFormat: 'Prova Individual' as const,
      category: 'Petiz 1',
    };

    const currentYear = await sut.execute({ ...request, year: 2026 });
    expect(currentYear.meta.total).toBe(2);
    expect(currentYear.ranking.map((entry) => entry.resultId)).toEqual([
      'petiz-2026',
      'petiz-2026-late',
    ]);
    expect(currentYear.ranking.map((entry) => entry.rank)).toEqual([1, 2]);

    const previousYear = await sut.execute({
      ...request,
      category: 'Mirim 2',
      year: 2025,
    });
    expect(previousYear.ranking[0]).toMatchObject({
      studentId: 'same-athlete',
      resultId: 'mirim-2025',
      category: 'Mirim 2',
      rank: 1,
    });

    const allYears = await sut.execute(request);
    expect(allYears.meta.total).toBe(3);
    expect(allYears.ranking[0].resultId).toBe('petiz-2027');
  });

  it('separates gender rankings before calculating positions while preserving the legacy view', async () => {
    resultsRepository.studentGenders.set('student-a', 'Feminino');
    resultsRepository.studentGenders.set('student-b', 'Feminino');
    resultsRepository.studentGenders.set('student-c', 'Masculino');
    resultsRepository.items.push(
      makeResult({
        studentId: 'student-a',
        studentName: 'Ana',
        time: '00:34.20',
        timeInSeconds: 34.2,
      }),
      makeResult({
        studentId: 'student-b',
        studentName: 'Bia',
        time: '00:34.20',
        timeInSeconds: 34.2,
      }),
      makeResult({
        studentId: 'student-c',
        studentName: 'Caio',
        time: '00:30.00',
        timeInSeconds: 30,
      }),
    );

    const request = {
      page: 1,
      perPage: 10,
      discipline: 'Piscina' as const,
      competitionType: 'Piscina' as const,
      courseType: 'Piscina Curta' as const,
      style: 'Livre' as const,
      distance: '50m',
      eventFormat: 'Prova Individual' as const,
      category: 'Petiz 2',
    };

    const female = await sut.execute({ ...request, gender: 'Feminino' });
    expect(female.meta.total).toBe(2);
    expect(female.ranking.map((entry) => entry.studentName)).toEqual([
      'Ana',
      'Bia',
    ]);
    expect(female.ranking.map((entry) => entry.rank)).toEqual([1, 1]);

    const male = await sut.execute({ ...request, gender: 'Masculino' });
    expect(male.meta.total).toBe(1);
    expect(male.ranking[0]).toMatchObject({
      studentId: 'student-c',
      rank: 1,
    });

    const legacy = await sut.execute(request);
    expect(legacy.meta.total).toBe(3);
    expect(legacy.ranking.map((entry) => entry.rank)).toEqual([1, 2, 2]);
  });
});

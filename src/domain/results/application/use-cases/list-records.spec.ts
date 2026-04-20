import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository';
import { makeResult } from '../../../../../test/factories/make-result';
import { ListRecordsUseCase } from './list-records';

describe('ListRecordsUseCase', () => {
  let resultsRepository: InMemoryResultsRepository;
  let sut: ListRecordsUseCase;

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository();
    sut = new ListRecordsUseCase(resultsRepository);
  });

  it('returns the best classified result for each competitive context', async () => {
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
        distance: '100m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '01:10.20',
        timeInSeconds: 70.2,
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
        category: 'Petiz 2',
        time: '00:31.90',
        timeInSeconds: 31.9,
        resultStatus: 'Desclassificado',
      }),
    );

    const { records, meta } = await sut.execute();

    expect(meta.total).toBe(2);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ id: 'result-2', distance: '50m' });
    expect(records[1]).toMatchObject({ id: 'result-3', distance: '100m' });
  });
});

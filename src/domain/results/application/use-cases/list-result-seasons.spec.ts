import { ResultSeasonsRepository } from '../repositories/result-seasons-repository';
import { ListResultSeasonsUseCase } from './list-result-seasons';

describe('ListResultSeasonsUseCase', () => {
  it('returns seasons and metadata without changing any records', async () => {
    const repository: ResultSeasonsRepository = {
      create: jest.fn(),
      update: jest.fn(),
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            year: 2026,
            label: 'Temporada 2026',
            startsOn: '2025-09-01',
            endsOn: '2026-08-31',
            status: 'ACTIVE',
          },
        ],
        page: 1,
        perPage: 25,
        total: 1,
      }),
    };
    const sut = new ListResultSeasonsUseCase(repository);

    const response = await sut.execute({ page: 1, perPage: 25 });

    expect(response.seasons).toHaveLength(1);
    expect(response.meta).toEqual({ page: 1, perPage: 25, total: 1 });
    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      perPage: 25,
    });
  });
});

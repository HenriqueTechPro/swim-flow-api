import type { ListResultsRepositoryParams } from '../repositories/results-repository';
import { ResultsRepository } from '../repositories/results-repository';
import { ResultRecordPolicy } from '../services/result-record-policy';

export class ListRecordsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ListResultsRepositoryParams) {
    const results = await this.resultsRepository.listRecordCandidates(params);
    const records = ResultRecordPolicy.build(results);

    return {
      records,
      meta: {
        page: 1,
        perPage: records.length === 0 ? 1 : records.length,
        total: records.length,
      },
    };
  }
}

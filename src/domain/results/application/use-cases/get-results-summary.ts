import {
  ResultsRepository,
  type ListResultsRepositoryParams,
} from '../repositories/results-repository';

export class GetResultsSummaryUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ListResultsRepositoryParams) {
    const summary = await this.resultsRepository.summary(params);

    return {
      summary,
    };
  }
}

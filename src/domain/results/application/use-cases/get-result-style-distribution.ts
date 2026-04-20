import {
  ResultsRepository,
  type ListResultsRepositoryParams,
} from '../repositories/results-repository';

export class GetResultStyleDistributionUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ListResultsRepositoryParams) {
    const distribution =
      await this.resultsRepository.getStyleDistribution(params);

    return {
      distribution,
    };
  }
}

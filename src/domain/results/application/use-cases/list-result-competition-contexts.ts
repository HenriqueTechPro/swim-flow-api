import {
  ResultsRepository,
  type ListResultsRepositoryParams,
} from '../repositories/results-repository';

export class ListResultCompetitionContextsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ListResultsRepositoryParams) {
    const contexts =
      await this.resultsRepository.listCompetitionContexts(params);

    return {
      contexts,
    };
  }
}

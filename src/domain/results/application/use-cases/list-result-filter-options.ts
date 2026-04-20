import { ResultsRepository } from '../repositories/results-repository';

export class ListResultFilterOptionsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute() {
    const options = await this.resultsRepository.listFilterOptions();

    return {
      options,
    };
  }
}

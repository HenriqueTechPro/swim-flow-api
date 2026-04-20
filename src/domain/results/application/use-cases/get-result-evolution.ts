import {
  ResultsRepository,
  type ResultEvolutionParams,
} from '../repositories/results-repository';

export class GetResultEvolutionUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ResultEvolutionParams) {
    const evolution = await this.resultsRepository.getEvolution(params);

    return {
      evolution,
    };
  }
}

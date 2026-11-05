import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils';
import type { ListCompetitionPlacementsRequest } from '../dtos/result-competition-placements';
import { ResultsRepository } from '../repositories/results-repository';

export class ListCompetitionPlacementsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(input: ListCompetitionPlacementsRequest) {
    const response = await this.resultsRepository.listCompetitionPlacements(
      input,
    );
    return {
      placements: response.items,
      meta: toPaginationMeta(response),
    };
  }
}

import { paginateItems, toPaginationMeta } from '@/domain/shared/pagination/pagination-utils';
import type { GenerateRankingRequest } from '../dtos/result-ranking';
import { ResultsRepository } from '../repositories/results-repository';
import { ResultRankingPolicy } from '../services/result-ranking-policy';

export class GenerateRankingUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(input: GenerateRankingRequest) {
    const comparableResults = await this.resultsRepository.listRankingCandidates(
      input,
    );
    const ranking = ResultRankingPolicy.build(comparableResults);
    const paginatedRanking = paginateItems(ranking, input);

    return {
      ranking: paginatedRanking.items,
      meta: toPaginationMeta(paginatedRanking),
    };
  }
}

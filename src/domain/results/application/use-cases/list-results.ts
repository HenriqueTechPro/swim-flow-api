import { Injectable } from '@nestjs/common'
import { ResultsRepository, type ListResultsRepositoryParams } from '../repositories/results-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListResultsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(params?: ListResultsRepositoryParams) {
    const result = await this.resultsRepository.list(params)
    return {
      results: result.items,
      meta: toPaginationMeta(result),
    }
  }
}

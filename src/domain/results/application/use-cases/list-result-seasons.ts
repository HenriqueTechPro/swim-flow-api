import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';
import { ResultSeasonsRepository } from '../repositories/result-seasons-repository';

export class ListResultSeasonsUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  async execute(params?: PaginationParams) {
    const result = await this.seasons.list(params);
    return {
      seasons: result.items,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
      },
    };
  }
}

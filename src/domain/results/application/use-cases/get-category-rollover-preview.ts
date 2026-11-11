import { ResultSeasonsRepository } from '../repositories/result-seasons-repository';

/** Preview only; never writes a category, status, student or result. */
export class GetCategoryRolloverPreviewUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  execute(id: string, params: { page: number; perPage: number }) {
    return this.seasons.categoryRolloverPreview(id, params);
  }
}

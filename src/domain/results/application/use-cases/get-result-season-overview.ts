import {
  ResultSeasonsRepository,
  type ResultSeasonOverviewFilters,
} from '../repositories/result-seasons-repository';

/** Provides scoped historical metrics; never edits or backfills season links. */
export class GetResultSeasonOverviewUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  execute(id: string, filters: ResultSeasonOverviewFilters) {
    return this.seasons.overview(id, filters);
  }
}

import { ResultSeasonsRepository } from '../repositories/result-seasons-repository';

/** One read-only season-scoped view. No assignment or backfill is performed. */
export class GetStudentSeasonCompositionUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  execute(seasonId: string) {
    return this.seasons.studentComposition(seasonId);
  }
}

import {
  ResultSeasonsRepository,
  type WriteResultSeasonInput,
} from '../repositories/result-seasons-repository';

export class UpdateResultSeasonUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  async execute(id: string, input: WriteResultSeasonInput) {
    const season = await this.seasons.update(id, input);
    return { season };
  }
}

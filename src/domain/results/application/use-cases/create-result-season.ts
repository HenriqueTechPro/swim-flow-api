import {
  ResultSeasonsRepository,
  type WriteResultSeasonInput,
} from '../repositories/result-seasons-repository';

export class CreateResultSeasonUseCase {
  constructor(private readonly seasons: ResultSeasonsRepository) {}

  async execute(input: WriteResultSeasonInput) {
    const season = await this.seasons.create(input);
    return { season };
  }
}

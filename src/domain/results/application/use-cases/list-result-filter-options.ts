import { Injectable } from '@nestjs/common'
import { ResultsRepository } from '../repositories/results-repository'

@Injectable()
export class ListResultFilterOptionsUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute() {
    const options = await this.resultsRepository.getFilterOptions()

    return {
      options,
    }
  }
}

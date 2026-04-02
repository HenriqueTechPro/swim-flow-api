import { Injectable } from '@nestjs/common'
import { ResultsRepository } from '../repositories/results-repository'

@Injectable()
export class DeleteResultUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(id: string) {
    const result = await this.resultsRepository.remove(id)
    return { result }
  }
}

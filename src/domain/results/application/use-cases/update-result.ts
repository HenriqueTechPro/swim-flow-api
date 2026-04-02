import { Injectable } from '@nestjs/common'
import type { UpdateResultRequest } from '../dtos/result-requests'
import { ResultsRepository } from '../repositories/results-repository'

@Injectable()
export class UpdateResultUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(id: string, input: UpdateResultRequest) {
    const result = await this.resultsRepository.update(id, input)
    return { result }
  }
}

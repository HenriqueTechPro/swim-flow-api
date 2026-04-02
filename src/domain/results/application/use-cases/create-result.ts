import { Injectable } from '@nestjs/common'
import type { CreateResultRequest } from '../dtos/result-requests'
import { ResultsRepository } from '../repositories/results-repository'

@Injectable()
export class CreateResultUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(input: CreateResultRequest) {
    const result = await this.resultsRepository.create(input)
    return { result }
  }
}

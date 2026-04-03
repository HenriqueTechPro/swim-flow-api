import { Injectable } from '@nestjs/common'
import type { UpdateResultRequest } from '../dtos/result-requests'
import { validateResultCompetitionContext } from './validate-result-competition-context'
import { ResultsRepository } from '../repositories/results-repository'

@Injectable()
export class UpdateResultUseCase {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  async execute(id: string, input: UpdateResultRequest) {
    validateResultCompetitionContext(input)
    const result = await this.resultsRepository.update(id, input)
    return { result }
  }
}


import { Injectable } from '@nestjs/common'
import type { CreateTrainingRequest } from '../dtos/training-requests'
import { TrainingsRepository } from '../repositories/trainings-repository'

@Injectable()
export class CreateTrainingUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(input: CreateTrainingRequest) {
    const training = await this.trainingsRepository.create(input)
    return { training }
  }
}

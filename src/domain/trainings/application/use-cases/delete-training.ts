import { Injectable } from '@nestjs/common'
import { TrainingsRepository } from '../repositories/trainings-repository'

@Injectable()
export class DeleteTrainingUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(id: string) {
    const training = await this.trainingsRepository.remove(id)
    return { training }
  }
}

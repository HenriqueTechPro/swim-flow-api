import { Injectable } from '@nestjs/common'
import { TrainingsRepository } from '../repositories/trainings-repository'

@Injectable()
export class UnenrollTrainingStudentUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(trainingId: string, studentId: string) {
    const training = await this.trainingsRepository.unenroll(trainingId, studentId)
    return { training }
  }
}

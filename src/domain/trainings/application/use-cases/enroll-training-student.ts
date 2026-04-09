import { Injectable } from '@nestjs/common'
import { TrainingsRepository } from '../repositories/trainings-repository'

@Injectable()
export class EnrollTrainingStudentUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(trainingId: string, studentId: string) {
    const training = await this.trainingsRepository.enroll(trainingId, studentId)
    return { training }
  }
}

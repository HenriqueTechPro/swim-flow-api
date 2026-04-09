import type { CreateTrainingDto, TrainingEnrollmentDto, UpdateTrainingDto } from '@/shared/contracts/trainings.contracts'
import type { CreateTrainingRequest, UpdateTrainingRequest } from '@/domain/trainings/application/dtos/training-requests'

export class TrainingRequestMapper {
  static toCreate(body: CreateTrainingDto): CreateTrainingRequest {
    return { ...body }
  }

  static toUpdate(body: UpdateTrainingDto): UpdateTrainingRequest {
    return { ...body }
  }

  static toEnrollment(body: TrainingEnrollmentDto) {
    return body.studentId
  }
}

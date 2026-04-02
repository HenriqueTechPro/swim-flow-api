import type { CreateTrainingDto, UpdateTrainingDto } from '@/shared/contracts/management'
import type { CreateTrainingRequest, UpdateTrainingRequest } from '@/domain/trainings/application/dtos/training-requests'

export class TrainingRequestMapper {
  static toCreate(body: CreateTrainingDto): CreateTrainingRequest {
    return { ...body }
  }

  static toUpdate(body: UpdateTrainingDto): UpdateTrainingRequest {
    return { ...body }
  }
}

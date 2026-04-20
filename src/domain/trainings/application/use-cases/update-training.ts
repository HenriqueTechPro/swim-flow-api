import type { UpdateTrainingRequest } from '../dtos/training-requests';
import { TrainingsRepository } from '../repositories/trainings-repository';

export class UpdateTrainingUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(id: string, input: UpdateTrainingRequest) {
    const training = await this.trainingsRepository.update(id, input);
    return { training };
  }
}

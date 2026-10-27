import { AppError } from '@/shared/errors/app-error';
import { TrainingsRepository } from '../repositories/trainings-repository';

export class GetTrainingUseCase {
  constructor(private readonly repository: TrainingsRepository) {}

  async execute(id: string) {
    const training = await this.repository.findById(id);
    if (!training) throw new AppError(404, 'Training not found');
    return { training };
  }
}

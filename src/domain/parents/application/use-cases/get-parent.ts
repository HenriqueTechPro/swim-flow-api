import { AppError } from '@/shared/errors/app-error';
import { ParentsRepository } from '../repositories/parents-repository';

export class GetParentUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(id: string) {
    const parent = await this.parentsRepository.findById(id);
    if (!parent) {
      throw new AppError(404, 'Parent not found');
    }
    return { parent };
  }
}

import { AppError } from '@/shared/errors/app-error';
import { ClassesRepository } from '../repositories/classes-repository';

export class GetClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(id: string, teacherProfileId?: string) {
    const classItem = await this.classesRepository.findById(
      id,
      teacherProfileId,
    );
    if (!classItem) throw new AppError(404, 'Class not found');
    return { classItem };
  }
}

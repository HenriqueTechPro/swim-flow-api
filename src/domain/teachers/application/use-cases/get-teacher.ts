import { AppError } from '@/shared/errors/app-error';
import { TeachersRepository } from '../repositories/teachers-repository';

export class GetTeacherUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(id: string) {
    const teacher = await this.teachersRepository.findById(id);
    if (!teacher) throw new AppError(404, 'Teacher not found');
    return { teacher };
  }
}

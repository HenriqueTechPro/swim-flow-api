import { AppError } from '@/shared/errors/app-error';
import { StudentsRepository } from '../repositories/students-repository';

export class ListStudentSeasonCategoriesUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(studentId: string) {
    const student = await this.studentsRepository.findById(studentId);
    if (!student) throw new AppError(404, 'Student not found');

    return {
      categories: await this.studentsRepository.listSeasonCategories(studentId),
    };
  }
}

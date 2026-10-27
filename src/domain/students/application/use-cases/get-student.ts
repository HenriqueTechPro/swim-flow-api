import { AppError } from '@/shared/errors/app-error';
import { StudentsRepository } from '../repositories/students-repository';

export class GetStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(id: string, teacherProfileId?: string) {
    const student = await this.studentsRepository.findById(
      id,
      teacherProfileId,
    );
    if (!student) throw new AppError(404, 'Student not found');
    return { student };
  }
}

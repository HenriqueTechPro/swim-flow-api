import { StudentsRepository } from '../repositories/students-repository';

export class DeleteStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(id: string) {
    const student = await this.studentsRepository.remove(id);

    return {
      student,
    };
  }
}

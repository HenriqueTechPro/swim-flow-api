import type { AssignClassTeacherRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';

export class AddClassTeacherUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(classId: string, input: AssignClassTeacherRequest) {
    const classItem = await this.classesRepository.addTeacher(classId, input);

    return {
      classItem,
    };
  }
}

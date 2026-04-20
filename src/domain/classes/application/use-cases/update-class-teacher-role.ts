import type { UpdateClassTeacherRoleRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';

export class UpdateClassTeacherRoleUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(
    classId: string,
    teacherId: string,
    input: UpdateClassTeacherRoleRequest,
  ) {
    const classItem = await this.classesRepository.updateTeacherRole(
      classId,
      teacherId,
      input,
    );

    return {
      classItem,
    };
  }
}

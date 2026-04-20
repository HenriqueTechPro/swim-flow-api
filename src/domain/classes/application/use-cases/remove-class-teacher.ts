import { ClassesRepository } from '../repositories/classes-repository';

export class RemoveClassTeacherUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(classId: string, teacherId: string) {
    const classItem = await this.classesRepository.removeTeacher(
      classId,
      teacherId,
    );

    return {
      classItem,
    };
  }
}

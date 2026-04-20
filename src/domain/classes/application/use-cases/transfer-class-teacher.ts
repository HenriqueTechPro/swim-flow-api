import type { TransferTeacherRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';

export class TransferClassTeacherUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: TransferTeacherRequest) {
    const classItem = await this.classesRepository.transferTeacher(input);

    return {
      classItem,
    };
  }
}

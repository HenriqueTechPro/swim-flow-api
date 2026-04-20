import type { TransferStudentRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';

export class TransferClassStudentUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: TransferStudentRequest) {
    const classItem = await this.classesRepository.transferStudent(input);

    return {
      classItem,
    };
  }
}

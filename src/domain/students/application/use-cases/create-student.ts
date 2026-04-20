import type { CreateStudentRequest } from '../dtos/student-requests';
import { StudentsRepository } from '../repositories/students-repository';
import { StudentProfilePolicy } from '../services/student-profile-policy';

export class CreateStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(input: CreateStudentRequest) {
    const referenceData = await this.studentsRepository.listReferenceData();
    const persistenceInput = StudentProfilePolicy.resolvePersistenceInput(
      input,
      referenceData,
    );
    const student = await this.studentsRepository.create(persistenceInput);

    return {
      student,
    };
  }
}
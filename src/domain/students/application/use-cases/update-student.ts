import type { UpdateStudentRequest } from '../dtos/student-requests';
import { StudentsRepository } from '../repositories/students-repository';
import { StudentProfilePolicy } from '../services/student-profile-policy';

export class UpdateStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(id: string, input: UpdateStudentRequest) {
    const referenceData = await this.studentsRepository.listReferenceData();
    const persistenceInput = StudentProfilePolicy.resolvePersistenceInput(
      input,
      referenceData,
    );
    const student = await this.studentsRepository.update(id, persistenceInput);

    return {
      student,
    };
  }
}
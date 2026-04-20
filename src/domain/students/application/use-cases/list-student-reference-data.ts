import {
  StudentsRepository,
  type StudentReferenceData,
} from '../repositories/students-repository';

export class ListStudentReferenceDataUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(): Promise<StudentReferenceData> {
    return this.studentsRepository.listReferenceData();
  }
}

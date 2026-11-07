import { StudentPhysicalAssessmentsRepository } from '../repositories/student-physical-assessments-repository';

export class ListStudentPhysicalAssessmentsUseCase {
  constructor(private readonly assessments: StudentPhysicalAssessmentsRepository) {}

  execute(studentId: string) {
    return this.assessments.list(studentId);
  }
}

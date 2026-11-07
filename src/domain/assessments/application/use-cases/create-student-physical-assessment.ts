import { AnthropometryPolicy } from '../services/anthropometry.policy';
import {
  StudentPhysicalAssessmentsRepository,
  type CreateStudentPhysicalAssessmentInput,
} from '../repositories/student-physical-assessments-repository';

export class CreateStudentPhysicalAssessmentUseCase {
  constructor(
    private readonly assessments: StudentPhysicalAssessmentsRepository,
  ) {}

  execute(studentId: string, input: CreateStudentPhysicalAssessmentInput) {
    AnthropometryPolicy.validateAndDerive(input);
    return this.assessments.create(studentId, input);
  }
}

import type { AnthropometricMeasurements } from '../services/anthropometry.policy';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export interface StudentPhysicalAssessment extends AnthropometricMeasurements {
  id: string;
  studentId: string;
  measuredOn: string;
  measurementMethod: string | null;
  notes: string | null;
  assessorTeacherId: string | null;
  bodyMassIndex: number | null;
  armSpanMinusHeightCm: number | null;
}

export interface CreateStudentPhysicalAssessmentInput extends AnthropometricMeasurements {
  measuredOn: string;
  measurementMethod?: string | null;
  notes?: string | null;
}

export interface ListStudentPhysicalAssessmentsParams extends PaginationParams {
  year?: number;
  from?: string;
  to?: string;
}

/** A dedicated persistence boundary: assessment history never overwrites Student. */
export abstract class StudentPhysicalAssessmentsRepository {
  abstract list(studentId: string): Promise<StudentPhysicalAssessment[]>;
  abstract listPage(
    studentId: string,
    params: ListStudentPhysicalAssessmentsParams,
  ): Promise<PaginatedResult<StudentPhysicalAssessment>>;
  abstract create(
    studentId: string,
    input: CreateStudentPhysicalAssessmentInput,
  ): Promise<StudentPhysicalAssessment>;
}

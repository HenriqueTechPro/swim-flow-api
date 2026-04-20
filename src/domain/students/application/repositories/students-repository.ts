import type {
  CreateStudentRequest,
  UpdateStudentRequest,
} from '../dtos/student-requests';
import type { Student } from '../../enterprise/entities/student';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export interface CreateStudentRepositoryInput extends CreateStudentRequest {
  categoryId: string;
  levelId: string;
}

export type UpdateStudentRepositoryInput = CreateStudentRepositoryInput;

export interface StudentReferenceOption {
  id: string;
  name: string;
}

export interface StudentReferenceData {
  categories: StudentReferenceOption[];
  levels: StudentReferenceOption[];
}

export interface ListStudentsRepositoryParams extends PaginationParams {
  search?: string;
  category?: string;
  status?: string;
}

export abstract class StudentsRepository {
  abstract list(
    params?: ListStudentsRepositoryParams,
  ): Promise<PaginatedResult<Student>>;
  abstract listReferenceData(): Promise<StudentReferenceData>;
  abstract create(input: CreateStudentRepositoryInput): Promise<Student>;
  abstract update(
    id: string,
    input: UpdateStudentRepositoryInput,
  ): Promise<Student>;
  abstract remove(id: string): Promise<Student>;
}
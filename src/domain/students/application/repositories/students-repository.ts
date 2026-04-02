import type { CreateStudentRequest, UpdateStudentRequest } from '../dtos/student-requests'
import type { Student } from '../../enterprise/entities/student'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export type CreateStudentRepositoryInput = CreateStudentRequest
export type UpdateStudentRepositoryInput = UpdateStudentRequest
export interface ListStudentsRepositoryParams extends PaginationParams {
  search?: string
  category?: string
  status?: string
}

export abstract class StudentsRepository {
  abstract list(params?: ListStudentsRepositoryParams): Promise<PaginatedResult<Student>>
  abstract create(input: CreateStudentRepositoryInput): Promise<Student>
  abstract update(id: string, input: UpdateStudentRepositoryInput): Promise<Student>
  abstract remove(id: string): Promise<Student>
}

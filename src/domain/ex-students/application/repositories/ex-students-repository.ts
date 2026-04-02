import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student'
import type { CreateExStudentRequest, UpdateExStudentRequest } from '../dtos/ex-student-requests'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface CreateExStudentRepositoryInput extends CreateExStudentRequest {}
export interface UpdateExStudentRepositoryInput extends UpdateExStudentRequest {}
export interface ListExStudentsRepositoryParams extends PaginationParams {
  search?: string
  category?: string
}

export abstract class ExStudentsRepository {
  abstract list(params?: ListExStudentsRepositoryParams): Promise<PaginatedResult<ExStudent>>
  abstract create(input: CreateExStudentRepositoryInput): Promise<ExStudent>
  abstract update(id: string, input: UpdateExStudentRepositoryInput): Promise<ExStudent>
  abstract remove(id: string): Promise<ExStudent>
  abstract reactivate(id: string): Promise<ExStudent>
}

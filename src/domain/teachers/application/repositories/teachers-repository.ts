import type { CreateTeacherRequest, UpdateTeacherRequest } from '../dtos/teacher-requests'
import type { Teacher } from '../../enterprise/entities/teacher'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export type CreateTeacherRepositoryInput = CreateTeacherRequest
export type UpdateTeacherRepositoryInput = UpdateTeacherRequest
export interface ListTeachersRepositoryParams extends PaginationParams {
  search?: string
  status?: string
}

export abstract class TeachersRepository {
  abstract list(params?: ListTeachersRepositoryParams): Promise<PaginatedResult<Teacher>>
  abstract create(input: CreateTeacherRepositoryInput): Promise<Teacher>
  abstract update(id: string, input: UpdateTeacherRepositoryInput): Promise<Teacher>
  abstract remove(id: string): Promise<Teacher>
}

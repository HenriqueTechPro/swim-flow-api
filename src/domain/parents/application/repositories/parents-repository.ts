import type { Parent } from '@/domain/parents/enterprise/entities/parent'
import type { CreateParentRequest, UpdateParentRequest } from '../dtos/parent-requests'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface CreateParentRepositoryInput extends CreateParentRequest {}
export interface UpdateParentRepositoryInput extends UpdateParentRequest {}
export interface ListParentsRepositoryParams extends PaginationParams {
  search?: string
  status?: string
}

export abstract class ParentsRepository {
  abstract list(params?: ListParentsRepositoryParams): Promise<PaginatedResult<Parent>>
  abstract create(input: CreateParentRepositoryInput): Promise<Parent>
  abstract update(id: string, input: UpdateParentRepositoryInput): Promise<Parent>
  abstract remove(id: string): Promise<Parent>
}

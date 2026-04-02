import type {
  AssignClassTeacherRequest,
  CreateClassRequest,
  TransferStudentRequest,
  TransferTeacherRequest,
  UpdateClassRequest,
  UpdateClassTeacherRoleRequest,
} from '../dtos/class-requests'
import type { ClassEntity } from '../../enterprise/entities/class'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export type CreateClassRepositoryInput = CreateClassRequest
export type UpdateClassRepositoryInput = UpdateClassRequest
export type TransferTeacherRepositoryInput = TransferTeacherRequest
export type TransferStudentRepositoryInput = TransferStudentRequest
export type AssignClassTeacherRepositoryInput = AssignClassTeacherRequest
export type UpdateClassTeacherRoleRepositoryInput = UpdateClassTeacherRoleRequest

export interface ListClassesRepositoryParams extends PaginationParams {
  search?: string
  category?: string
  day?: string
  status?: string
  poolId?: string
}

export abstract class ClassesRepository {
  abstract list(params?: ListClassesRepositoryParams): Promise<PaginatedResult<ClassEntity>>
  abstract create(input: CreateClassRepositoryInput): Promise<ClassEntity>
  abstract update(id: string, input: UpdateClassRepositoryInput): Promise<ClassEntity>
  abstract addTeacher(classId: string, input: AssignClassTeacherRepositoryInput): Promise<ClassEntity>
  abstract updateTeacherRole(
    classId: string,
    teacherId: string,
    input: UpdateClassTeacherRoleRepositoryInput,
  ): Promise<ClassEntity>
  abstract removeTeacher(classId: string, teacherId: string): Promise<ClassEntity>
  abstract transferTeacher(input: TransferTeacherRepositoryInput): Promise<ClassEntity>
  abstract transferStudent(input: TransferStudentRepositoryInput): Promise<ClassEntity>
  abstract remove(id: string): Promise<ClassEntity>
}

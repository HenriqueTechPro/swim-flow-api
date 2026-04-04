import type { CreateExStudentDto, UpdateExStudentDto } from '@/shared/contracts/ex-students.contracts'
import type { CreateExStudentRequest, UpdateExStudentRequest } from '@/domain/ex-students/application/dtos/ex-student-requests'

export class ExStudentRequestMapper {
  static toCreate(body: CreateExStudentDto): CreateExStudentRequest {
    return { ...body }
  }

  static toUpdate(body: UpdateExStudentDto): UpdateExStudentRequest {
    return { ...body }
  }
}

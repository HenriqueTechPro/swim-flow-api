import type { CreateStudentDto, UpdateStudentDto } from '@/shared/contracts/students.contracts'
import type { CreateStudentRequest, UpdateStudentRequest } from '@/domain/students/application/dtos/student-requests'

export class StudentRequestMapper {
  static toCreate(body: CreateStudentDto): CreateStudentRequest {
    return {
      name: body.name,
      gender: body.gender,
      birthDate: body.birthDate,
      level: body.level,
      parentId: body.parentId ?? null,
      classId: body.classId ?? null,
      phone: body.phone,
      status: body.status,
      photo: body.photo ?? null,
    }
  }

  static toUpdate(body: UpdateStudentDto): UpdateStudentRequest {
    return StudentRequestMapper.toCreate(body)
  }
}

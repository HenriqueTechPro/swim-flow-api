import type {
  AssignClassTeacherDto,
  CreateClassDto,
  TransferTeacherDto,
  TransferStudentDto,
  UpdateClassDto,
  UpdateClassTeacherRoleDto,
} from '@/shared/contracts/management'
import type {
  AssignClassTeacherRequest,
  CreateClassRequest,
  TransferStudentRequest,
  TransferTeacherRequest,
  UpdateClassRequest,
  UpdateClassTeacherRoleRequest,
} from '@/domain/classes/application/dtos/class-requests'

export class ClassRequestMapper {
  static toCreate(body: CreateClassDto): CreateClassRequest {
    return {
      name: body.name,
      categories: body.categories,
      schedules: body.schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })),
      classTeachers: body.classTeachers.map((teacher) => ({
        teacherId: teacher.teacherId,
        role: teacher.role,
      })),
      maxStudents: body.maxStudents,
      poolId: body.poolId ?? null,
      status: body.status,
    }
  }

  static toUpdate(body: UpdateClassDto): UpdateClassRequest {
    return {
      ...ClassRequestMapper.toCreate(body),
      categoryIds: body.categoryIds,
    }
  }

  static toAssignTeacher(body: AssignClassTeacherDto): AssignClassTeacherRequest {
    return {
      teacherId: body.teacherId,
      role: body.role,
    }
  }

  static toUpdateTeacherRole(body: UpdateClassTeacherRoleDto): UpdateClassTeacherRoleRequest {
    return {
      role: body.role,
    }
  }

  static toTransferTeacher(body: TransferTeacherDto): TransferTeacherRequest {
    return {
      teacherId: body.teacherId,
      fromClassId: body.fromClassId,
      toClassId: body.toClassId,
    }
  }

  static toTransferStudent(body: TransferStudentDto): TransferStudentRequest {
    return {
      studentId: body.studentId,
      fromClassId: body.fromClassId,
      toClassId: body.toClassId,
    }
  }
}

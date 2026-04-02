export interface ClassScheduleRequest {
  dayOfWeek: string
  startTime: string
  endTime: string
}

export interface ClassTeacherRequest {
  teacherId: string
  role: 'head_coach' | 'assistant_coach'
}

export interface CreateClassRequest {
  name: string
  categories: string[]
  schedules: ClassScheduleRequest[]
  classTeachers: ClassTeacherRequest[]
  maxStudents: number
  poolId?: string | null
  status: 'Ativa' | 'Pausada' | 'Encerrada'
}

export interface UpdateClassRequest extends CreateClassRequest {
  categoryIds?: string[]
}

export interface TransferTeacherRequest {
  teacherId: string
  fromClassId: string
  toClassId: string
}

export interface TransferStudentRequest {
  studentId: string
  fromClassId: string
  toClassId: string
}

export interface AssignClassTeacherRequest {
  teacherId: string
  role: 'head_coach' | 'assistant_coach'
}

export interface UpdateClassTeacherRoleRequest {
  role: 'head_coach' | 'assistant_coach'
}

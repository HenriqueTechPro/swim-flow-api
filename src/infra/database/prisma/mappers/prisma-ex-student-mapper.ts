import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student'

export interface PrismaExStudentRecord {
  id: string
  studentId: string | null
  name: string
  category: string
  categorySnapshot: string | null
  exitDate: string
  exitDateAt: Date | null
  exitReason: string
  exitReasonCode: string | null
  exitNotes: string | null
  phone: string
  responsible: string
  responsibleSnapshot: string | null
  parentId: string | null
  achievements: number
  lastCompetition: string
  birthYear: number
  birthDate: Date | null
  level: string
  levelSnapshot: string | null
}

export class PrismaExStudentMapper {
  static toDomain(exStudent: PrismaExStudentRecord): ExStudent {
    return {
      id: exStudent.id,
      studentId: exStudent.studentId ?? undefined,
      name: exStudent.name,
      category: exStudent.categorySnapshot || exStudent.category,
      exitDate: exStudent.exitDateAt ? exStudent.exitDateAt.toISOString().slice(0, 10) : exStudent.exitDate,
      exitReason: exStudent.exitReasonCode || exStudent.exitReason,
      exitNotes: exStudent.exitNotes ?? undefined,
      phone: exStudent.phone,
      responsible: exStudent.responsibleSnapshot || exStudent.responsible,
      parentId: exStudent.parentId ?? undefined,
      achievements: exStudent.achievements,
      lastCompetition: exStudent.lastCompetition,
      birthYear: exStudent.birthDate ? Number(exStudent.birthDate.toISOString().slice(0, 4)) : exStudent.birthYear,
      level: exStudent.levelSnapshot || exStudent.level,
    }
  }
}

import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student'

export class ExStudentPresenter {
  static toHTTP(exStudent: ExStudent) {
    return {
      id: exStudent.id,
      studentId: exStudent.studentId,
      name: exStudent.name,
      category: exStudent.category,
      exitDate: exStudent.exitDate,
      exitReason: exStudent.exitReason,
      exitNotes: exStudent.exitNotes,
      phone: exStudent.phone,
      responsible: exStudent.responsible,
      parentId: exStudent.parentId,
      achievements: exStudent.achievements,
      lastCompetition: exStudent.lastCompetition,
      birthYear: exStudent.birthYear,
      level: exStudent.level,
    }
  }
}

import type { Student } from '@/domain/students/enterprise/entities/student'

export class StudentPresenter {
  static toHTTP(student: Student) {
    return {
      id: student.id,
      name: student.name,
      photo: student.photo,
      gender: student.gender,
      birthDate: student.birthDate,
      birthYear: student.birthYear,
      category: student.category,
      level: student.level,
      responsible: student.responsible,
      parentId: student.parentId,
      classId: student.classId,
      phone: student.phone,
      status: student.status,
      achievements: student.achievements,
    }
  }
}

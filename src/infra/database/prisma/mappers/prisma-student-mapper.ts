import type { Student } from '@/domain/students/enterprise/entities/student'
import { formatCategoryLabel, formatEntityStatus } from '@/shared/utils/domain-formatters'

export interface PrismaStudentRecord {
  id: string
  name: string
  photo: string | null
  gender: 'Masculino' | 'Feminino' | 'Outro'
  birthDate: Date | null
  parentId: string | null
  phone: string
  status: string
  achievements: number
  category: { name: string }
  level: { name: string }
  parent: { name: string } | null
  studentClasses: Array<{ classId: string }>
}

const getBirthYearFromDate = (birthDate?: Date | null) => {
  if (!birthDate) return new Date().getFullYear()
  return birthDate.getUTCFullYear()
}

export class PrismaStudentMapper {
  static toDomain(student: PrismaStudentRecord): Student {
    return {
      id: student.id,
      name: student.name,
      photo: student.photo ?? undefined,
      gender: student.gender,
      birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : '',
      birthYear: getBirthYearFromDate(student.birthDate),
      category: formatCategoryLabel(student.category.name),
      level: student.level.name,
      responsible: student.parent?.name ?? '',
      parentId: student.parentId ?? undefined,
      classId: student.studentClasses[0]?.classId ?? null,
      phone: student.phone,
      status: formatEntityStatus(student.status),
      achievements: student.achievements,
    }
  }
}

import type { Teacher } from '@/domain/teachers/enterprise/entities/teacher'
import { compressTeacherCategoryNames } from '@/shared/lib/teacher-categories'
import { formatCategoryLabel, formatEntityStatus } from '@/shared/utils/domain-formatters'

export interface PrismaTeacherRecord {
  id: string
  name: string
  photo: string | null
  cpf: string | null
  speciality: string
  experience: number
  phone: string
  email: string
  status: string
  birthDate: Date | null
  address: string | null
  bio: string | null
  teacherCategories: Array<{
    category: {
      name: string
    }
  }>
  teacherCertifications: Array<{
    name: string
  }>
  classTeachers: Array<{
    classId: string
  }>
}

export class PrismaTeacherMapper {
  static toDomain(
    teacher: PrismaTeacherRecord,
    classStudentCountMap: Map<string, number>,
  ): Teacher {
    const categoryNames = teacher.teacherCategories.map((item) => formatCategoryLabel(item.category.name))
    const classIds = [...new Set(teacher.classTeachers.map((item) => item.classId))]
    const studentsCount = classIds.reduce((sum, classId) => sum + (classStudentCountMap.get(classId) ?? 0), 0)

    return {
      id: teacher.id,
      name: teacher.name,
      photo: teacher.photo ?? undefined,
      cpf: teacher.cpf ?? undefined,
      speciality: teacher.speciality,
      categories: compressTeacherCategoryNames(categoryNames),
      experience: teacher.experience,
      phone: teacher.phone,
      email: teacher.email,
      status: formatEntityStatus(teacher.status) as Teacher['status'],
      studentsCount,
      birthDate: teacher.birthDate ? teacher.birthDate.toISOString().slice(0, 10) : undefined,
      address: teacher.address ?? undefined,
      bio: teacher.bio ?? undefined,
      certifications: teacher.teacherCertifications.map((item) => item.name),
    }
  }
}

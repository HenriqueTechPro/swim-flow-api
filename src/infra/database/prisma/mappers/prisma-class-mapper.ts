import type { ClassEntity } from '@/domain/classes/enterprise/entities/class'
import { formatMixedCategoryLabel, sortGroupedCategories } from '@/shared/lib/categories'
import { formatCategoryLabel, formatEntityStatus } from '@/shared/utils/domain-formatters'

const REFERENCE_YEAR = 2026

export interface PrismaClassRecord {
  id: string
  name: string
  maxStudents: number
  poolId: string | null
  status: string
  pool: { id: string; name: string; lengthMeters: number } | null
  classTeachers: Array<{
    id: string
    teacherId: string
    role: 'head_coach' | 'assistant_coach'
    teacher: { id: string; name: string; photo: string | null }
  }>
  classSchedules: Array<{
    id: string
    dayOfWeek: string
    startTime: Date
    endTime: Date
  }>
  studentClasses: Array<{
    student: {
      id: string
      name: string
      birthDate: Date | null
      status: string
      category: { name: string }
      level: { name: string }
    }
  }>
  classCategories: Array<{
    category: { id: string; name: string }
    isPrimary: boolean
  }>
}

const normalizeStudentStatus = (status: string): 'Ativo' | 'Inativo' =>
  formatEntityStatus(status) === 'Ativo' ? 'Ativo' : 'Inativo'

const getBirthYearFromDate = (birthDate?: Date | null) =>
  birthDate ? birthDate.getUTCFullYear() : REFERENCE_YEAR

const formatTime = (value: Date) => value.toISOString().slice(11, 16)

const mapRole = (role: 'head_coach' | 'assistant_coach'): 'head_coach' | 'assistant_coach' =>
  role === 'head_coach' ? 'head_coach' : 'assistant_coach'

const mapStatus = (status: string): ClassEntity['status'] => {
  if (status === 'Pausada') return 'Pausada'
  if (status === 'Encerrada') return 'Encerrada'
  return 'Ativa'
}

export class PrismaClassMapper {
  static toDomain(classItem: PrismaClassRecord): ClassEntity {
    const sortedCategories = sortGroupedCategories(
      classItem.classCategories.map((item) => formatCategoryLabel(item.category.name)),
    )
    const primaryCategory = classItem.classCategories.find((item) => item.isPrimary)?.category
    const primaryCategoryName = primaryCategory ? formatCategoryLabel(primaryCategory.name) : undefined
    const orderedCategories = sortGroupedCategories([
      primaryCategoryName ?? sortedCategories[0] ?? '',
      ...sortedCategories.filter((category) => category !== primaryCategoryName),
    ].filter(Boolean))

    const orderedCategoryIds = [
      ...(primaryCategory ? [primaryCategory.id] : []),
      ...classItem.classCategories
        .map((item) => item.category.id)
        .filter((id) => !primaryCategory || id !== primaryCategory.id),
    ]

    const schedules = classItem.classSchedules.map((schedule) => ({
      id: schedule.id,
      dayOfWeek: schedule.dayOfWeek,
      startTime: formatTime(schedule.startTime),
      endTime: formatTime(schedule.endTime),
    }))

    const students = classItem.studentClasses
      .map((item) => {
        if (item.student.status !== 'Ativo' && item.student.status !== 'Licenca') return null
        return {
          id: item.student.id,
          name: item.student.name,
          age: REFERENCE_YEAR - getBirthYearFromDate(item.student.birthDate),
          category: formatCategoryLabel(item.student.category.name),
          level: item.student.level.name,
          status: normalizeStudentStatus(item.student.status),
        }
      })
      .filter((student): student is NonNullable<typeof student> => Boolean(student))

    return {
      id: classItem.id,
      name: classItem.name,
      category: formatMixedCategoryLabel(orderedCategories),
      categories: orderedCategories,
      categoryIds: orderedCategoryIds,
      dayOfWeek: schedules[0]?.dayOfWeek ?? '',
      startTime: schedules[0]?.startTime ?? '',
      endTime: schedules[0]?.endTime ?? '',
      schedules,
      teachers: classItem.classTeachers.map((teacher) => teacher.teacher.name),
      classTeachers: classItem.classTeachers.map((teacher) => ({
        id: teacher.id,
        teacherId: teacher.teacherId,
        teacherName: teacher.teacher.name,
        role: mapRole(teacher.role),
        photo: teacher.teacher.photo ?? undefined,
      })),
      maxStudents: classItem.maxStudents,
      enrolledStudents: students.length,
      poolId: classItem.poolId ?? undefined,
      pool: classItem.pool ? `${classItem.pool.name} (${classItem.pool.lengthMeters}m)` : '',
      status: mapStatus(classItem.status),
      students,
    }
  }
}

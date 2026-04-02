import { AppError } from '@/shared/errors/app-error'
import type {
  AssignClassTeacherRepositoryInput,
  CreateClassRepositoryInput,
  ListClassesRepositoryParams,
  TransferStudentRepositoryInput,
  TransferTeacherRepositoryInput,
  UpdateClassRepositoryInput,
  UpdateClassTeacherRoleRepositoryInput,
} from '@/domain/classes/application/repositories/classes-repository'
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository'
import type { ClassEntity } from '@/domain/classes/enterprise/entities/class'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeClassEntity } from '../factories/make-class'

export class InMemoryClassesRepository implements ClassesRepository {
  public items: ClassEntity[] = []

  async list(params?: ListClassesRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const category = params?.category?.trim()
    const day = params?.day?.trim()
    const status = params?.status?.trim()
    const poolId = params?.poolId?.trim()

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.teachers.some((teacher) => teacher.toLowerCase().includes(search)) ||
        item.pool.toLowerCase().includes(search)
      const matchesCategory = !category || item.categories.includes(category)
      const matchesDay =
        !day ||
        item.schedules.some((schedule) => schedule.dayOfWeek === day) ||
        item.dayOfWeek === day
      const matchesStatus = !status || item.status === status
      const matchesPool = !poolId || item.poolId === poolId

      return matchesSearch && matchesCategory && matchesDay && matchesStatus && matchesPool
    })

    return paginateItems(filteredItems, params)
  }

  async create(input: CreateClassRepositoryInput): Promise<ClassEntity> {
    const classItem = makeClassEntity({
      name: input.name,
      category: input.categories.join(', '),
      categories: input.categories,
      categoryIds: input.categories.map(() => crypto.randomUUID()),
      schedules: input.schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        ...schedule,
      })),
      dayOfWeek: input.schedules[0]?.dayOfWeek ?? 'Segunda',
      startTime: input.schedules[0]?.startTime ?? '08:00',
      endTime: input.schedules[0]?.endTime ?? '09:00',
      maxStudents: input.maxStudents,
      poolId: input.poolId ?? undefined,
      status: input.status,
    })

    this.items.push(classItem)
    return classItem
  }

  async update(id: string, input: UpdateClassRepositoryInput): Promise<ClassEntity> {
    const itemIndex = this.items.findIndex((item) => item.id === id)

    if (itemIndex < 0) throw new AppError(404, 'Class not found')

    const updatedClass: ClassEntity = {
      ...this.items[itemIndex],
      name: input.name,
      category: input.categories.join(', '),
      categories: input.categories,
      schedules: input.schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        ...schedule,
      })),
      dayOfWeek: input.schedules[0]?.dayOfWeek ?? 'Segunda',
      startTime: input.schedules[0]?.startTime ?? '08:00',
      endTime: input.schedules[0]?.endTime ?? '09:00',
      maxStudents: input.maxStudents,
      poolId: input.poolId ?? undefined,
      status: input.status,
    }

    this.items[itemIndex] = updatedClass
    return updatedClass
  }

  async addTeacher(classId: string, input: AssignClassTeacherRepositoryInput): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId)

    if (!classItem) throw new AppError(404, 'Class not found')
    if (classItem.classTeachers.some((teacher) => teacher.teacherId === input.teacherId)) {
      throw new AppError(409, 'Teacher already assigned to class')
    }

    const teacherName = `Professor ${input.teacherId.slice(0, 4)}`
    classItem.classTeachers.push({
      id: crypto.randomUUID(),
      teacherId: input.teacherId,
      teacherName,
      role: input.role,
    })
    classItem.teachers = classItem.classTeachers.map((teacher) => teacher.teacherName)

    return classItem
  }

  async updateTeacherRole(
    classId: string,
    teacherId: string,
    input: UpdateClassTeacherRoleRepositoryInput,
  ): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId)
    if (!classItem) throw new AppError(404, 'Class not found')

    const teacher = classItem.classTeachers.find((item) => item.teacherId === teacherId)
    if (!teacher) throw new AppError(404, 'Teacher not found in class')

    teacher.role = input.role
    return classItem
  }

  async removeTeacher(classId: string, teacherId: string): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId)
    if (!classItem) throw new AppError(404, 'Class not found')

    classItem.classTeachers = classItem.classTeachers.filter((item) => item.teacherId !== teacherId)
    classItem.teachers = classItem.classTeachers.map((teacher) => teacher.teacherName)

    return classItem
  }

  async transferTeacher(input: TransferTeacherRepositoryInput): Promise<ClassEntity> {
    const sourceClass = this.items.find((item) => item.id === input.fromClassId)
    const targetClass = this.items.find((item) => item.id === input.toClassId)

    if (!sourceClass) throw new AppError(404, 'Source class not found')
    if (!targetClass) throw new AppError(404, 'Target class not found')

    const teacher = sourceClass.classTeachers.find((item) => item.teacherId === input.teacherId)
    if (!teacher) throw new AppError(404, 'Teacher not found in source class')

    sourceClass.classTeachers = sourceClass.classTeachers.filter((item) => item.teacherId !== input.teacherId)
    sourceClass.teachers = sourceClass.classTeachers.map((item) => item.teacherName)

    targetClass.classTeachers.push({
      ...teacher,
      id: crypto.randomUUID(),
    })
    targetClass.teachers = targetClass.classTeachers.map((item) => item.teacherName)

    return targetClass
  }

  async transferStudent(input: TransferStudentRepositoryInput): Promise<ClassEntity> {
    const sourceClass = this.items.find((item) => item.id === input.fromClassId)
    const targetClass = this.items.find((item) => item.id === input.toClassId)

    if (!sourceClass) throw new AppError(404, 'Source class not found')
    if (!targetClass) throw new AppError(404, 'Target class not found')

    const student = sourceClass.students.find((item) => item.id === input.studentId)
    if (!student) throw new AppError(404, 'Student not found in source class')
    if (targetClass.students.some((item) => item.id === input.studentId)) {
      throw new AppError(409, 'Student already assigned to target class')
    }

    sourceClass.students = sourceClass.students.filter((item) => item.id !== input.studentId)
    sourceClass.enrolledStudents = sourceClass.students.length

    targetClass.students.push(student)
    targetClass.enrolledStudents = targetClass.students.length

    return targetClass
  }

  async remove(id: string): Promise<ClassEntity> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Class not found')

    const [removedClass] = this.items.splice(itemIndex, 1)
    return removedClass
  }
}

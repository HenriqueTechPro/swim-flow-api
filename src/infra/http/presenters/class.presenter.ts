import type { ClassEntity } from '@/domain/classes/enterprise/entities/class'

export class ClassPresenter {
  static toHTTP(classItem: ClassEntity) {
    return {
      id: classItem.id,
      name: classItem.name,
      category: classItem.category,
      categories: classItem.categories,
      categoryIds: classItem.categoryIds,
      dayOfWeek: classItem.dayOfWeek,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      schedules: classItem.schedules,
      teachers: classItem.teachers,
      classTeachers: classItem.classTeachers,
      maxStudents: classItem.maxStudents,
      enrolledStudents: classItem.enrolledStudents,
      poolId: classItem.poolId,
      pool: classItem.pool,
      status: classItem.status,
      students: classItem.students,
    }
  }
}

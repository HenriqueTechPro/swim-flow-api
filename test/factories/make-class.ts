import type { ClassEntity } from '@/domain/classes/enterprise/entities/class'

interface MakeClassOverride extends Partial<ClassEntity> {}

export function makeClassEntity(override: MakeClassOverride = {}): ClassEntity {
  return {
    id: override.id ?? crypto.randomUUID(),
    name: override.name ?? 'Turma Teste',
    category: override.category ?? 'Mirim 1',
    categories: override.categories ?? ['Mirim 1'],
    categoryIds: override.categoryIds ?? [crypto.randomUUID()],
    dayOfWeek: override.dayOfWeek ?? 'Segunda-feira',
    startTime: override.startTime ?? '08:00',
    endTime: override.endTime ?? '09:00',
    schedules:
      override.schedules ?? [
        {
          id: crypto.randomUUID(),
          dayOfWeek: 'Segunda-feira',
          startTime: '08:00',
          endTime: '09:00',
        },
      ],
    teachers: override.teachers ?? [],
    classTeachers: override.classTeachers ?? [],
    maxStudents: override.maxStudents ?? 12,
    enrolledStudents: override.enrolledStudents ?? 0,
    poolId: override.poolId,
    pool: override.pool ?? '',
    status: override.status ?? 'Ativa',
    students: override.students ?? [],
  }
}

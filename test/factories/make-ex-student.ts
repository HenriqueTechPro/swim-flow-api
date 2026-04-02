import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student'

interface MakeExStudentOverride extends Partial<ExStudent> {}

export function makeExStudent(override: MakeExStudentOverride = {}): ExStudent {
  return {
    id: override.id ?? crypto.randomUUID(),
    studentId: override.studentId ?? crypto.randomUUID(),
    name: override.name ?? 'Ex-Aluno Teste',
    category: override.category ?? 'Petiz 2',
    exitDate: override.exitDate ?? '2026-03-31',
    exitReason: override.exitReason ?? 'Mudanca de cidade',
    exitNotes: override.exitNotes ?? '',
    phone: override.phone ?? '(71) 98888-1234',
    responsible: override.responsible ?? 'Responsavel Teste',
    parentId: override.parentId,
    achievements: override.achievements ?? 0,
    lastCompetition: override.lastCompetition ?? 'Festival Interno',
    birthYear: override.birthYear ?? 2014,
    level: override.level ?? 'Intermediário',
  }
}

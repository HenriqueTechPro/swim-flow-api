import type { Student } from '@/domain/students/enterprise/entities/student'

interface MakeStudentOverride extends Partial<Student> {}

export function makeStudent(override: MakeStudentOverride = {}): Student {
  return {
    id: override.id ?? crypto.randomUUID(),
    name: override.name ?? 'Aluno Teste',
    photo: override.photo,
    gender: override.gender ?? 'Masculino',
    birthDate: override.birthDate ?? '2014-05-10',
    birthYear: override.birthYear ?? 2014,
    category: override.category ?? 'Petiz 2',
    level: override.level ?? 'Iniciante',
    responsible: override.responsible ?? '',
    parentId: override.parentId,
    classId: override.classId ?? null,
    phone: override.phone ?? '(71) 99999-0000',
    status: override.status ?? 'Ativo',
    achievements: override.achievements ?? 0,
  }
}

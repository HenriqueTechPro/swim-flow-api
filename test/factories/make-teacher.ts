import type { Teacher } from '@/domain/teachers/enterprise/entities/teacher'

interface MakeTeacherOverride extends Partial<Teacher> {}

export function makeTeacher(override: MakeTeacherOverride = {}): Teacher {
  return {
    id: override.id ?? crypto.randomUUID(),
    name: override.name ?? 'Professor Teste',
    photo: override.photo,
    cpf: override.cpf ?? '123.456.789-00',
    speciality: override.speciality ?? 'Nado Livre',
    categories: override.categories ?? ['Mirim'],
    experience: override.experience ?? 5,
    phone: override.phone ?? '(71) 99999-1111',
    email: override.email ?? 'professor.teste@example.com',
    status: override.status ?? 'Ativo',
    studentsCount: override.studentsCount ?? 0,
    birthDate: override.birthDate ?? '1990-06-15',
    address: override.address,
    bio: override.bio ?? '',
    certifications: override.certifications ?? [],
  }
}

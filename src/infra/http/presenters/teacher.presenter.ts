import type { Teacher } from '@/domain/teachers/enterprise/entities/teacher'

export class TeacherPresenter {
  static toHTTP(teacher: Teacher) {
    return {
      id: teacher.id,
      name: teacher.name,
      photo: teacher.photo,
      cpf: teacher.cpf,
      speciality: teacher.speciality,
      categories: teacher.categories,
      experience: teacher.experience,
      phone: teacher.phone,
      email: teacher.email,
      status: teacher.status,
      studentsCount: teacher.studentsCount,
      birthDate: teacher.birthDate,
      address: teacher.address,
      bio: teacher.bio,
      certifications: teacher.certifications ?? [],
    }
  }
}

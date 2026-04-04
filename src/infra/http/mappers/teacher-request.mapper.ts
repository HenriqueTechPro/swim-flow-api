import type { CreateTeacherDto, UpdateTeacherDto } from '@/shared/contracts/teachers.contracts'
import type { CreateTeacherRequest, UpdateTeacherRequest } from '@/domain/teachers/application/dtos/teacher-requests'

export class TeacherRequestMapper {
  static toCreate(body: CreateTeacherDto): CreateTeacherRequest {
    return {
      name: body.name,
      cpf: body.cpf ?? null,
      birthDate: body.birthDate ?? null,
      email: body.email,
      phone: body.phone,
      photo: body.photo ?? null,
      specialities: body.specialities,
      categories: body.categories,
      experience: body.experience,
      certifications: body.certifications ?? '',
      status: body.status,
      bio: body.bio ?? null,
    }
  }

  static toUpdate(body: UpdateTeacherDto): UpdateTeacherRequest {
    return {
      name: body.name,
      cpf: body.cpf ?? null,
      birthDate: body.birthDate ?? null,
      email: body.email,
      phone: body.phone,
      photo: body.photo ?? null,
      specialities: body.specialities,
      categories: body.categories,
      experience: body.experience,
      certifications: body.certifications ?? '',
      status: body.status,
      bio: body.bio ?? null,
    }
  }
}

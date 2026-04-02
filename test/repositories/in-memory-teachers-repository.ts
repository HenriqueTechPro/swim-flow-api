import { AppError } from '@/shared/errors/app-error'
import type {
  CreateTeacherRepositoryInput,
  UpdateTeacherRepositoryInput,
} from '@/domain/teachers/application/repositories/teachers-repository'
import { TeachersRepository } from '@/domain/teachers/application/repositories/teachers-repository'
import type { Teacher } from '@/domain/teachers/enterprise/entities/teacher'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeTeacher } from '../factories/make-teacher'

export class InMemoryTeachersRepository implements TeachersRepository {
  public items: Teacher[] = []

  async list(params?: { page?: number; perPage?: number; search?: string; status?: string }) {
    const filtered = this.items.filter((teacher) => {
      const matchesSearch =
        !params?.search ||
        teacher.name.toLowerCase().includes(params.search.toLowerCase()) ||
        teacher.speciality.toLowerCase().includes(params.search.toLowerCase()) ||
        teacher.email.toLowerCase().includes(params.search.toLowerCase())
      const matchesStatus = !params?.status || teacher.status === params.status

      return matchesSearch && matchesStatus
    })

    return paginateItems(filtered, params)
  }

  async create(input: CreateTeacherRepositoryInput): Promise<Teacher> {
    const teacher = makeTeacher({
      name: input.name,
      cpf: input.cpf ?? undefined,
      birthDate: input.birthDate ?? undefined,
      email: input.email,
      phone: input.phone,
      photo: input.photo ?? undefined,
      speciality: input.specialities.join(', '),
      categories: input.categories,
      experience: Number(input.experience),
      status: input.status as Teacher['status'],
      bio: input.bio ?? undefined,
      certifications: input.certifications
        ? input.certifications
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    })

    this.items.push(teacher)

    return teacher
  }

  async update(id: string, input: UpdateTeacherRepositoryInput): Promise<Teacher> {
    const itemIndex = this.items.findIndex((item) => item.id === id)

    if (itemIndex < 0) {
      throw new AppError(404, 'Teacher not found')
    }

    const updatedTeacher: Teacher = {
      ...this.items[itemIndex],
      name: input.name,
      cpf: input.cpf ?? undefined,
      birthDate: input.birthDate ?? undefined,
      email: input.email,
      phone: input.phone,
      photo: input.photo ?? undefined,
      speciality: input.specialities.join(', '),
      categories: input.categories,
      experience: Number(input.experience),
      status: input.status as Teacher['status'],
      bio: input.bio ?? undefined,
      certifications: input.certifications
        ? input.certifications
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    }

    this.items[itemIndex] = updatedTeacher

    return updatedTeacher
  }

  async remove(id: string): Promise<Teacher> {
    const itemIndex = this.items.findIndex((item) => item.id === id)

    if (itemIndex < 0) {
      throw new AppError(404, 'Teacher not found')
    }

    const [removedTeacher] = this.items.splice(itemIndex, 1)

    return removedTeacher
  }
}

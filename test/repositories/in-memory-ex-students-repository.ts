import { AppError } from '@/shared/errors/app-error'
import type {
  CreateExStudentRepositoryInput,
  ListExStudentsRepositoryParams,
  UpdateExStudentRepositoryInput,
} from '@/domain/ex-students/application/repositories/ex-students-repository'
import { ExStudentsRepository } from '@/domain/ex-students/application/repositories/ex-students-repository'
import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeExStudent } from '../factories/make-ex-student'

export class InMemoryExStudentsRepository implements ExStudentsRepository {
  public items: ExStudent[] = []

  async list(params?: ListExStudentsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const category = params?.category?.trim()

    const filtered = this.items.filter((student) => {
      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(search) ||
        student.exitReason.toLowerCase().includes(search) ||
        student.lastCompetition.toLowerCase().includes(search)
      const matchesCategory = !category || student.category === category

      return matchesSearch && matchesCategory
    })

    return paginateItems([...filtered], params)
  }

  async create(input: CreateExStudentRepositoryInput): Promise<ExStudent> {
    const exStudent = makeExStudent({
      studentId: input.studentId,
      exitDate: input.exitDate,
      exitReason: input.exitReason,
      exitNotes: input.exitNotes ?? '',
      lastCompetition: input.lastCompetition ?? '',
    })

    this.items.push(exStudent)
    return exStudent
  }

  async update(id: string, input: UpdateExStudentRepositoryInput): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found')

    const updatedExStudent: ExStudent = {
      ...this.items[itemIndex],
      exitDate: input.exitDate,
      exitReason: input.exitReason,
      exitNotes: input.exitNotes ?? '',
      achievements: input.achievements,
      lastCompetition: input.lastCompetition,
    }

    this.items[itemIndex] = updatedExStudent
    return updatedExStudent
  }

  async remove(id: string): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found')

    const [removedExStudent] = this.items.splice(itemIndex, 1)
    return removedExStudent
  }

  async reactivate(id: string): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found')

    const [reactivatedExStudent] = this.items.splice(itemIndex, 1)
    return reactivatedExStudent
  }
}

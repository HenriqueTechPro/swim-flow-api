import { AppError } from '@/shared/errors/app-error'
import type {
  CreateParentRepositoryInput,
  ListParentsRepositoryParams,
  UpdateParentRepositoryInput,
} from '@/domain/parents/application/repositories/parents-repository'
import { ParentsRepository } from '@/domain/parents/application/repositories/parents-repository'
import type { Parent } from '@/domain/parents/enterprise/entities/parent'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeParent } from '../factories/make-parent'

export class InMemoryParentsRepository implements ParentsRepository {
  public items: Parent[] = []

  async list(params?: ListParentsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const status = params?.status?.trim()

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.children.some((child) => child.toLowerCase().includes(search)) ||
        item.email.toLowerCase().includes(search) ||
        item.profession.toLowerCase().includes(search)
      const matchesStatus = !status || item.status === status

      return matchesSearch && matchesStatus
    })

    return paginateItems(filteredItems, params)
  }

  async create(input: CreateParentRepositoryInput): Promise<Parent> {
    const parent = makeParent({
      name: input.name,
      cpf: input.cpf ?? undefined,
      birthDate: input.birthDate ?? undefined,
      photo: input.photo ?? undefined,
      childrenIds: input.childrenIds,
      email: input.email,
      phone: input.phone,
      profession: input.profession,
      address: input.address,
      emergencyContact: input.emergencyContact,
      emergencyPhone: input.emergencyPhone,
      status: input.status,
    })
    this.items.push(parent)
    return parent
  }

  async update(id: string, input: UpdateParentRepositoryInput): Promise<Parent> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Parent not found')

    const updatedParent: Parent = {
      ...this.items[itemIndex],
      name: input.name,
      cpf: input.cpf ?? undefined,
      birthDate: input.birthDate ?? undefined,
      photo: input.photo ?? undefined,
      childrenIds: input.childrenIds,
      email: input.email,
      phone: input.phone,
      profession: input.profession,
      address: input.address,
      emergencyContact: input.emergencyContact,
      emergencyPhone: input.emergencyPhone,
      status: input.status,
    }

    this.items[itemIndex] = updatedParent
    return updatedParent
  }

  async remove(id: string): Promise<Parent> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Parent not found')

    const [removedParent] = this.items.splice(itemIndex, 1)
    return removedParent
  }
}

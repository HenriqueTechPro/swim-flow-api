import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateParentUseCase } from './update-parent'
import { InMemoryParentsRepository } from '../../../../../test/repositories/in-memory-parents-repository'
import { makeParent } from '../../../../../test/factories/make-parent'

describe('UpdateParentUseCase', () => {
  let parentsRepository: InMemoryParentsRepository
  let sut: UpdateParentUseCase

  beforeEach(() => {
    parentsRepository = new InMemoryParentsRepository()
    sut = new UpdateParentUseCase(parentsRepository)
  })

  it('updates an existing parent', async () => {
    const existingParent = makeParent()
    parentsRepository.items.push(existingParent)

    const { parent } = await sut.execute(existingParent.id, {
      name: 'Responsavel Atualizado',
      cpf: '987.654.321-00',
      birthDate: '1985-08-20',
      photo: null,
      childrenIds: ['student-1'],
      email: 'responsavel.updated@example.com',
      phone: '(71) 98888-3333',
      profession: 'Coordenador',
      address: 'Rua das Piscinas, 456',
      emergencyContact: 'Novo Contato',
      emergencyPhone: '(71) 97777-2222',
      status: 'Ativo',
    })

    expect(parent.name).toBe('Responsavel Atualizado')
    expect(parent.email).toBe('responsavel.updated@example.com')
  })

  it('throws when parent does not exist', async () => {
    await expect(() =>
      sut.execute('missing-parent', {
        name: 'Responsavel Atualizado',
        cpf: '987.654.321-00',
        birthDate: '1985-08-20',
        photo: null,
        childrenIds: ['student-1'],
        email: 'responsavel.updated@example.com',
        phone: '(71) 98888-3333',
        profession: 'Coordenador',
        address: 'Rua das Piscinas, 456',
        emergencyContact: 'Novo Contato',
        emergencyPhone: '(71) 97777-2222',
        status: 'Ativo',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

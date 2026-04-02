import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateParentUseCase } from './create-parent'
import { InMemoryParentsRepository } from '../../../../../test/repositories/in-memory-parents-repository'

describe('CreateParentUseCase', () => {
  let parentsRepository: InMemoryParentsRepository
  let sut: CreateParentUseCase

  beforeEach(() => {
    parentsRepository = new InMemoryParentsRepository()
    sut = new CreateParentUseCase(parentsRepository)
  })

  it('creates a parent', async () => {
    const { parent } = await sut.execute({
      name: 'Responsavel API',
      cpf: '987.654.321-00',
      birthDate: '1985-08-20',
      photo: null,
      childrenIds: ['student-1'],
      email: 'responsavel.api@example.com',
      phone: '(71) 98888-2222',
      profession: 'Analista',
      address: 'Rua das Piscinas, 123',
      emergencyContact: 'Contato Emergencial',
      emergencyPhone: '(71) 97777-1111',
      status: 'Ativo',
    })

    expect(parent.id).toEqual(expect.any(String))
    expect(parentsRepository.items).toHaveLength(1)
  })
})

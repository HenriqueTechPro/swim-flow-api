import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListParentsUseCase } from './list-parents'
import { InMemoryParentsRepository } from '../../../../../test/repositories/in-memory-parents-repository'
import { makeParent } from '../../../../../test/factories/make-parent'

describe('ListParentsUseCase', () => {
  let parentsRepository: InMemoryParentsRepository
  let sut: ListParentsUseCase

  beforeEach(() => {
    parentsRepository = new InMemoryParentsRepository()
    sut = new ListParentsUseCase(parentsRepository)
  })

  it('lists parents', async () => {
    parentsRepository.items.push(makeParent({ name: 'Responsavel 1' }))
    parentsRepository.items.push(makeParent({ name: 'Responsavel 2' }))

    const { parents } = await sut.execute()

    expect(parents).toHaveLength(2)
    expect(parents.map((parent) => parent.name)).toEqual(['Responsavel 1', 'Responsavel 2'])
  })
})

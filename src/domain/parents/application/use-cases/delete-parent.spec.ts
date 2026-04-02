import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteParentUseCase } from './delete-parent'
import { InMemoryParentsRepository } from '../../../../../test/repositories/in-memory-parents-repository'
import { makeParent } from '../../../../../test/factories/make-parent'

describe('DeleteParentUseCase', () => {
  let parentsRepository: InMemoryParentsRepository
  let sut: DeleteParentUseCase

  beforeEach(() => {
    parentsRepository = new InMemoryParentsRepository()
    sut = new DeleteParentUseCase(parentsRepository)
  })

  it('deletes an existing parent', async () => {
    const existingParent = makeParent()
    parentsRepository.items.push(existingParent)

    const { parent } = await sut.execute(existingParent.id)

    expect(parent.id).toBe(existingParent.id)
    expect(parentsRepository.items).toHaveLength(0)
  })

  it('throws when parent does not exist', async () => {
    await expect(() => sut.execute('missing-parent')).rejects.toBeInstanceOf(AppError)
  })
})

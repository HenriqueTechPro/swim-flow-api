import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeletePoolUseCase } from './delete-pool'
import { InMemoryPoolsRepository } from '../../../../../test/repositories/in-memory-pools-repository'
import { makePool } from '../../../../../test/factories/make-pool'

describe('DeletePoolUseCase', () => {
  let poolsRepository: InMemoryPoolsRepository
  let sut: DeletePoolUseCase

  beforeEach(() => {
    poolsRepository = new InMemoryPoolsRepository()
    sut = new DeletePoolUseCase(poolsRepository)
  })

  it('deletes an existing pool', async () => {
    const existingPool = makePool()
    poolsRepository.items.push(existingPool)

    const { pool } = await sut.execute(existingPool.id)

    expect(pool.id).toBe(existingPool.id)
    expect(poolsRepository.items).toHaveLength(0)
  })

  it('throws when pool does not exist', async () => {
    await expect(() => sut.execute('missing-pool')).rejects.toBeInstanceOf(AppError)
  })
})

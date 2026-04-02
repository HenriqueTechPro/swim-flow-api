import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreatePoolUseCase } from './create-pool'
import { InMemoryPoolsRepository } from '../../../../../test/repositories/in-memory-pools-repository'

describe('CreatePoolUseCase', () => {
  let poolsRepository: InMemoryPoolsRepository
  let sut: CreatePoolUseCase

  beforeEach(() => {
    poolsRepository = new InMemoryPoolsRepository()
    sut = new CreatePoolUseCase(poolsRepository)
  })

  it('creates a pool', async () => {
    const { pool } = await sut.execute({
      name: 'Piscina API',
      lengthMeters: 25,
      address: 'Rua das Piscinas, 100',
      status: 'Ativa',
      maxCapacity: 40,
    })

    expect(pool.id).toEqual(expect.any(String))
    expect(poolsRepository.items).toHaveLength(1)
  })
})

import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListPoolsUseCase } from './list-pools'
import { InMemoryPoolsRepository } from '../../../../../test/repositories/in-memory-pools-repository'
import { makePool } from '../../../../../test/factories/make-pool'

describe('ListPoolsUseCase', () => {
  let poolsRepository: InMemoryPoolsRepository
  let sut: ListPoolsUseCase

  beforeEach(() => {
    poolsRepository = new InMemoryPoolsRepository()
    sut = new ListPoolsUseCase(poolsRepository)
  })

  it('lists pools', async () => {
    poolsRepository.items.push(makePool({ name: 'Piscina 1' }))
    poolsRepository.items.push(makePool({ name: 'Piscina 2' }))

    const { pools } = await sut.execute()

    expect(pools).toHaveLength(2)
    expect(pools.map((pool) => pool.name)).toEqual(['Piscina 1', 'Piscina 2'])
  })
})

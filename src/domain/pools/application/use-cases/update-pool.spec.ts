import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdatePoolUseCase } from './update-pool'
import { InMemoryPoolsRepository } from '../../../../../test/repositories/in-memory-pools-repository'
import { makePool } from '../../../../../test/factories/make-pool'

describe('UpdatePoolUseCase', () => {
  let poolsRepository: InMemoryPoolsRepository
  let sut: UpdatePoolUseCase

  beforeEach(() => {
    poolsRepository = new InMemoryPoolsRepository()
    sut = new UpdatePoolUseCase(poolsRepository)
  })

  it('updates an existing pool', async () => {
    const existingPool = makePool()
    poolsRepository.items.push(existingPool)

    const { pool } = await sut.execute(existingPool.id, {
      name: 'Piscina Atualizada',
      lengthMeters: 25,
      address: 'Rua das Piscinas, 200',
      status: 'Ativa',
      maxCapacity: 45,
    })

    expect(pool.name).toBe('Piscina Atualizada')
    expect(pool.maxCapacity).toBe(45)
  })

  it('throws when pool does not exist', async () => {
    await expect(() =>
      sut.execute('missing-pool', {
        name: 'Piscina Atualizada',
        lengthMeters: 25,
        address: 'Rua das Piscinas, 200',
        status: 'Ativa',
        maxCapacity: 45,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

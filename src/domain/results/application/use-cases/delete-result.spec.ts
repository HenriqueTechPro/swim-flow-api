import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteResultUseCase } from './delete-result'
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository'
import { makeResult } from '../../../../../test/factories/make-result'

describe('DeleteResultUseCase', () => {
  let resultsRepository: InMemoryResultsRepository
  let sut: DeleteResultUseCase

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository()
    sut = new DeleteResultUseCase(resultsRepository)
  })

  it('deletes an existing result', async () => {
    const existingResult = makeResult()
    resultsRepository.items.push(existingResult)

    const { result } = await sut.execute(existingResult.id)

    expect(result.id).toBe(existingResult.id)
    expect(resultsRepository.items).toHaveLength(0)
  })

  it('throws when deleting a non-existing result', async () => {
    await expect(() => sut.execute('missing-result')).rejects.toBeInstanceOf(AppError)
  })
})

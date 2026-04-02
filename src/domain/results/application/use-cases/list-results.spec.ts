import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListResultsUseCase } from './list-results'
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository'
import { makeResult } from '../../../../../test/factories/make-result'

describe('ListResultsUseCase', () => {
  let resultsRepository: InMemoryResultsRepository
  let sut: ListResultsUseCase

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository()
    sut = new ListResultsUseCase(resultsRepository)
  })

  it('lists results', async () => {
    resultsRepository.items.push(makeResult(), makeResult())

    const { results } = await sut.execute()

    expect(results).toHaveLength(2)
  })
})

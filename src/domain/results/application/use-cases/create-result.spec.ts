import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateResultUseCase } from './create-result'
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository'

describe('CreateResultUseCase', () => {
  let resultsRepository: InMemoryResultsRepository
  let sut: CreateResultUseCase

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository()
    sut = new CreateResultUseCase(resultsRepository)
  })

  it('creates a result', async () => {
    const { result } = await sut.execute({
      studentId: 'student-1',
      style: 'Livre',
      distance: '50m',
      time: '00:34.21',
      date: '2026-03-31',
      competition: 'Festival Interno',
      position: 1,
      category: 'Petiz 2',
      notes: 'Bom resultado',
    })

    expect(result.id).toEqual(expect.any(String))
    expect(resultsRepository.items).toHaveLength(1)
  })
})

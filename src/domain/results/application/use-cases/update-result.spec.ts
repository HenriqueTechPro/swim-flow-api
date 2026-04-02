import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateResultUseCase } from './update-result'
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository'
import { makeResult } from '../../../../../test/factories/make-result'

describe('UpdateResultUseCase', () => {
  let resultsRepository: InMemoryResultsRepository
  let sut: UpdateResultUseCase

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository()
    sut = new UpdateResultUseCase(resultsRepository)
  })

  it('updates an existing result', async () => {
    const existingResult = makeResult()
    resultsRepository.items.push(existingResult)

    const { result } = await sut.execute(existingResult.id, {
      studentId: existingResult.studentId,
      style: 'Livre',
      distance: '50m',
      time: '00:33.80',
      timeInSeconds: 33.8,
      date: '2026-03-31',
      competition: 'Festival Interno',
      position: 1,
      personalBest: true,
      improvement: -0.41,
      category: 'Petiz 2',
      notes: 'Melhorou o tempo',
    })

    expect(result.timeInSeconds).toBe(33.8)
    expect(result.personalBest).toBe(true)
  })

  it('throws when result does not exist', async () => {
    await expect(() =>
      sut.execute('missing-result', {
        studentId: 'student-1',
        style: 'Livre',
        distance: '50m',
        time: '00:33.80',
        timeInSeconds: 33.8,
        date: '2026-03-31',
        competition: 'Festival Interno',
        position: 1,
        personalBest: true,
        improvement: -0.41,
        category: 'Petiz 2',
        notes: 'Melhorou o tempo',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

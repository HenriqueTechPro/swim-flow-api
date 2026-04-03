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
      discipline: 'Piscina',
      style: 'Livre',
      distance: '100m',
      customDistance: '',
      competitionType: 'Piscina',
      courseType: 'Piscina Longa',
      eventFormat: 'Prova Individual',
      time: '00:58.80',
      timeInSeconds: 58.8,
      date: '2026-03-31',
      competition: 'Festival Interno',
      position: 1,
      personalBest: true,
      improvement: -0.41,
      category: 'Petiz 2',
      notes: 'Melhorou o tempo',
    })

    expect(result.timeInSeconds).toBe(58.8)
    expect(result.personalBest).toBe(true)
    expect(result.courseType).toBe('Piscina Longa')
  })

  it('updates a pool athlete to open water context cleanly', async () => {
    const existingResult = makeResult({
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      distance: '1500m',
      style: 'Livre',
    })
    resultsRepository.items.push(existingResult)

    const { result } = await sut.execute(existingResult.id, {
      studentId: existingResult.studentId,
      discipline: 'Aguas Abertas',
      style: 'Livre',
      distance: '10km',
      customDistance: '',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Prova Individual',
      time: '125:10.10',
      timeInSeconds: 7510.1,
      date: '2026-04-02',
      competition: 'Maratona Aquatica',
      position: 2,
      personalBest: false,
      improvement: 0,
      category: 'Master C',
      notes: 'Virou foco de travessia',
    })

    expect(result.discipline).toBe('Aguas Abertas')
    expect(result.distance).toBe('10km')
    expect(result.courseType).toBe('Mar')
  })

  it('rejects open-water updates with pool course type', async () => {
    const existingResult = makeResult()
    resultsRepository.items.push(existingResult)

    await expect(() =>
      sut.execute(existingResult.id, {
        studentId: existingResult.studentId,
        discipline: 'Aguas Abertas',
        style: 'Livre',
        distance: '5km',
        customDistance: '',
        competitionType: 'Travessia',
        courseType: 'Piscina Longa',
        eventFormat: 'Prova Individual',
        time: '70:00.00',
        timeInSeconds: 4200,
        date: '2026-04-02',
        competition: 'Travessia Regional',
        position: 2,
        personalBest: false,
        improvement: 0,
        category: 'Master C',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('throws when result does not exist', async () => {
    await expect(() =>
      sut.execute('missing-result', {
        studentId: 'student-1',
        discipline: 'Piscina',
        style: 'Livre',
        distance: '50m',
        customDistance: '',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        eventFormat: 'Prova Individual',
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

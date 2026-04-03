import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { CreateResultUseCase } from './create-result'
import { InMemoryResultsRepository } from '../../../../../test/repositories/in-memory-results-repository'

describe('CreateResultUseCase', () => {
  let resultsRepository: InMemoryResultsRepository
  let sut: CreateResultUseCase

  beforeEach(() => {
    resultsRepository = new InMemoryResultsRepository()
    sut = new CreateResultUseCase(resultsRepository)
  })

  it('creates a pool result with valid stroke and distance', async () => {
    const { result } = await sut.execute({
      studentId: 'student-1',
      discipline: 'Piscina',
      style: 'Livre',
      distance: '50m',
      customDistance: '',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      eventFormat: 'Prova Individual',
      time: '00:34.21',
      date: '2026-03-31',
      competition: 'Festival Interno',
      position: 1,
      category: 'Petiz 2',
      notes: 'Bom resultado',
    })

    expect(result.discipline).toBe('Piscina')
    expect(result.distance).toBe('50m')
    expect(result.courseType).toBe('Piscina Curta')
    expect(resultsRepository.items).toHaveLength(1)
  })

  it('creates an open-water result with official distance', async () => {
    const { result } = await sut.execute({
      studentId: 'student-2',
      discipline: 'Aguas Abertas',
      style: 'Livre',
      distance: '5km',
      customDistance: '',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Prova Individual',
      time: '62:14.55',
      date: '2026-04-01',
      competition: 'Travessia de Verao',
      position: 3,
      category: 'Master B',
      notes: 'Mar calmo',
    })

    expect(result.discipline).toBe('Aguas Abertas')
    expect(result.distance).toBe('5km')
    expect(result.eventFormat).toBe('Prova Individual')
  })

  it('creates an ultramarathon result with custom distance', async () => {
    const { result } = await sut.execute({
      studentId: 'student-3',
      discipline: 'Aguas Abertas',
      style: 'Livre',
      distance: 'Ultramaratona',
      customDistance: '12km',
      competitionType: 'Travessia',
      courseType: 'Rio',
      eventFormat: 'Ultramaratona',
      time: '155:10.00',
      date: '2026-04-08',
      competition: 'Desafio do Rio',
      position: 1,
      category: 'Master D',
    })

    expect(result.customDistance).toBe('12km')
    expect(result.eventFormat).toBe('Ultramaratona')
  })

  it('rejects invalid pool distance for medley', async () => {
    await expect(() =>
      sut.execute({
        studentId: 'student-4',
        discipline: 'Piscina',
        style: 'Medley',
        distance: '1500m',
        customDistance: '',
        competitionType: 'Piscina',
        courseType: 'Piscina Longa',
        eventFormat: 'Prova Individual',
        time: '17:14.55',
        date: '2026-04-01',
        competition: 'Torneio Estadual',
        position: 1,
        category: 'Senior',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects ultramarathon without custom distance', async () => {
    await expect(() =>
      sut.execute({
        studentId: 'student-5',
        discipline: 'Aguas Abertas',
        style: 'Livre',
        distance: 'Ultramaratona',
        customDistance: '',
        competitionType: 'Travessia',
        courseType: 'Mar',
        eventFormat: 'Ultramaratona',
        time: '155:10.00',
        date: '2026-04-08',
        competition: 'Desafio do Mar',
        position: 1,
        category: 'Master D',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

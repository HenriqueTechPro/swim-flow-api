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

  it('filters results by discipline and event context', async () => {
    resultsRepository.items.push(
      makeResult({
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        eventFormat: 'Prova Individual',
        distance: '200m',
      }),
      makeResult({
        discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        eventFormat: 'Prova Individual',
        distance: '5km',
      }),
      makeResult({
        discipline: 'Aguas Abertas',
        competitionType: 'Travessia',
        courseType: 'Rio',
        eventFormat: 'Ultramaratona',
        distance: 'Ultramaratona',
        customDistance: '12km',
      }),
    )

    const { results } = await sut.execute({
      discipline: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Prova Individual',
    })

    expect(results).toHaveLength(1)
    expect(results[0].distance).toBe('5km')
    expect(results[0].discipline).toBe('Aguas Abertas')
    expect(results[0].courseType).toBe('Mar')
  })

  it('filters results by result status', async () => {
    resultsRepository.items.push(
      makeResult({
        discipline: 'Piscina',
        resultStatus: 'Classificado',
      }),
      makeResult({
        discipline: 'Piscina',
        resultStatus: 'Desclassificado',
        position: 0,
      }),
    )

    const { results } = await sut.execute({
      resultStatus: 'Desclassificado',
    })

    expect(results).toHaveLength(1)
    expect(results[0].resultStatus).toBe('Desclassificado')
  })
})

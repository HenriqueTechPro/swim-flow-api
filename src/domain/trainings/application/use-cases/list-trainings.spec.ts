import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListTrainingsUseCase } from './list-trainings'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'
import { makeTraining } from '../../../../../test/factories/make-training'

describe('ListTrainingsUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: ListTrainingsUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new ListTrainingsUseCase(trainingsRepository)
  })

  it('lists trainings', async () => {
    trainingsRepository.items.push(makeTraining({ title: 'Treino 1' }))
    trainingsRepository.items.push(makeTraining({ title: 'Treino 2' }))

    const { trainings } = await sut.execute()

    expect(trainings).toHaveLength(2)
    expect(trainings.map((training) => training.title)).toEqual(['Treino 1', 'Treino 2'])
  })
})

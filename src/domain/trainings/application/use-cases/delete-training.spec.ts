import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteTrainingUseCase } from './delete-training'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'
import { makeTraining } from '../../../../../test/factories/make-training'

describe('DeleteTrainingUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: DeleteTrainingUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new DeleteTrainingUseCase(trainingsRepository)
  })

  it('deletes an existing training', async () => {
    const existingTraining = makeTraining()
    trainingsRepository.items.push(existingTraining)

    const { training } = await sut.execute(existingTraining.id)

    expect(training.id).toBe(existingTraining.id)
    expect(trainingsRepository.items).toHaveLength(0)
  })

  it('throws when training does not exist', async () => {
    await expect(() => sut.execute('missing-training')).rejects.toBeInstanceOf(AppError)
  })
})

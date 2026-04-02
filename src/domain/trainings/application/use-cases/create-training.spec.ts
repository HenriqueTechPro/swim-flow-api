import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateTrainingUseCase } from './create-training'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'

describe('CreateTrainingUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: CreateTrainingUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new CreateTrainingUseCase(trainingsRepository)
  })

  it('creates a training', async () => {
    const { training } = await sut.execute({
      title: 'Treino API',
      description: 'Treino de teste',
      type: 'Misto',
      dayOfWeek: 'Segunda',
      startTime: '18:00',
      endTime: '19:00',
      instructorId: 'teacher-1',
      level: 'Todos',
      maxParticipants: 20,
      currentParticipants: 0,
      status: 'Ativo',
      poolId: 'pool-1',
    })

    expect(training.id).toEqual(expect.any(String))
    expect(trainingsRepository.items).toHaveLength(1)
  })
})

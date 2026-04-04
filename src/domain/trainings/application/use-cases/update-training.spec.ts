import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateTrainingUseCase } from './update-training'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'
import { makeTraining } from '../../../../../test/factories/make-training'

describe('UpdateTrainingUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: UpdateTrainingUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new UpdateTrainingUseCase(trainingsRepository)
  })

  it('updates an existing training', async () => {
    const existingTraining = makeTraining()
    trainingsRepository.items.push(existingTraining)

    const { training } = await sut.execute(existingTraining.id, {
      title: 'Treino Atualizado',
      description: 'Treino atualizado',
      type: 'Misto',
      dayOfWeek: 'Quarta',
      startTime: '18:30',
      endTime: '19:30',
      instructorId: 'teacher-1',
      level: 'Todos',
      maxParticipants: 24,
      currentParticipants: 2,
      status: 'Ativo',
      venueType: 'Piscina',
      locationName: '',
      poolId: 'pool-1',
    })

    expect(training.title).toBe('Treino Atualizado')
    expect(training.currentParticipants).toBe(2)
  })

  it('throws when training does not exist', async () => {
    await expect(() =>
      sut.execute('missing-training', {
        title: 'Treino Atualizado',
        description: 'Treino atualizado',
        type: 'Misto',
        dayOfWeek: 'Quarta',
        startTime: '18:30',
        endTime: '19:30',
        instructorId: 'teacher-1',
        level: 'Todos',
        maxParticipants: 24,
        currentParticipants: 2,
        status: 'Ativo',
        venueType: 'Piscina',
        locationName: '',
        poolId: 'pool-1',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

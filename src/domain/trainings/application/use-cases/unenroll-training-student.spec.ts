import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UnenrollTrainingStudentUseCase } from './unenroll-training-student'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'
import { makeTraining } from '../../../../../test/factories/make-training'

describe('UnenrollTrainingStudentUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: UnenrollTrainingStudentUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new UnenrollTrainingStudentUseCase(trainingsRepository)
  })

  it('unenrolls a student from training', async () => {
    const training = makeTraining({ maxParticipants: 2 })
    trainingsRepository.items.push(training)
    await trainingsRepository.enroll(training.id, 'student-1')

    const result = await sut.execute(training.id, 'student-1')

    expect(result.training.currentParticipants).toBe(0)
    expect(trainingsRepository.enrollments).toEqual([])
  })

  it('throws when enrollment does not exist', async () => {
    const training = makeTraining({ maxParticipants: 2 })
    trainingsRepository.items.push(training)

    await expect(() => sut.execute(training.id, 'student-1')).rejects.toBeInstanceOf(AppError)
  })
})

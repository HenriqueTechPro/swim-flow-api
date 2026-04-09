import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { EnrollTrainingStudentUseCase } from './enroll-training-student'
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository'
import { makeTraining } from '../../../../../test/factories/make-training'

describe('EnrollTrainingStudentUseCase', () => {
  let trainingsRepository: InMemoryTrainingsRepository
  let sut: EnrollTrainingStudentUseCase

  beforeEach(() => {
    trainingsRepository = new InMemoryTrainingsRepository()
    sut = new EnrollTrainingStudentUseCase(trainingsRepository)
  })

  it('enrolls a student in training', async () => {
    const training = makeTraining({ maxParticipants: 2 })
    trainingsRepository.items.push(training)

    const result = await sut.execute(training.id, 'student-1')

    expect(result.training.currentParticipants).toBe(1)
    expect(trainingsRepository.enrollments).toEqual([{ trainingId: training.id, studentId: 'student-1' }])
  })

  it('does not allow duplicate enrollment', async () => {
    const training = makeTraining({ maxParticipants: 2 })
    trainingsRepository.items.push(training)
    await sut.execute(training.id, 'student-1')

    await expect(() => sut.execute(training.id, 'student-1')).rejects.toBeInstanceOf(AppError)
  })
})

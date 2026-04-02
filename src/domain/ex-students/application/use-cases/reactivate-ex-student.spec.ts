import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { ReactivateExStudentUseCase } from './reactivate-ex-student'
import { InMemoryExStudentsRepository } from '../../../../../test/repositories/in-memory-ex-students-repository'
import { makeExStudent } from '../../../../../test/factories/make-ex-student'

describe('ReactivateExStudentUseCase', () => {
  let exStudentsRepository: InMemoryExStudentsRepository
  let sut: ReactivateExStudentUseCase

  beforeEach(() => {
    exStudentsRepository = new InMemoryExStudentsRepository()
    sut = new ReactivateExStudentUseCase(exStudentsRepository)
  })

  it('reactivates an ex-student by removing it from archive', async () => {
    const existingExStudent = makeExStudent()
    exStudentsRepository.items.push(existingExStudent)

    const { exStudent } = await sut.execute(existingExStudent.id)

    expect(exStudent.id).toBe(existingExStudent.id)
    expect(exStudentsRepository.items).toHaveLength(0)
  })

  it('throws when ex-student does not exist', async () => {
    await expect(() => sut.execute('missing-ex-student')).rejects.toBeInstanceOf(AppError)
  })
})

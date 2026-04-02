import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteStudentUseCase } from './delete-student'
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository'
import { makeStudent } from '../../../../../test/factories/make-student'

describe('DeleteStudentUseCase', () => {
  let studentsRepository: InMemoryStudentsRepository
  let sut: DeleteStudentUseCase

  beforeEach(() => {
    studentsRepository = new InMemoryStudentsRepository()
    sut = new DeleteStudentUseCase(studentsRepository)
  })

  it('deletes an existing student', async () => {
    const existingStudent = makeStudent()
    studentsRepository.items.push(existingStudent)

    const { student } = await sut.execute(existingStudent.id)

    expect(student.id).toBe(existingStudent.id)
    expect(studentsRepository.items).toHaveLength(0)
  })

  it('throws when deleting a non-existing student', async () => {
    await expect(() => sut.execute('missing-student')).rejects.toBeInstanceOf(AppError)
  })
})

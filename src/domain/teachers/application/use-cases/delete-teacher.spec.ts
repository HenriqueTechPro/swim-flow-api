import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteTeacherUseCase } from './delete-teacher'
import { InMemoryTeachersRepository } from '../../../../../test/repositories/in-memory-teachers-repository'
import { makeTeacher } from '../../../../../test/factories/make-teacher'

describe('DeleteTeacherUseCase', () => {
  let teachersRepository: InMemoryTeachersRepository
  let sut: DeleteTeacherUseCase

  beforeEach(() => {
    teachersRepository = new InMemoryTeachersRepository()
    sut = new DeleteTeacherUseCase(teachersRepository)
  })

  it('deletes an existing teacher', async () => {
    const existingTeacher = makeTeacher()
    teachersRepository.items.push(existingTeacher)

    const { teacher } = await sut.execute(existingTeacher.id)

    expect(teacher.id).toBe(existingTeacher.id)
    expect(teachersRepository.items).toHaveLength(0)
  })

  it('throws when deleting a non-existing teacher', async () => {
    await expect(() => sut.execute('missing-teacher')).rejects.toBeInstanceOf(AppError)
  })
})

import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { AddClassTeacherUseCase } from './add-class-teacher'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'
import { makeClassEntity } from '../../../../../test/factories/make-class'

describe('AddClassTeacherUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: AddClassTeacherUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new AddClassTeacherUseCase(classesRepository)
  })

  it('adds a teacher to a class', async () => {
    const classItem = makeClassEntity()
    classesRepository.items.push(classItem)

    const result = await sut.execute(classItem.id, {
      teacherId: 'teacher-1',
      role: 'head_coach',
    })

    expect(result.classItem.classTeachers).toHaveLength(1)
    expect(result.classItem.classTeachers[0].teacherId).toBe('teacher-1')
  })

  it('throws when teacher is already assigned', async () => {
    const classItem = makeClassEntity({
      classTeachers: [
        {
          id: 'assignment-1',
          teacherId: 'teacher-1',
          teacherName: 'Professor Teste',
          role: 'head_coach',
        },
      ],
      teachers: ['Professor Teste'],
    })

    classesRepository.items.push(classItem)

    await expect(() =>
      sut.execute(classItem.id, {
        teacherId: 'teacher-1',
        role: 'assistant_coach',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

import { beforeEach, describe, expect, it } from '@jest/globals'
import { UpdateClassTeacherRoleUseCase } from './update-class-teacher-role'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'
import { makeClassEntity } from '../../../../../test/factories/make-class'

describe('UpdateClassTeacherRoleUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: UpdateClassTeacherRoleUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new UpdateClassTeacherRoleUseCase(classesRepository)
  })

  it('updates a teacher role in class', async () => {
    const classItem = makeClassEntity({
      classTeachers: [
        {
          id: 'assignment-1',
          teacherId: 'teacher-1',
          teacherName: 'Professor Teste',
          role: 'assistant_coach',
        },
      ],
      teachers: ['Professor Teste'],
    })

    classesRepository.items.push(classItem)

    const result = await sut.execute(classItem.id, 'teacher-1', {
      role: 'head_coach',
    })

    expect(result.classItem.classTeachers[0].role).toBe('head_coach')
  })
})

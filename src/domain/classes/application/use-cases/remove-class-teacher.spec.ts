import { beforeEach, describe, expect, it } from '@jest/globals'
import { RemoveClassTeacherUseCase } from './remove-class-teacher'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'
import { makeClassEntity } from '../../../../../test/factories/make-class'

describe('RemoveClassTeacherUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: RemoveClassTeacherUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new RemoveClassTeacherUseCase(classesRepository)
  })

  it('removes a teacher from class', async () => {
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

    const result = await sut.execute(classItem.id, 'teacher-1')

    expect(result.classItem.classTeachers).toHaveLength(0)
    expect(result.classItem.teachers).toHaveLength(0)
  })
})

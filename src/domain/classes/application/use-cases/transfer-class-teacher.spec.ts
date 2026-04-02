import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { TransferClassTeacherUseCase } from './transfer-class-teacher'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'
import { makeClassEntity } from '../../../../../test/factories/make-class'

describe('TransferClassTeacherUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: TransferClassTeacherUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new TransferClassTeacherUseCase(classesRepository)
  })

  it('transfers a teacher between classes', async () => {
    const sourceClass = makeClassEntity({
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

    const targetClass = makeClassEntity()
    classesRepository.items.push(sourceClass, targetClass)

    const { classItem } = await sut.execute({
      teacherId: 'teacher-1',
      fromClassId: sourceClass.id,
      toClassId: targetClass.id,
    })

    expect(sourceClass.classTeachers).toHaveLength(0)
    expect(classItem.classTeachers).toHaveLength(1)
    expect(classItem.classTeachers[0].teacherId).toBe('teacher-1')
  })

  it('throws when teacher is not in source class', async () => {
    const sourceClass = makeClassEntity()
    const targetClass = makeClassEntity()
    classesRepository.items.push(sourceClass, targetClass)

    await expect(() =>
      sut.execute({
        teacherId: 'missing-teacher',
        fromClassId: sourceClass.id,
        toClassId: targetClass.id,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

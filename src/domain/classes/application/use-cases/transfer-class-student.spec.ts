import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { TransferClassStudentUseCase } from './transfer-class-student'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'
import { makeClassEntity } from '../../../../../test/factories/make-class'

describe('TransferClassStudentUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: TransferClassStudentUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new TransferClassStudentUseCase(classesRepository)
  })

  it('transfers a student between classes', async () => {
    const sourceClass = makeClassEntity({
      students: [
        {
          id: 'student-1',
          name: 'Aluno Teste',
          age: 12,
          category: 'Petiz 2',
          level: 'Iniciante',
          status: 'Ativo',
        },
      ],
      enrolledStudents: 1,
    })

    const targetClass = makeClassEntity({
      students: [],
      enrolledStudents: 0,
    })

    classesRepository.items.push(sourceClass, targetClass)

    const { classItem } = await sut.execute({
      studentId: 'student-1',
      fromClassId: sourceClass.id,
      toClassId: targetClass.id,
    })

    expect(classItem.students).toHaveLength(1)
    expect(classItem.students[0].id).toBe('student-1')
    expect(sourceClass.students).toHaveLength(0)
  })

  it('throws when student is not in source class', async () => {
    const sourceClass = makeClassEntity({ students: [], enrolledStudents: 0 })
    const targetClass = makeClassEntity({ students: [], enrolledStudents: 0 })

    classesRepository.items.push(sourceClass, targetClass)

    await expect(() =>
      sut.execute({
        studentId: 'missing-student',
        fromClassId: sourceClass.id,
        toClassId: targetClass.id,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateStudentUseCase } from './update-student'
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository'
import { makeStudent } from '../../../../../test/factories/make-student'

describe('UpdateStudentUseCase', () => {
  let studentsRepository: InMemoryStudentsRepository
  let sut: UpdateStudentUseCase

  beforeEach(() => {
    studentsRepository = new InMemoryStudentsRepository()
    sut = new UpdateStudentUseCase(studentsRepository)
  })

  it('updates an existing student', async () => {
    const existingStudent = makeStudent()
    studentsRepository.items.push(existingStudent)

    const { student } = await sut.execute(existingStudent.id, {
      name: 'Aluno Atualizado',
      gender: 'Masculino',
      birthDate: '2013-03-01',
      level: 'Intermediário',
      parentId: null,
      classId: 'class-1',
      phone: '(71) 99999-2222',
      status: 'Ativo',
      photo: null,
    })

    expect(student.name).toBe('Aluno Atualizado')
    expect(student.birthYear).toBe(2013)
    expect(student.classId).toBe('class-1')
  })

  it('throws when student does not exist', async () => {
    await expect(() =>
      sut.execute('missing-student', {
        name: 'Aluno Atualizado',
        gender: 'Masculino',
        birthDate: '2013-03-01',
        level: 'Intermediário',
        parentId: null,
        classId: null,
        phone: '(71) 99999-2222',
        status: 'Ativo',
        photo: null,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

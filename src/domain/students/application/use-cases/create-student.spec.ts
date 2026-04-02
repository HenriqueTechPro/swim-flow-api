import { describe, expect, it, beforeEach } from '@jest/globals'
import { CreateStudentUseCase } from './create-student'
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository'

describe('CreateStudentUseCase', () => {
  let studentsRepository: InMemoryStudentsRepository
  let sut: CreateStudentUseCase

  beforeEach(() => {
    studentsRepository = new InMemoryStudentsRepository()
    sut = new CreateStudentUseCase(studentsRepository)
  })

  it('creates a student', async () => {
    const { student } = await sut.execute({
      name: 'Aluno da API',
      gender: 'Masculino',
      birthDate: '2014-05-10',
      level: 'Iniciante',
      parentId: null,
      classId: null,
      phone: '(71) 99999-1111',
      status: 'Ativo',
      photo: null,
    })

    expect(student.id).toEqual(expect.any(String))
    expect(student.name).toBe('Aluno da API')
    expect(student.birthYear).toBe(2014)
    expect(studentsRepository.items).toHaveLength(1)
  })
})

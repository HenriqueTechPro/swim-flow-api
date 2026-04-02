import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateExStudentUseCase } from './create-ex-student'
import { InMemoryExStudentsRepository } from '../../../../../test/repositories/in-memory-ex-students-repository'

describe('CreateExStudentUseCase', () => {
  let exStudentsRepository: InMemoryExStudentsRepository
  let sut: CreateExStudentUseCase

  beforeEach(() => {
    exStudentsRepository = new InMemoryExStudentsRepository()
    sut = new CreateExStudentUseCase(exStudentsRepository)
  })

  it('creates an ex-student record', async () => {
    const { exStudent } = await sut.execute({
      studentId: 'student-1',
      exitDate: '2026-03-31',
      exitReason: 'Mudanca de cidade',
      exitNotes: 'Arquivo criado para testes',
      lastCompetition: 'Festival Interno',
    })

    expect(exStudent.id).toEqual(expect.any(String))
    expect(exStudentsRepository.items).toHaveLength(1)
  })
})

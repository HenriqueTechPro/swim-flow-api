import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateExStudentUseCase } from './update-ex-student'
import { InMemoryExStudentsRepository } from '../../../../../test/repositories/in-memory-ex-students-repository'
import { makeExStudent } from '../../../../../test/factories/make-ex-student'

describe('UpdateExStudentUseCase', () => {
  let exStudentsRepository: InMemoryExStudentsRepository
  let sut: UpdateExStudentUseCase

  beforeEach(() => {
    exStudentsRepository = new InMemoryExStudentsRepository()
    sut = new UpdateExStudentUseCase(exStudentsRepository)
  })

  it('updates an ex-student record', async () => {
    const existingExStudent = makeExStudent()
    exStudentsRepository.items.push(existingExStudent)

    const { exStudent } = await sut.execute(existingExStudent.id, {
      exitDate: '2026-03-31',
      exitReason: 'Mudanca de cidade',
      exitNotes: 'Historico atualizado',
      achievements: 3,
      lastCompetition: 'Torneio Regional',
    })

    expect(exStudent.achievements).toBe(3)
    expect(exStudent.lastCompetition).toBe('Torneio Regional')
  })

  it('throws when ex-student does not exist', async () => {
    await expect(() =>
      sut.execute('missing-ex-student', {
        exitDate: '2026-03-31',
        exitReason: 'Mudanca de cidade',
        exitNotes: 'Historico atualizado',
        achievements: 3,
        lastCompetition: 'Torneio Regional',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

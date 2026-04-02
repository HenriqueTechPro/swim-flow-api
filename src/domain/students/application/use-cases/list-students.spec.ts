import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListStudentsUseCase } from './list-students'
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository'
import { makeStudent } from '../../../../../test/factories/make-student'

describe('ListStudentsUseCase', () => {
  let studentsRepository: InMemoryStudentsRepository
  let sut: ListStudentsUseCase

  beforeEach(() => {
    studentsRepository = new InMemoryStudentsRepository()
    sut = new ListStudentsUseCase(studentsRepository)
  })

  it('lists students from repository', async () => {
    studentsRepository.items.push(makeStudent({ name: 'Aluno 1' }))
    studentsRepository.items.push(makeStudent({ name: 'Aluno 2' }))

    const { students } = await sut.execute()

    expect(students).toHaveLength(2)
    expect(students.map((student) => student.name)).toEqual(['Aluno 1', 'Aluno 2'])
  })

  it('filters students by search and status', async () => {
    studentsRepository.items.push(
      makeStudent({ name: 'Ana Clara', responsible: 'Maria', status: 'Ativo' }),
      makeStudent({ name: 'Bruno Lima', responsible: 'Joao', status: 'Licença' }),
    )

    const { students, meta } = await sut.execute({ search: 'ana', status: 'Ativo', page: 1, perPage: 10 })

    expect(students).toHaveLength(1)
    expect(students[0].name).toBe('Ana Clara')
    expect(meta.total).toBe(1)
  })
})

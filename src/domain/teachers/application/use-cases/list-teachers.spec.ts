import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListTeachersUseCase } from './list-teachers'
import { InMemoryTeachersRepository } from '../../../../../test/repositories/in-memory-teachers-repository'
import { makeTeacher } from '../../../../../test/factories/make-teacher'

describe('ListTeachersUseCase', () => {
  let teachersRepository: InMemoryTeachersRepository
  let sut: ListTeachersUseCase

  beforeEach(() => {
    teachersRepository = new InMemoryTeachersRepository()
    sut = new ListTeachersUseCase(teachersRepository)
  })

  it('lists teachers from repository', async () => {
    teachersRepository.items.push(makeTeacher({ name: 'Professor 1' }))
    teachersRepository.items.push(makeTeacher({ name: 'Professor 2' }))

    const { teachers } = await sut.execute()

    expect(teachers).toHaveLength(2)
    expect(teachers.map((teacher) => teacher.name)).toEqual(['Professor 1', 'Professor 2'])
  })

  it('filters teachers by search and status', async () => {
    teachersRepository.items.push(
      makeTeacher({ name: 'Ana Paula', status: 'Ativo', email: 'ana@example.com' }),
      makeTeacher({ name: 'Bruno Lima', status: 'Licença', email: 'bruno@example.com' }),
    )

    const { teachers, meta } = await sut.execute({ search: 'ana', status: 'Ativo', page: 1, perPage: 10 })

    expect(teachers).toHaveLength(1)
    expect(teachers[0].name).toBe('Ana Paula')
    expect(meta.total).toBe(1)
  })
})

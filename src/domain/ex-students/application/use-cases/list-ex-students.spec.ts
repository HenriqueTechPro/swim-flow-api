import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListExStudentsUseCase } from './list-ex-students'
import { InMemoryExStudentsRepository } from '../../../../../test/repositories/in-memory-ex-students-repository'
import { makeExStudent } from '../../../../../test/factories/make-ex-student'

describe('ListExStudentsUseCase', () => {
  let exStudentsRepository: InMemoryExStudentsRepository
  let sut: ListExStudentsUseCase

  beforeEach(() => {
    exStudentsRepository = new InMemoryExStudentsRepository()
    sut = new ListExStudentsUseCase(exStudentsRepository)
  })

  it('lists ex-students', async () => {
    exStudentsRepository.items.push(makeExStudent({ name: 'Ex Aluno 1' }))
    exStudentsRepository.items.push(makeExStudent({ name: 'Ex Aluno 2' }))

    const { exStudents } = await sut.execute()

    expect(exStudents).toHaveLength(2)
    expect(exStudents.map((item) => item.name)).toEqual(['Ex Aluno 1', 'Ex Aluno 2'])
  })
})

import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateClassUseCase } from './create-class'
import { InMemoryClassesRepository } from '../../../../../test/repositories/in-memory-classes-repository'

describe('CreateClassUseCase', () => {
  let classesRepository: InMemoryClassesRepository
  let sut: CreateClassUseCase

  beforeEach(() => {
    classesRepository = new InMemoryClassesRepository()
    sut = new CreateClassUseCase(classesRepository)
  })

  it('creates a class', async () => {
    const { classItem } = await sut.execute({
      name: 'Turma API',
      categories: ['Pre-Mirim', 'Mirim 1'],
      schedules: [
        {
          dayOfWeek: 'Segunda',
          startTime: '08:00',
          endTime: '09:00',
        },
      ],
      classTeachers: [],
      maxStudents: 12,
      poolId: null,
      status: 'Ativa',
    })

    expect(classItem.id).toEqual(expect.any(String))
    expect(classItem.categories).toEqual(['Pre-Mirim', 'Mirim 1'])
    expect(classesRepository.items).toHaveLength(1)
  })
})

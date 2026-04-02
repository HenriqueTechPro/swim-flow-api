import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateTeacherUseCase } from './create-teacher'
import { InMemoryTeachersRepository } from '../../../../../test/repositories/in-memory-teachers-repository'

describe('CreateTeacherUseCase', () => {
  let teachersRepository: InMemoryTeachersRepository
  let sut: CreateTeacherUseCase

  beforeEach(() => {
    teachersRepository = new InMemoryTeachersRepository()
    sut = new CreateTeacherUseCase(teachersRepository)
  })

  it('creates a teacher', async () => {
    const { teacher } = await sut.execute({
      name: 'Professor API',
      cpf: '123.456.789-00',
      birthDate: '1990-06-15',
      email: 'professor.api@example.com',
      phone: '(71) 99999-1234',
      photo: null,
      specialities: ['Nado costas', 'Aperfeicoamento'],
      categories: ['Pre-Mirim', 'Mirim'],
      experience: '6',
      certifications: 'CBDA Nivel 1, Primeiros Socorros',
      status: 'Ativo',
      bio: 'Professor de teste',
    })

    expect(teacher.id).toEqual(expect.any(String))
    expect(teacher.experience).toBe(6)
    expect(teacher.categories).toEqual(['Pre-Mirim', 'Mirim'])
    expect(teachersRepository.items).toHaveLength(1)
  })
})

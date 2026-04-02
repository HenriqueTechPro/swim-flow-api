import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateTeacherUseCase } from './update-teacher'
import { InMemoryTeachersRepository } from '../../../../../test/repositories/in-memory-teachers-repository'
import { makeTeacher } from '../../../../../test/factories/make-teacher'

describe('UpdateTeacherUseCase', () => {
  let teachersRepository: InMemoryTeachersRepository
  let sut: UpdateTeacherUseCase

  beforeEach(() => {
    teachersRepository = new InMemoryTeachersRepository()
    sut = new UpdateTeacherUseCase(teachersRepository)
  })

  it('updates an existing teacher', async () => {
    const existingTeacher = makeTeacher()
    teachersRepository.items.push(existingTeacher)

    const { teacher } = await sut.execute(existingTeacher.id, {
      name: 'Professor Atualizado',
      cpf: '123.456.789-00',
      birthDate: '1989-04-10',
      email: 'professor.updated@example.com',
      phone: '(71) 99999-5678',
      photo: null,
      specialities: ['Treinamento tecnico infantil'],
      categories: ['Mirim', 'Petiz'],
      experience: '8',
      certifications: 'CBDA Nivel 2',
      status: 'Ativo',
      bio: 'Atualizacao do professor',
    })

    expect(teacher.name).toBe('Professor Atualizado')
    expect(teacher.experience).toBe(8)
    expect(teacher.speciality).toBe('Treinamento tecnico infantil')
  })

  it('throws when teacher does not exist', async () => {
    await expect(() =>
      sut.execute('missing-teacher', {
        name: 'Professor Atualizado',
        cpf: '123.456.789-00',
        birthDate: '1989-04-10',
        email: 'professor.updated@example.com',
        phone: '(71) 99999-5678',
        photo: null,
        specialities: ['Treinamento tecnico infantil'],
        categories: ['Mirim', 'Petiz'],
        experience: '8',
        certifications: 'CBDA Nivel 2',
        status: 'Ativo',
        bio: 'Atualizacao do professor',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

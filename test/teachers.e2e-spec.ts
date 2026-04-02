import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { TeachersRepository } from '@/domain/teachers/application/repositories/teachers-repository'
import { InMemoryTeachersRepository } from './repositories/in-memory-teachers-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'
import { makeTeacher } from './factories/make-teacher'

describe('TeachersController (e2e)', () => {
  let app: INestApplication<App>
  let teachersRepository: InMemoryTeachersRepository

  beforeEach(async () => {
    teachersRepository = new InMemoryTeachersRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(TeachersRepository).useValue(teachersRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes teachers', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/teachers').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/teachers')
      .send({
        name: 'Professor E2E',
        cpf: '123.456.789-00',
        birthDate: '1990-06-15',
        email: 'professor.e2e@example.com',
        phone: '(71) 99999-1234',
        photo: null,
        specialities: ['Nado costas', 'Aperfeicoamento'],
        categories: ['Pre-Mirim', 'Mirim'],
        experience: '6',
        certifications: 'CBDA Nivel 1, Primeiros Socorros',
        status: 'Ativo',
        bio: 'Professor criado no e2e',
      })
      .expect(201)

    const teacherId = createResponse.body.data.id as string
    expect(createResponse.body.data.name).toBe('Professor E2E')
    expect(createResponse.body.data.categories).toEqual(['Pre-Mirim', 'Mirim'])

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/teachers/${teacherId}`)
      .send({
        name: 'Professor E2E Atualizado',
        cpf: '123.456.789-00',
        birthDate: '1989-04-10',
        email: 'professor.e2e.updated@example.com',
        phone: '(71) 99999-5678',
        photo: null,
        specialities: ['Treinamento tecnico infantil'],
        categories: ['Mirim', 'Petiz'],
        experience: '8',
        certifications: 'CBDA Nivel 2',
        status: 'Ativo',
        bio: 'Professor atualizado no e2e',
      })
      .expect(200)

    expect(updateResponse.body.data.name).toBe('Professor E2E Atualizado')
    expect(updateResponse.body.data.experience).toBe(8)
    expect(updateResponse.body.data.certifications).toEqual(['CBDA Nivel 2'])

    const listAfter = await request(app.getHttpServer()).get('/api/teachers').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.meta.total).toBe(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/teachers/${teacherId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(teacherId)

    const listFinal = await request(app.getHttpServer()).get('/api/teachers').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates teachers list', async () => {
    teachersRepository.items.push(
      makeTeacher({ id: '11111111-1111-4111-8111-111111111111', name: 'Ana Paula', status: 'Ativo', email: 'ana@example.com' }),
      makeTeacher({ id: '22222222-2222-4222-8222-222222222222', name: 'Bruno Lima', status: 'Licença', email: 'bruno@example.com' }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/teachers?page=1&perPage=1&search=ana&status=Ativo')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Ana Paula')
    expect(response.body.meta.total).toBe(1)
    expect(response.body.meta.perPage).toBe(1)
  })
})

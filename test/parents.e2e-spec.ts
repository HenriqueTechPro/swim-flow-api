import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { ParentsRepository } from '@/domain/parents/application/repositories/parents-repository'
import { makeParent } from './factories/make-parent'
import { InMemoryParentsRepository } from './repositories/in-memory-parents-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('ParentsController (e2e)', () => {
  let app: INestApplication<App>
  let parentsRepository: InMemoryParentsRepository

  beforeEach(async () => {
    parentsRepository = new InMemoryParentsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ParentsRepository).useValue(parentsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes parents', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/parents').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/parents')
      .send({
        name: 'Responsavel E2E',
        cpf: '987.654.321-00',
        birthDate: '1985-08-20',
        photo: null,
        childrenIds: ['88888888-8888-4888-8888-888888888888'],
        email: 'responsavel.e2e@example.com',
        phone: '(71) 98888-2222',
        profession: 'Analista',
        address: 'Rua das Piscinas, 123',
        emergencyContact: 'Contato Emergencial',
        emergencyPhone: '(71) 97777-1111',
        status: 'Ativo',
      })
      .expect(201)

    const parentId = createResponse.body.data.id as string
    expect(createResponse.body.data.name).toBe('Responsavel E2E')
    expect(createResponse.body.data.childrenIds).toEqual(['88888888-8888-4888-8888-888888888888'])

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/parents/${parentId}`)
      .send({
        name: 'Responsavel E2E Atualizado',
        cpf: '987.654.321-00',
        birthDate: '1985-08-20',
        photo: null,
        childrenIds: ['88888888-8888-4888-8888-888888888888'],
        email: 'responsavel.e2e.updated@example.com',
        phone: '(71) 98888-3333',
        profession: 'Coordenador',
        address: 'Rua das Piscinas, 456',
        emergencyContact: 'Novo Contato',
        emergencyPhone: '(71) 97777-2222',
        status: 'Ativo',
      })
      .expect(200)

    expect(updateResponse.body.data.name).toBe('Responsavel E2E Atualizado')
    expect(updateResponse.body.data.email).toBe('responsavel.e2e.updated@example.com')

    const listAfter = await request(app.getHttpServer()).get('/api/parents').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.meta.total).toBe(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/parents/${parentId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(parentId)

    const listFinal = await request(app.getHttpServer()).get('/api/parents').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates parents list', async () => {
    parentsRepository.items.push(
      makeParent({
        name: 'Ana Souza',
        email: 'ana@example.com',
        profession: 'Medica',
        status: 'Ativo',
        children: ['Lucas'],
      }),
      makeParent({
        name: 'Bruno Lima',
        email: 'bruno@example.com',
        profession: 'Professor',
        status: 'Inativo',
        children: ['Marina'],
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/parents?page=1&perPage=1&search=ana&status=Ativo')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Ana Souza')
    expect(response.body.meta.total).toBe(1)
  })
})

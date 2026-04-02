import { beforeEach, describe, expect, it, afterEach } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { StudentsRepository } from '@/domain/students/application/repositories/students-repository'
import { InMemoryStudentsRepository } from './repositories/in-memory-students-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'
import { makeStudent } from './factories/make-student'

describe('StudentsController (e2e)', () => {
  let app: INestApplication<App>
  let studentsRepository: InMemoryStudentsRepository

  beforeEach(async () => {
    studentsRepository = new InMemoryStudentsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(StudentsRepository).useValue(studentsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes students', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/students').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/students')
      .send({
        name: 'Aluno E2E',
        gender: 'Masculino',
        birthDate: '2014-05-10',
        level: 'Iniciante',
        parentId: null,
        classId: null,
        phone: '(71) 99999-1111',
        status: 'Ativo',
        photo: null,
      })
      .expect(201)

    expect(createResponse.body.data.name).toBe('Aluno E2E')
    const studentId = createResponse.body.data.id as string

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/students/${studentId}`)
      .send({
        name: 'Aluno E2E Atualizado',
        gender: 'Masculino',
        birthDate: '2013-05-10',
        level: 'Intermediário',
        parentId: null,
        classId: null,
        phone: '(71) 99999-2222',
        status: 'Ativo',
        photo: null,
      })
      .expect(200)

    expect(updateResponse.body.data.name).toBe('Aluno E2E Atualizado')
    expect(updateResponse.body.data.birthYear).toBe(2013)

    const listAfter = await request(app.getHttpServer()).get('/api/students').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.meta.total).toBe(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/students/${studentId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(studentId)

    const listFinal = await request(app.getHttpServer()).get('/api/students').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates students list', async () => {
    studentsRepository.items.push(
      makeStudent({ id: '11111111-1111-4111-8111-111111111111', name: 'Ana', responsible: 'Maria', status: 'Ativo' }),
      makeStudent({ id: '22222222-2222-4222-8222-222222222222', name: 'Bruno', responsible: 'Joao', status: 'Licença' }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/students?page=1&perPage=1&search=ana&status=Ativo')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Ana')
    expect(response.body.meta.total).toBe(1)
    expect(response.body.meta.perPage).toBe(1)
  })
})

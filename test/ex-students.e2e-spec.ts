import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { ExStudentsRepository } from '@/domain/ex-students/application/repositories/ex-students-repository'
import { makeExStudent } from './factories/make-ex-student'
import { InMemoryExStudentsRepository } from './repositories/in-memory-ex-students-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('ExStudentsController (e2e)', () => {
  let app: INestApplication<App>
  let exStudentsRepository: InMemoryExStudentsRepository

  beforeEach(async () => {
    exStudentsRepository = new InMemoryExStudentsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ExStudentsRepository).useValue(exStudentsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes ex-students', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/ex-students').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/ex-students')
      .send({
        studentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        exitDate: '2026-03-31',
        exitReason: 'Mudanca de cidade',
        exitNotes: 'Arquivo criado no e2e',
        lastCompetition: 'Festival Interno',
      })
      .expect(201)

    const exStudentId = createResponse.body.data.id as string
    expect(createResponse.body.data.exitReason).toBe('Mudanca de cidade')

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/ex-students/${exStudentId}`)
      .send({
        exitDate: '2026-03-31',
        exitReason: 'Mudanca de cidade',
        exitNotes: 'Historico atualizado no e2e',
        achievements: 3,
        lastCompetition: 'Torneio Regional',
      })
      .expect(200)

    expect(updateResponse.body.data.achievements).toBe(3)
    expect(updateResponse.body.data.lastCompetition).toBe('Torneio Regional')

    const listAfter = await request(app.getHttpServer()).get('/api/ex-students').expect(200)
    expect(listAfter.body.data).toHaveLength(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/ex-students/${exStudentId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(exStudentId)

    const listFinal = await request(app.getHttpServer()).get('/api/ex-students').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('reactivates an ex-student', async () => {
    const existingExStudent = makeExStudent({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
    exStudentsRepository.items.push(existingExStudent)

    const reactivateResponse = await request(app.getHttpServer())
      .post(`/api/ex-students/${existingExStudent.id}/reactivate`)
      .send({
        id: existingExStudent.id,
      })
      .expect(201)

    expect(reactivateResponse.body.data.id).toBe(existingExStudent.id)
    expect(exStudentsRepository.items).toHaveLength(0)
  })

  it('filters and paginates ex-students list', async () => {
    exStudentsRepository.items.push(
      makeExStudent({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name: 'Ana Historico',
        category: 'Petiz 2',
        exitReason: 'Mudanca de cidade',
        lastCompetition: 'Festival Interno',
      }),
      makeExStudent({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        name: 'Bruno Historico',
        category: 'Infantil 1',
        exitReason: 'Outro esporte',
        lastCompetition: 'Regional',
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/ex-students?page=1&perPage=1&search=ana&category=Petiz%202')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Ana Historico')
    expect(response.body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 1,
    })
  })
})

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { TrainingsRepository } from '@/domain/trainings/application/repositories/trainings-repository'
import { InMemoryTrainingsRepository } from './repositories/in-memory-trainings-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('TrainingsController (e2e)', () => {
  let app: INestApplication<App>
  let trainingsRepository: InMemoryTrainingsRepository

  beforeEach(async () => {
    trainingsRepository = new InMemoryTrainingsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(TrainingsRepository).useValue(trainingsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes trainings', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/trainings').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/trainings')
      .send({
        title: 'Treino E2E',
        description: 'Treino criado no e2e',
        type: 'Misto',
        dayOfWeek: 'Segunda-feira',
        startTime: '18:00',
        endTime: '19:00',
        instructorId: '99999999-9999-4999-8999-999999999999',
        level: 'Todos',
        maxParticipants: 20,
        status: 'Ativo',
        poolId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
      .expect(201)

    const trainingId = createResponse.body.data.id as string
    expect(createResponse.body.data.title).toBe('Treino E2E')

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/trainings/${trainingId}`)
      .send({
        title: 'Treino E2E Atualizado',
        description: 'Treino atualizado no e2e',
        type: 'Misto',
        dayOfWeek: 'Quarta-feira',
        startTime: '18:30',
        endTime: '19:30',
        instructorId: '99999999-9999-4999-8999-999999999999',
        level: 'Todos',
        maxParticipants: 24,
        currentParticipants: 2,
        status: 'Ativo',
        poolId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
      .expect(200)

    expect(updateResponse.body.data.title).toBe('Treino E2E Atualizado')
    expect(updateResponse.body.data.currentParticipants).toBe(2)

    const listAfter = await request(app.getHttpServer()).get('/api/trainings').expect(200)
    expect(listAfter.body.data).toHaveLength(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/trainings/${trainingId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(trainingId)

    const listFinal = await request(app.getHttpServer()).get('/api/trainings').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates trainings list', async () => {
    await trainingsRepository.create({
      title: 'Treino Tecnico A',
      description: 'Foco em tecnica',
      type: 'Técnico',
      dayOfWeek: 'Segunda-feira',
      startTime: '18:00',
      endTime: '19:00',
      instructorId: 'teacher-1',
      level: 'Todos',
      maxParticipants: 20,
      status: 'Ativo',
      poolId: 'pool-a',
    })

    await trainingsRepository.create({
      title: 'Treino Velocidade B',
      description: 'Tiros curtos',
      type: 'Velocidade',
      dayOfWeek: 'Quarta-feira',
      startTime: '19:00',
      endTime: '20:00',
      instructorId: 'teacher-2',
      level: 'Todos',
      maxParticipants: 16,
      status: 'Pausado',
      poolId: 'pool-b',
    })

    const response = await request(app.getHttpServer())
      .get('/api/trainings?page=1&perPage=1&search=tecnico&type=Técnico&status=Ativo&poolId=pool-a')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].title).toBe('Treino Tecnico A')
    expect(response.body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 1,
    })
  })
})

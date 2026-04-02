import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository'
import { makeResult } from './factories/make-result'
import { InMemoryResultsRepository } from './repositories/in-memory-results-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('ResultsController (e2e)', () => {
  let app: INestApplication<App>
  let resultsRepository: InMemoryResultsRepository

  beforeEach(async () => {
    resultsRepository = new InMemoryResultsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ResultsRepository).useValue(resultsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes results', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/results').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/results')
      .send({
        studentId: '77777777-7777-4777-8777-777777777777',
        style: 'Livre',
        distance: '50m',
        time: '00:34.21',
        date: '2026-03-31',
        competition: 'Festival Interno',
        position: 1,
        category: 'Petiz 2',
        notes: 'Resultado criado no e2e',
      })
      .expect(201)

    const resultId = createResponse.body.data.id as string
    expect(createResponse.body.data.style).toBe('Livre')
    expect(createResponse.body.data.distance).toBe('50m')

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/results/${resultId}`)
      .send({
        studentId: '77777777-7777-4777-8777-777777777777',
        style: 'Livre',
        distance: '50m',
        time: '00:33.80',
        timeInSeconds: 33.8,
        date: '2026-03-31',
        competition: 'Festival Interno',
        position: 1,
        personalBest: true,
        improvement: -0.41,
        category: 'Petiz 2',
        notes: 'Melhorou o tempo',
      })
      .expect(200)

    expect(updateResponse.body.data.timeInSeconds).toBe(33.8)
    expect(updateResponse.body.data.personalBest).toBe(true)

    const listAfter = await request(app.getHttpServer()).get('/api/results').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.meta.total).toBe(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/results/${resultId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(resultId)

    const listFinal = await request(app.getHttpServer()).get('/api/results').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates results list', async () => {
    resultsRepository.items.push(
      makeResult({
        studentId: 'student-1',
        date: '2026-03-31',
        studentName: 'Ana',
        style: 'Livre',
        distance: '50m',
        competition: 'Festival A',
        category: 'Petiz 2',
      }),
      makeResult({
        studentId: 'student-2',
        date: '2025-03-31',
        studentName: 'Bruno',
        style: 'Costas',
        distance: '100m',
        competition: 'Festival B',
        category: 'Infantil 1',
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/results?page=1&perPage=1&search=ana&style=Livre&distance=50m&competition=Festival%20A&category=Petiz%202&startDate=2026-01-01&endDate=2026-12-31&studentId=student-1')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].studentName).toBe('Ana')
    expect(response.body.meta.total).toBe(1)
  })
})

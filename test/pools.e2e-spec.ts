import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { PoolsRepository } from '@/domain/pools/application/repositories/pools-repository'
import { makePool } from './factories/make-pool'
import { InMemoryPoolsRepository } from './repositories/in-memory-pools-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('PoolsController (e2e)', () => {
  let app: INestApplication<App>
  let poolsRepository: InMemoryPoolsRepository

  beforeEach(async () => {
    poolsRepository = new InMemoryPoolsRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(PoolsRepository).useValue(poolsRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists, creates, updates and deletes pools', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/pools').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/pools')
      .send({
        name: 'Piscina E2E',
        lengthMeters: 25,
        address: 'Rua das Piscinas, 100',
        status: 'Ativa',
        maxCapacity: 40,
      })
      .expect(201)

    const poolId = createResponse.body.data.id as string
    expect(createResponse.body.data.name).toBe('Piscina E2E')
    expect(createResponse.body.data.length_meters).toBe(25)

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/pools/${poolId}`)
      .send({
        name: 'Piscina E2E Atualizada',
        lengthMeters: 25,
        address: 'Rua das Piscinas, 200',
        status: 'Ativa',
        maxCapacity: 45,
      })
      .expect(200)

    expect(updateResponse.body.data.name).toBe('Piscina E2E Atualizada')
    expect(updateResponse.body.data.max_capacity).toBe(45)

    const listAfter = await request(app.getHttpServer()).get('/api/pools').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.meta.total).toBe(1)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/pools/${poolId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(poolId)

    const listFinal = await request(app.getHttpServer()).get('/api/pools').expect(200)
    expect(listFinal.body.data).toEqual([])
  })

  it('filters and paginates pools list', async () => {
    poolsRepository.items.push(
      makePool({
        name: 'Piscina Central',
        address: 'Rua A',
        status: 'Ativa',
      }),
      makePool({
        name: 'Piscina Secundaria',
        address: 'Rua B',
        status: 'Inativa',
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/pools?page=1&perPage=1&search=central&status=Ativa')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Piscina Central')
    expect(response.body.meta.total).toBe(1)
  })
})

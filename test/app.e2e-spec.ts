import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    app = await createE2EApp(withDefaultTestOverrides)
  })

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok')
        expect(response.body.service).toBe('swim-flow-nest-api')
      })
  })

  afterEach(async () => {
    await app.close()
  })
})

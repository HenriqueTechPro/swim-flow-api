import { INestApplication } from '@nestjs/common'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import { App } from 'supertest/types'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.factory'
import { PrismaService } from '../../src/infra/database/prisma/prisma.service'
import { JwtAuthGuard } from '../../src/infra/auth/jwt-auth.guard'
import { RolesGuard } from '../../src/infra/auth/roles.guard'

export function withDefaultTestOverrides(builder: TestingModuleBuilder) {
  return builder.overrideProvider(PrismaService).useValue({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })
}

export function withAuthenticatedOverrides(builder: TestingModuleBuilder) {
  return withDefaultTestOverrides(builder)
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
}

export async function createE2EApp(
  overrideBuilder?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  })

  if (overrideBuilder) {
    builder = overrideBuilder(builder)
  }

  const moduleFixture = await builder.compile()
  const app = moduleFixture.createNestApplication()

  await configureApp(app)
  await app.init()

  return app
}

export async function createAuthenticatedE2EApp(
  overrideBuilder?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication<App>> {
  return createE2EApp((builder) => {
    const authenticatedBuilder = withAuthenticatedOverrides(builder)
    return overrideBuilder ? overrideBuilder(authenticatedBuilder) : authenticatedBuilder
  })
}

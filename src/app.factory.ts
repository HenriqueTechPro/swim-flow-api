import express from 'express'
import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { env } from '@/infra/env/env'
import { AppErrorFilter } from '@/infra/http/filters/app-error.filter'

export async function configureApp(app: INestApplication) {
  app.use(express.json({ strict: true }))
  app.use(express.urlencoded({ extended: true }))
  app.useGlobalFilters(new AppErrorFilter())

  if (env.swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Swim Flow API')
      .setDescription('Documentacao da API administrativa do Swim Flow')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Informe o access token do Supabase',
        },
        'supabase-bearer',
      )
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup(env.swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  }

  return app
}

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  })

  return configureApp(app)
}

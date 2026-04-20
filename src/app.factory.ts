import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from '@/infra/env/env';
import { AppErrorFilter } from '@/infra/http/filters/app-error.filter';
import { createCorsOptions } from '@/infra/http/cors/cors.config';

function normalizeJsonBody(req: Request, _res: Response, next: NextFunction) {
  if (typeof req.body !== 'string') {
    return next();
  }

  const trimmedBody = req.body.trim();
  if (
    !trimmedBody ||
    !(trimmedBody.startsWith('{') || trimmedBody.startsWith('['))
  ) {
    return next();
  }

  try {
    const parsedBody: unknown = JSON.parse(trimmedBody);
    req.body = parsedBody;
  } catch {
    // Keep the original body so the validation layer can respond consistently.
  }

  return next();
}

function applySecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

export function configureApp(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  app.use(express.json({ strict: true }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.text({ type: ['text/plain'] }));
  app.use(cookieParser());
  app.use(applySecurityHeaders);
  app.use(normalizeJsonBody);
  app.useGlobalFilters(new AppErrorFilter());

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
          description: 'Informe o access token emitido pela API',
        },
        'api-bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(env.swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: false,
      },
    });
  }

  return app;
}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(createCorsOptions(env.corsOrigins));

  return configureApp(app);
}

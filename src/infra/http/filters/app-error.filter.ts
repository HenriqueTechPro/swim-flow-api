import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from '@/shared/errors/app-error';

import { mapPrismaException } from './prisma-error.mapper';

@Catch()
export class AppErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        error: 'Application Error',
        message: exception.message,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      return response.status(status).json(
        typeof body === 'string'
          ? {
              statusCode: status,
              error: exception.name,
              message: body,
            }
          : body,
      );
    }

    const mappedError = mapPrismaException(exception);
    if (mappedError) {
      return response.status(mappedError.statusCode).json(mappedError);
    }

    console.error(exception);

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Unexpected server error',
    });
  }
}

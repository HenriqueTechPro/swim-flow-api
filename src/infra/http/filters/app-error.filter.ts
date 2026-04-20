import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AppError } from '@/shared/errors/app-error';

const prismaErrorMap: Record<
  string,
  { statusCode: number; error: string; message: string }
> = {
  P2002: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: 'A uniqueness constraint would be violated by this operation',
  },
  P2003: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: 'The operation violates a related resource constraint',
  },
  P2025: {
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    message: 'Requested resource was not found',
  },
};

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

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mappedError = prismaErrorMap[exception.code];

      return response
        .status(mappedError?.statusCode ?? HttpStatus.UNPROCESSABLE_ENTITY)
        .json({
          statusCode:
            mappedError?.statusCode ?? HttpStatus.UNPROCESSABLE_ENTITY,
          error: mappedError?.error ?? 'Database Error',
          message: mappedError?.message ?? 'Database operation failed',
        });
    }

    console.error(exception);

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Unexpected server error',
    });
  }
}

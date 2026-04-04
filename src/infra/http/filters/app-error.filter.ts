import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { AppError } from '@/shared/errors/app-error'
import { Prisma } from '@prisma/client'

@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        error: 'Application Error',
        message: exception.message,
      })
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()

      return response.status(status).json(
        typeof body === 'string'
          ? {
              statusCode: status,
              error: exception.name,
              message: body,
            }
          : body,
      )
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Prisma known request error (${exception.code})`, exception.stack)

      const statusCode =
        exception.code === 'P2025'
          ? HttpStatus.NOT_FOUND
          : exception.code === 'P2002'
            ? HttpStatus.CONFLICT
            : HttpStatus.UNPROCESSABLE_ENTITY

      const message =
        exception.code === 'P2025'
          ? 'Requested record was not found'
          : exception.code === 'P2002'
            ? 'A record with the same unique value already exists'
            : 'The database rejected this operation'

      return response.status(statusCode).json({
        statusCode,
        error: 'Database Error',
        message,
      })
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      this.logger.error('Prisma unknown request error', exception.stack)

      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Database Error',
        message: 'Unexpected database error',
      })
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception))

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Unexpected server error',
    })
  }
}

import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';

export interface SafeDatabaseHttpError {
  statusCode: number;
  error: string;
  message: string;
}

// Never return the raw Prisma message/metadata: it can contain names of
// tables, columns, values, SQL fragments or personally identifying data.
const CONFLICT: SafeDatabaseHttpError = {
  statusCode: HttpStatus.CONFLICT,
  error: 'Conflict',
  message: 'The requested operation conflicts with existing data',
};
const INVALID_VALUE: SafeDatabaseHttpError = {
  statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  error: 'Unprocessable Entity',
  message: 'The submitted data violates a database validation rule',
};
const NOT_FOUND: SafeDatabaseHttpError = {
  statusCode: HttpStatus.NOT_FOUND,
  error: 'Not Found',
  message: 'Requested resource was not found',
};
const BUSY: SafeDatabaseHttpError = {
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
  error: 'Service Unavailable',
  message: 'Database temporarily unavailable',
};
const UNKNOWN_DATABASE_ERROR: SafeDatabaseHttpError = {
  statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  error: 'Database Error',
  message: 'Database operation failed',
};

/**
 * Translate database failures into sanitized and stable HTTP responses.
 * P2034 means a transaction was rolled back due to write conflict/deadlock.
 * PostgreSQL CHECK violations can surface as Prisma unknown request errors.
 * Do not attempt to infer authorization or expose database field names.
 */
export function mapPrismaException(error: unknown): SafeDatabaseHttpError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // unique/partial unique constraint
      case 'P2003': // foreign key constraint
      case 'P2004': // other database constraint
      case 'P2014': // required relation constraint
      case 'P2034': // transaction write conflict / deadlock
        return CONFLICT;
      case 'P2025': // required record for operation missing
        return NOT_FOUND;
      case 'P2024': // connection pool exhausted
        return BUSY;
      default:
        return UNKNOWN_DATABASE_ERROR;
    }
  }

  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    (/violates check constraint\s+["'][A-Za-z0-9_]+["']/i.test(error.message) ||
      /checkconstraintviolation/i.test(error.message) ||
      /SQLSTATE\s*[:=]?\s*23514/i.test(error.message))
  ) {
    return INVALID_VALUE;
  }

  return null;
}

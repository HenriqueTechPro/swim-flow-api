import { Prisma } from '@prisma/client';
import { mapPrismaException } from './prisma-error.mapper';

const known = (code: string, raw = 'secret_student_identifier, SELECT * FROM students') =>
  new Prisma.PrismaClientKnownRequestError(raw, {
    code,
    clientVersion: '6.19.3',
    meta: { target: ['students_private_id'] },
  });
const unknown = (message: string) =>
  new Prisma.PrismaClientUnknownRequestError(message, {
    clientVersion: '6.19.3',
  });

describe('Prisma HTTP error mapping', () => {
  it.each(['P2002', 'P2003', 'P2004', 'P2014', 'P2034'])(
    'returns a safe 409 conflict for code %s',
    (code) => {
      expect(mapPrismaException(known(code))).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'The requested operation conflicts with existing data',
      });
    },
  );

  it('returns 404 for a missing record, not 409', () => {
    expect(mapPrismaException(known('P2025'))).toMatchObject({
      statusCode: 404,
    });
  });

  it('returns 503 for an exhausted database pool', () => {
    expect(mapPrismaException(known('P2024'))).toMatchObject({
      statusCode: 503,
    });
  });

  it('keeps unclassified known Prisma errors sanitized', () => {
    const response = mapPrismaException(known('P2000'));
    expect(response).toMatchObject({ statusCode: 422 });
    expect(JSON.stringify(response)).not.toContain('secret_student_identifier');
    expect(JSON.stringify(response)).not.toContain('students_private_id');
  });

  it.each([
    'Raw query failed: ERROR: new row violates check constraint "pools_length_positive_chk"',
    'ConnectorError: kind: CheckConstraintViolation { constraint: "pool_results_duration_positive_chk" }',
    'Database operation failed: SQLSTATE: 23514',
  ])('maps database CHECK violations to safe 422 responses', (message) => {
    const response = mapPrismaException(unknown(message));
    expect(response).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'The submitted data violates a database validation rule',
    });
    expect(JSON.stringify(response)).not.toContain('pool_results');
    expect(JSON.stringify(response)).not.toContain('pools_length');
  });

  it('does not misclassify unrelated unknown Prisma errors as validation', () => {
    expect(mapPrismaException(unknown('Database engine could not connect'))).toBeNull();
    expect(mapPrismaException(new Error('violates check constraint "test_chk"'))).toBeNull();
    expect(mapPrismaException(null)).toBeNull();
  });
});

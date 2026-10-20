import { Prisma } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ParentsRepository } from '@/domain/parents/application/repositories/parents-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

const requestBody = {
  name: 'Responsavel de teste',
  photo: null,
  cpf: null,
  birthDate: null,
  childrenIds: [],
  email: 'test@example.invalid',
  phone: '(71) 99999-1111',
  profession: 'Professor',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  status: 'Ativo',
};

describe('Sanitized Prisma failures over HTTP (E2E)', () => {
  let app: INestApplication<App>;
  let createParent: jest.Mock;

  beforeEach(async () => {
    createParent = jest.fn();
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ParentsRepository).useValue({
        create: createParent,
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  const dbError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('secret_name@example.test', {
      code,
      clientVersion: '6.19.3',
      meta: { target: 'students.guardian_private_id' },
    });

  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2034', 409],
    ['P2025', 404],
    ['P2024', 503],
  ] as const)('returns a safe %s response with HTTP %s', async (code, expectedStatus) => {
    createParent.mockRejectedValue(dbError(code));
    const response = await request(app.getHttpServer())
      .post('/api/parents')
      .send(requestBody)
      .expect(expectedStatus);
    expect(response.body.statusCode).toBe(expectedStatus);
    expect(response.text).not.toContain('secret_name@example.test');
    expect(response.text).not.toContain('guardian_private_id');
    expect(createParent).toHaveBeenCalledTimes(1);
  });

  it('does not expose CHECK constraint names or query fragments', async () => {
    createParent.mockRejectedValue(new Prisma.PrismaClientUnknownRequestError(
      'Error: new row violates check constraint "anthropometry_positive_measures_chk"; private_name=CI',
      { clientVersion: '6.19.3' },
    ));
    const response = await request(app.getHttpServer())
      .post('/api/parents')
      .send(requestBody)
      .expect(422);
    expect(response.text).not.toContain('anthropometry_positive_measures_chk');
    expect(response.text).not.toContain('private_name');
    expect(response.body.message).toBe('The submitted data violates a database validation rule');
  });
});

import { randomUUID } from 'node:crypto';
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.factory';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { LocalAuthActionTokensService } from '@/infra/auth/local-auth-action-tokens.service';
import { LocalInvitationMailSender } from '@/infra/auth/local-invitation-mail-sender';
import { LocalPasswordIdentityService } from '@/infra/auth/local-password-identity.service';
import { PrismaService } from '@/infra/database/prisma/prisma.service';

const adminId = randomUUID();
const teacherId = randomUUID();
const adminEmail = 'ci-admin-' + adminId + '@example.invalid';
const recipientEmail = 'ci-guest-' + randomUUID() + '@example.invalid';

function assertDisposableDatabase(): void {
  if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes') {
    throw new Error('Local invitation PostgreSQL integration only runs in disposable CI');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    let url: URL;
    try {
      url = new URL(process.env[key]);
    } catch {
      throw new Error('Both PostgreSQL URLs must target disposable CI');
    }
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) ||
      url.pathname !== '/swimflow' ||
      (url.port && url.port !== '5432') ||
      !url.username || !url.password
    ) {
      throw new Error('Remote database access is forbidden in this integration test');
    }
  }
}

describe('Staging invitation HTTP -> disposable PostgreSQL -> password verification', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let actions: LocalAuthActionTokensService;
  let passwords: LocalPasswordIdentityService;
  let guestId: string | null = null;
  const messages: Array<{ to: string; token: string; expiresAt: Date }> = [];
  const flagNames = ['SWIMFLOW_LOCAL_INVITATION_API_ENABLED', 'SWIMFLOW_LOCAL_INVITES_ENABLED'] as const;
  const beforeFlags = flagNames.map((key) => process.env[key]);

  beforeAll(async () => {
    assertDisposableDatabase();
    const mail = {
      assertReady: () => undefined,
      sendInvitation: async (message: { to: string; token: string; expiresAt: Date }) => {
        messages.push(message);
      },
    };
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LocalInvitationMailSender)
      .useValue(mail)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; email: string; sessionId: string };
          }>();
          const token = req.headers.authorization;
          if (token !== 'Bearer admin' && token !== 'Bearer teacher') {
            throw new UnauthorizedException('Bearer token required');
          }
          req.user = {
            id: token === 'Bearer admin' ? adminId : teacherId,
            email: token === 'Bearer admin' ? adminEmail : 'ci-teacher@example.invalid',
            sessionId: 'ci-jwt-guard',
          };
          return true;
        },
      });
    const fixture = await builder.compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    actions = app.get(LocalAuthActionTokensService);
    passwords = app.get(LocalPasswordIdentityService);

    await prisma.profile.create({
      data: {
        id: adminId,
        fullName: 'Disposable CI Administrator',
        role: 'admin',
        localAuthIdentity: {
          create: {
            email: adminEmail,
            passwordHash: await passwords.hashPasswordForProvisioning('ci-admin-passphrase-2026'),
            emailConfirmedAt: new Date(),
          },
        },
      },
    });
    await prisma.profile.create({
      data: { id: teacherId, fullName: 'CI Nonadmin', role: 'teacher' },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.profile.deleteMany({
        where: { id: { in: [adminId, teacherId, ...(guestId ? [guestId] : [])] } },
      });
    }
    if (app) await app.close();
    for (let i = 0; i < flagNames.length; i += 1) {
      if (beforeFlags[i] === undefined) delete process.env[flagNames[i]];
      else process.env[flagNames[i]] = beforeFlags[i];
    }
  });

  it('fails closed and enforces admin permission from the actual database', async () => {
    const payload = { email: recipientEmail, fullName: 'Guest CI', role: 'user' };
    await request(app.getHttpServer())
      .post('/api/auth/local-invitations')
      .set('Authorization', 'Bearer admin')
      .send(payload)
      .expect(503);
    process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED = 'true';
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    await request(app.getHttpServer())
      .post('/api/auth/local-invitations')
      .set('Authorization', 'Bearer teacher')
      .send(payload)
      .expect(403);
    expect(messages).toHaveLength(0);
    expect(await prisma.localAuthIdentity.count({ where: { email: recipientEmail } })).toBe(0);
  });

  it('invites through HTTP then accepts locally and signs in with bcrypt on PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/local-invitations')
      .set('Authorization', 'Bearer admin')
      .send({ email: recipientEmail.toUpperCase(), fullName: 'CI Guest', role: 'user' })
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(response.body).toEqual({ data: { success: true } });
    expect(messages).toHaveLength(1);
    const guest = await prisma.localAuthIdentity.findUniqueOrThrow({
      where: { email: recipientEmail },
    });
    guestId = guest.userId;
    expect(guest.passwordHash).toBeNull();
    expect(guest.emailConfirmedAt).toBeNull();
    expect(messages[0].to).toBe(recipientEmail);
    const password = 'new-ci-swimmer-password-2026';
    await actions.redeemWithPassword(messages[0].token, 'INVITATION', password);
    const validated = await passwords.signInWithPassword(recipientEmail, password);
    expect(validated.id).toBe(guestId);
    await expect(actions.redeemWithPassword(messages[0].token, 'INVITATION', password))
      .rejects.toThrow();
    await request(app.getHttpServer())
      .post('/api/auth/local-invitations')
      .set('Authorization', 'Bearer admin')
      .send({ email: recipientEmail, role: 'user' })
      .expect(409);
    expect(messages).toHaveLength(1);
  });
});

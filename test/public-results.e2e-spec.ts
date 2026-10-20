import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { UnauthorizedException, type ExecutionContext, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { makeResult } from './factories/make-result';
import { InMemoryResultsRepository } from './repositories/in-memory-results-repository';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('Legacy public-results URL restricted to administrators (e2e)', () => {
  let app: INestApplication<App>;
  let resultsRepository: InMemoryResultsRepository;

  beforeEach(async () => {
    resultsRepository = new InMemoryResultsRepository();

    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        // Only JWT signature verification is simulated. The real RolesGuard
        // and PermissionsGuard must both authorize the database-backed role.
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest<{
              headers: { authorization?: string };
              user?: { id: string; email: string; sessionId: string };
            }>();
            const token = req.headers.authorization;
            if (!token?.startsWith('Bearer ') ||
                !['Bearer admin', 'Bearer teacher', 'Bearer user'].includes(token)) {
              throw new UnauthorizedException('Missing or invalid bearer token');
            }
            req.user = {
              id: token.slice('Bearer '.length),
              email: 'test@example.invalid',
              sessionId: 'test-session',
            };
            return true;
          },
        })
        .overrideProvider(AuthProfilesRepository)
        .useValue({
          findByUserId: async (id: string) => ({
            id,
            role: id,
            permissions: getPermissionsForRole(id as 'admin' | 'teacher' | 'user'),
            fullName: 'Test account',
            avatarUrl: null,
          }),
        })
        .overrideProvider(ResultsRepository)
        .useValue(resultsRepository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  const legacyRoutes = [
    '/api/public/results?studentId=student-1&search=Ana',
    '/api/public/results/ranking?studentId=student-1',
    '/api/public/results/contexts?category=Petiz%202',
  ];

  it.each(legacyRoutes)('rejects anonymous requests to %s before any result lookup', async (url) => {
    const response = await request(app.getHttpServer()).get(url).expect(401);
    expect(response.text).not.toContain('studentName');
    expect(response.text).not.toContain('Ana');
  });

  it.each(['teacher', 'user'] as const)(
    'rejects a signed-in %s on all legacy public result routes',
    async (role) => {
      for (const route of legacyRoutes) {
        const response = await request(app.getHttpServer())
          .get(route)
          .set('Authorization', `Bearer ${role}`)
          .expect(403);
        expect(response.text).not.toContain('studentName');
        expect(response.text).not.toContain('Ana');
      }
    },
  );

  it('marks all legacy result responses as private and non-indexable', async () => {
    for (const route of legacyRoutes) {
      const response = await request(app.getHttpServer())
        .get(route)
        .set('Authorization', 'Bearer admin')
        .expect(200);
      expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    }
  });

  it('allows an administrator to inspect legacy result data', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'public-result-1',
        studentId: 'student-public-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        notes: 'nota interna',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/public/results?discipline=Piscina')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: 'public-result-1',
      studentId: 'student-public-1',
      studentName: 'Ana',
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      style: 'Livre',
      distance: '50m',
      eventFormat: 'Prova Individual',
      category: 'Petiz 2',
    });
    expect(response.body.data[0].notes).toBeUndefined();
  });

  it('allows an administrator to inspect the legacy ranking', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'result-1',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:33.90',
        timeInSeconds: 33.9,
      }),
      makeResult({
        id: 'result-2',
        studentId: 'student-2',
        studentName: 'Bruno',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:32.50',
        timeInSeconds: 32.5,
      }),
      makeResult({
        id: 'result-3',
        studentId: 'student-3',
        studentName: 'Caio',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
        time: '00:32.50',
        timeInSeconds: 32.5,
      }),
      makeResult({
        id: 'result-4',
        studentId: 'student-4',
        studentName: 'Duda',
        discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        style: 'Livre',
        distance: '5km',
        eventFormat: 'Travessia',
        category: 'Petiz 2',
        time: '01:12:45.32',
        timeInSeconds: 4365.32,
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/public/results/ranking?page=1&perPage=10&discipline=Piscina&competitionType=Piscina&courseType=Piscina%20Curta&style=Livre&distance=50m&eventFormat=Prova%20Individual&category=Petiz%202',
      )
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(response.body.meta.total).toBe(3);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data[0]).toMatchObject({
      rank: 1,
      studentId: 'student-2',
      resultId: 'result-2',
      timeInSeconds: 32.5,
    });
  });

  it('allows an administrator to inspect result contexts', async () => {
    resultsRepository.items.push(
      makeResult({
        id: 'context-1',
        studentId: 'student-1',
        studentName: 'Ana',
        discipline: 'Piscina',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        style: 'Livre',
        distance: '50m',
        eventFormat: 'Prova Individual',
        category: 'Petiz 2',
      }),
      makeResult({
        id: 'context-2',
        studentId: 'student-2',
        studentName: 'Bruno',
        discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        style: 'Livre',
        distance: '5km',
        eventFormat: 'Travessia',
        category: 'Junior',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/public/results/contexts?discipline=Piscina')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      discipline: 'Piscina',
      style: 'Livre',
      distance: '50m',
      category: 'Petiz 2',
    });
  });
});

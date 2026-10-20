import { randomUUID } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.factory';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { PrismaService } from '@/infra/database/prisma/prisma.service';

const adminId = randomUUID();
const teacherProfileId = randomUUID();
const unknownGuardianId = randomUUID();

// Mandatory double lock; NEVER run HTTP integration tests on Neon/Supabase
// or another database, including when the env variable is set in error.
function assertDisposableDatabase() {
  if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes') {
    throw new Error('Refusing database HTTP E2E outside disposable CI');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    try {
      const url = new URL(process.env[key]);
      if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
          url.pathname !== '/swimflow') throw new Error('not disposable');
    } catch {
      throw new Error('Refusing nonlocal or unexpected database URL: ' + key);
    }
  }
}

describe('NestJS HTTP + actual Prisma repositories + PostgreSQL 16 (disposable)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let classA: string;
  let classB: string;
  let parentId: string;
  let studentId: string;

  const asAdmin = (operation: request.Test) =>
    operation.set('Authorization', 'Bearer admin');
  const asTeacher = (operation: request.Test) =>
    operation.set('Authorization', 'Bearer teacher');

  beforeAll(async () => {
    assertDisposableDatabase();
    const builder = Test.createTestingModule({ imports: [AppModule] })
      // Only JWT verification is simulated. PrismaService, repositories,
      // domain use cases, RolesGuard and PermissionsGuard remain REAL.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; email: string; sessionId: string };
          }>();
          const token = req.headers.authorization;
          const id = token === 'Bearer admin' ? adminId :
            token === 'Bearer teacher' ? teacherProfileId : null;
          if (!id) throw new UnauthorizedException('Bearer token required');
          req.user = { id, email: 'ci@example.invalid', sessionId: 'http-ci' };
          return true;
        },
      });

    const moduleFixture = await builder.compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.profile.createMany({
      data: [
        { id: adminId, role: 'admin', fullName: 'Fictitious CI Admin' },
        { id: teacherProfileId, role: 'teacher', fullName: 'Fictitious CI Coach' },
      ],
    });

    // Earlier disposable DB test steps may have an ACTIVE season. No
    // production data exists here, so select one known test season.
    await prisma.season.updateMany({
      where: { status: 'ACTIVE' }, data: { status: 'CLOSED' },
    });
    const existingSeason = await prisma.season.findUnique({ where: { year: 2026 } });
    if (existingSeason) {
      await prisma.season.update({
        where: { id: existingSeason.id }, data: { status: 'ACTIVE' },
      });
    } else {
      await prisma.season.create({
        data: {
          year: 2026, label: 'Temporary CI season',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'), status: 'ACTIVE',
        },
      });
    }

    const category = await prisma.category.upsert({
      where: { name: 'Mirim_1' },
      create: { name: 'Mirim_1' },
      update: {},
    });
    await prisma.level.upsert({
      where: { name: 'Iniciante' },
      create: { name: 'Iniciante' },
      update: {},
    });

    const [first, second] = await Promise.all([
      prisma.swimmingClass.create({
        data: { name: 'HTTP CI A ' + randomUUID(), categoryId: category.id },
      }),
      prisma.swimmingClass.create({
        data: { name: 'HTTP CI B ' + randomUUID(), categoryId: category.id },
      }),
    ]);
    classA = first.id;
    classB = second.id;

    const coach = await prisma.teacher.create({
      data: {
        name: 'Test Coach', status: 'Ativo', profileId: teacherProfileId,
      },
    });
    await prisma.classTeacher.create({
      data: { classId: classB, teacherId: coach.id },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('denies anonymous requests and denies teachers administrative access using real persisted roles', async () => {
    await request(app.getHttpServer()).get('/api/students').expect(401);
    await asTeacher(request(app.getHttpServer()).get('/api/parents')).expect(403);
    await asTeacher(request(app.getHttpServer()).get('/api/results')).expect(403);
    await asTeacher(request(app.getHttpServer()).get('/api/ex-students')).expect(403);
  });

  it('creates real guardian and student over HTTP with season and enrollment, then transfers atomically', async () => {
    const guardian = await asAdmin(request(app.getHttpServer()).post('/api/parents'))
      .send({
        name: 'CI Adult ' + randomUUID().slice(0, 8),
        phone: '(71) 99999-1111', email: 'ci.adult@example.invalid',
        profession: 'Profissional', address: 'CI test address',
        emergencyContact: 'CI Emergency', emergencyPhone: '(71) 98888-2222',
        childrenIds: [], status: 'Ativo',
      }).expect(201);
    parentId = guardian.body.data.id as string;

    const studentPayload = {
      name: 'CI Athlete ' + randomUUID().slice(0, 8),
      gender: 'Masculino', birthDate: '2017-04-12', level: 'Iniciante',
      parentId, classId: classA, phone: '(71) 99999-1111', status: 'Ativo',
      photo: null,
    };
    const created = await asAdmin(request(app.getHttpServer()).post('/api/students'))
      .send(studentPayload).expect(201);
    studentId = created.body.data.id as string;
    expect(created.body.data.parentId).toBe(parentId);
    expect(created.body.data.classId).toBe(classA);

    const stored = await prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { guardians: true, seasonCategories: true, studentClasses: true },
    });
    expect(stored.guardians).toHaveLength(1);
    expect(stored.guardians[0].isPrimary).toBe(true);
    expect(stored.seasonCategories).toHaveLength(1);
    expect(stored.studentClasses).toHaveLength(1);

    const updated = await asAdmin(
      request(app.getHttpServer()).put('/api/students/' + studentId),
    ).send({ ...studentPayload, classId: classB, name: 'CI Athlete transferred' })
      .expect(200);
    expect(updated.body.data.classId).toBe(classB);

    const links = await prisma.studentClass.findMany({
      where: { studentId }, orderBy: { createdAt: 'asc' },
    });
    expect(links).toHaveLength(2);
    expect(links.filter((link) => link.isPrimary && link.toDate === null))
      .toHaveLength(1);
    expect(links.find((link) => link.classId === classA)?.toDate).not.toBeNull();

    const invalid = await asAdmin(request(app.getHttpServer())
      .put('/api/students/' + studentId))
      .send({ ...studentPayload, classId: classA, parentId: unknownGuardianId })
      .expect(409);
    expect(invalid.text).not.toContain('FOREIGN KEY');
    const afterFailedChange = await prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { guardians: true, studentClasses: { where: { toDate: null } } },
    });
    expect(afterFailedChange.name).toBe('CI Athlete transferred');
    expect(afterFailedChange.guardians.find((link) => link.isPrimary)?.parentId).toBe(parentId);
    expect(afterFailedChange.studentClasses[0].classId).toBe(classB);
  });

  it('respects scoped teacher access and persists attendance via real PostgreSQL', async () => {
    const visible = await asTeacher(
      request(app.getHttpServer()).get('/api/students?search=CI%20Athlete%20transferred'),
    ).expect(200);
    expect(visible.body.data.some((row: { id: string }) => row.id === studentId)).toBe(true);

    await asTeacher(request(app.getHttpServer())
      .get('/api/attendance?classId=' + classA)).expect(403);

    await asTeacher(request(app.getHttpServer())
      .post('/api/attendance'))
      .send({
        records: [{
          studentId, classId: classB, date: '2026-10-19',
          status: 'present', observations: 'CI attendance',
        }],
      }).expect(201);

    const saved = await prisma.attendanceRecord.findUnique({
      where: { studentId_classId_date: {
        studentId, classId: classB, date: new Date('2026-10-19'),
      } },
    });
    expect(saved?.status).toBe('present');

    const visibleAttendance = await asTeacher(request(app.getHttpServer())
      .get('/api/attendance?classId=' + classB)).expect(200);
    expect(visibleAttendance.body.data.some((row: { studentId: string }) =>
      row.studentId === studentId)).toBe(true);
  });

  it('creates separate pool and open-water results using real HTTP contracts and database tables', async () => {
    const pool = await asAdmin(request(app.getHttpServer()).post('/api/results'))
      .send({
        studentId, discipline: 'Piscina', competitionType: 'Piscina',
        courseType: 'Piscina Curta', eventFormat: 'Prova Individual',
        style: 'Livre', distance: '100m', time: '1:22.10',
        date: '2026-10-19', competition: 'CI Pool Meet',
        category: 'Mirim 1', resultStatus: 'Classificado',
      }).expect(201);
    expect(pool.body.data.discipline).toBe('Piscina');

    const openWater = await asAdmin(request(app.getHttpServer()).post('/api/results'))
      .send({
        studentId, discipline: 'Aguas Abertas',
        competitionType: 'Aguas Abertas', courseType: 'Mar',
        eventFormat: 'Travessia', style: 'Livre', distance: '1500m',
        time: '29:00.00', date: '2026-10-19',
        competition: 'CI Ocean Swim', category: 'Mirim 1',
        resultStatus: 'Classificado',
      }).expect(201);
    expect(openWater.body.data.discipline).toBe('Aguas Abertas');
    expect(await prisma.poolResult.count({ where: { studentId } })).toBe(1);
    expect(await prisma.openWaterResult.count({ where: { studentId } })).toBe(1);

    const rows = await asAdmin(request(app.getHttpServer())
      .get('/api/results?studentId=' + studentId)).expect(200);
    expect(rows.body.meta.total).toBe(2);

    await asAdmin(request(app.getHttpServer()).post('/api/results'))
      .send({
        studentId, discipline: 'Piscina', competitionType: 'Piscina',
        courseType: 'Piscina Curta', eventFormat: 'Prova Individual',
        style: 'Livre', distance: '100m', time: '',
        date: '2026-10-19', resultStatus: 'Classificado',
      }).expect(400);
    expect(await prisma.poolResult.count({ where: { studentId } })).toBe(1);
  });

  it('preserves departure history across admin archiving/reactivation over HTTP', async () => {
    const archived = await asAdmin(request(app.getHttpServer()).post('/api/ex-students'))
      .send({
        studentId, exitDate: '2026-10-19', exitReason: 'Falta de tempo',
      }).expect(201);
    const departureId = archived.body.data.id as string;
    expect(await prisma.student.findUnique({
      where: { id: studentId }, select: { status: true },
    })).toMatchObject({ status: 'Inativo' });

    const reopened = await asAdmin(request(app.getHttpServer())
      .post('/api/ex-students/' + departureId + '/reactivate'))
      .send({ id: departureId }).expect(201);
    expect(reopened.body.data.reactivatedAt).toBeTruthy();

    expect(await prisma.exStudent.count({
      where: { studentId, reactivatedAt: { not: null } },
    })).toBe(1);
    const historical = await asAdmin(request(app.getHttpServer())
      .get('/api/ex-students?studentId=' + studentId + '&includeHistory=true'))
      .expect(200);
    expect(historical.body.data).toHaveLength(1);
    const current = await asAdmin(request(app.getHttpServer())
      .get('/api/ex-students?studentId=' + studentId)).expect(200);
    expect(current.body.data).toHaveLength(0);

    // Recorded competition results cannot silently disappear via deletion.
    await asAdmin(request(app.getHttpServer())
      .delete('/api/students/' + studentId)).expect(409);
    expect(await prisma.student.count({ where: { id: studentId } })).toBe(1);
  });
});

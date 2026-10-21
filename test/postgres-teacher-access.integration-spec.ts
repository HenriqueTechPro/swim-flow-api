import { randomUUID } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.factory';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { AuthSessionManager } from '@/domain/auth/application/repositories/auth-session-manager';
import { PrismaService } from '@/infra/database/prisma/prisma.service';

// Two independent, mandatory protections: environment opt-in AND local URL.
// Never use this test on Neon, Supabase, staging or a database with real students.
function assertDisposableDatabase() {
  if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes' ||
      process.env.NODE_ENV === 'production') {
    throw new Error('Teacher-access integration requires a disposable local PostgreSQL database');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    try {
      const url = new URL(process.env[key]);
      if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
          url.pathname !== '/swimflow') throw new Error('Unexpected database');
    } catch {
      throw new Error('Refusing nonlocal or unexpected database URL: ' + key);
    }
  }
}

describe('Teacher account lifecycle: HTTP + real NestJS/Prisma + disposable PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const adminId = randomUUID();
  const teacherProfileId = randomUUID();
  const otherTeacherProfileId = randomUUID();
  const ordinaryProfileId = randomUUID();
  const nonexistentProfileId = randomUUID();
  const nonexistentTeacherId = randomUUID();
  const invitations: Array<{ email: string; role: string; redirectTo: string }> = [];
  let teacherId: string;
  let otherTeacherId: string;
  let inactiveTeacherId: string;
  let assignedClassId: string;
  let unassignedClassId: string;
  let studentId: string;
  let search: string;
  const attendanceDate = '2026-10-20';

  // Authentication token verification is the ONLY auth layer substituted.
  // RolesGuard, PermissionsGuard, TeacherAttendanceScopeGuard, repositories,
  // Prisma transactions, and PostgreSQL constraints remain real.
  const asAdmin = (req: request.Test) => req.set('Authorization', 'Bearer test-admin');
  const asTeacher = (req: request.Test) => req.set('Authorization', 'Bearer test-teacher');
  const asUser = (req: request.Test) => req.set('Authorization', 'Bearer test-user');

  beforeAll(async () => {
    assertDisposableDatabase();
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; email: string; sessionId: string };
          }>();
          const auth = req.headers.authorization;
          const id = auth === 'Bearer test-admin' ? adminId :
            auth === 'Bearer test-teacher' ? teacherProfileId :
              auth === 'Bearer test-user' ? ordinaryProfileId : null;
          if (!id) throw new UnauthorizedException('Bearer token required');
          req.user = { id, email: 'ci@example.invalid', sessionId: 'teacher-ci' };
          return true;
        },
      })
      // Supabase invitation delivery is NOT called. The real HTTP endpoint,
      // Zod validation, persisted admin role/permission and use case execute.
      .overrideProvider(AuthSessionManager)
      .useValue({
        async inviteUser(input: { email: string; role: string; redirectTo: string }) {
          invitations.push({
            email: input.email, role: input.role, redirectTo: input.redirectTo,
          });
        },
      });

    const moduleFixture = await builder.compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.profile.createMany({
      data: [
        { id: adminId, role: 'admin', fullName: 'CI Admin' },
        { id: teacherProfileId, role: 'teacher', fullName: 'CI Invited Coach' },
        { id: otherTeacherProfileId, role: 'teacher', fullName: 'CI Other Coach' },
        { id: ordinaryProfileId, role: 'user', fullName: 'CI Ordinary User' },
      ],
    });

    // The invited/accepted identity is represented by a fresh local
    // Profile row. The test cannot assert a real Supabase invitation.
    const category = await prisma.category.upsert({
      where: { name: 'Mirim_1' },
      update: {},
      create: { name: 'Mirim_1' },
    });
    await prisma.level.upsert({
      where: { name: 'Iniciante' },
      update: {},
      create: { name: 'Iniciante' },
    });

    // The initial migration permits one active season. Reuse 2026 when the
    // other disposable integration suite has already created it.
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
          year: 2026, label: 'Disposable teacher-access CI season',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'), status: 'ACTIVE',
        },
      });
    }

    const [assigned, unassigned] = await Promise.all([
      prisma.swimmingClass.create({
        data: { name: 'Scoped class ' + randomUUID(), categoryId: category.id },
      }),
      prisma.swimmingClass.create({
        data: { name: 'Other class ' + randomUUID(), categoryId: category.id },
      }),
    ]);
    assignedClassId = assigned.id;
    unassignedClassId = unassigned.id;

    const [coach, anotherCoach, inactiveCoach] = await Promise.all([
      prisma.teacher.create({ data: { name: 'CI Primary Coach', status: 'Ativo' } }),
      prisma.teacher.create({
        data: { name: 'CI Other Coach', status: 'Ativo', profileId: otherTeacherProfileId },
      }),
      prisma.teacher.create({ data: { name: 'CI Inactive Coach', status: 'Inativo' } }),
    ]);
    teacherId = coach.id;
    otherTeacherId = anotherCoach.id;
    inactiveTeacherId = inactiveCoach.id;
    await prisma.classTeacher.create({ data: { classId: assignedClassId, teacherId } });

    const parent = await asAdmin(request(app.getHttpServer()).post('/api/parents'))
      .send({
        name: 'CI Guardian ' + randomUUID().slice(0, 8),
        phone: '(71) 99999-1111', email: 'ci-guardian-' + randomUUID() + '@example.invalid',
        profession: 'Test', address: 'Local CI', emergencyContact: 'CI Emergency',
        emergencyPhone: '(71) 98888-2222', childrenIds: [], status: 'Ativo',
      }).expect(201);
    search = 'CI Scoped Athlete ' + randomUUID().slice(0, 8);
    const created = await asAdmin(request(app.getHttpServer()).post('/api/students'))
      .send({
        name: search, gender: 'Masculino', birthDate: '2017-04-12',
        level: 'Iniciante', parentId: parent.body.data.id,
        classId: assignedClassId, phone: '(71) 99999-1111', status: 'Ativo',
        photo: null,
      }).expect(201);
    studentId = created.body.data.id as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('guards invitation HTTP by real persisted admin role and validates its payload', async () => {
    const invitation = {
      email: 'new-ci-coach@example.invalid',
      fullName: 'A New CI Coach',
      role: 'teacher',
      redirectTo: 'https://example.invalid/reset-password',
    };

    await request(app.getHttpServer()).post('/api/auth/invitations')
      .send(invitation).expect(401);
    await asTeacher(request(app.getHttpServer()).post('/api/auth/invitations'))
      .send(invitation).expect(403);
    await asUser(request(app.getHttpServer()).post('/api/auth/invitations'))
      .send(invitation).expect(403);
    await asAdmin(request(app.getHttpServer()).post('/api/auth/invitations'))
      .send({ ...invitation, email: 'bad-email' }).expect(400);
    expect(invitations).toHaveLength(0);

    const allowed = await asAdmin(request(app.getHttpServer())
      .post('/api/auth/invitations')).send(invitation).expect(201);
    expect(allowed.body.data).toEqual({ success: true });
    expect(invitations).toEqual([{
      email: invitation.email, role: 'teacher', redirectTo: invitation.redirectTo,
    }]);
  });

  it('denies account management to non-admins, invalid payloads and conflicting identities', async () => {
    const endpoint = '/api/teachers/' + teacherId + '/account';
    await request(app.getHttpServer()).get(endpoint).expect(401);
    await asTeacher(request(app.getHttpServer()).get(endpoint)).expect(403);
    await asTeacher(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: teacherProfileId }).expect(403);
    await asTeacher(request(app.getHttpServer()).delete(endpoint)).expect(403);
    await asUser(request(app.getHttpServer()).get(endpoint)).expect(403);
    await asUser(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: teacherProfileId }).expect(403);
    await asUser(request(app.getHttpServer()).delete(endpoint)).expect(403);

    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: teacherProfileId, role: 'admin' }).expect(400);
    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: 'not-a-uuid' }).expect(400);
    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: ordinaryProfileId }).expect(422);
    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: nonexistentProfileId }).expect(404);
    await asAdmin(request(app.getHttpServer())
      .put('/api/teachers/' + inactiveTeacherId + '/account'))
      .send({ profileId: teacherProfileId }).expect(409);
    await asAdmin(request(app.getHttpServer())
      .put('/api/teachers/' + nonexistentTeacherId + '/account'))
      .send({ profileId: teacherProfileId }).expect(404);
    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: otherTeacherProfileId }).expect(409);

    expect(await prisma.teacher.findUnique({
      where: { id: teacherId }, select: { profileId: true },
    })).toEqual({ profileId: null });
    expect(await prisma.teacherAccountLinkEvent.count({
      where: { teacherId },
    })).toBe(0);
    expect(await prisma.teacher.findUnique({
      where: { id: otherTeacherId }, select: { profileId: true },
    })).toEqual({ profileId: otherTeacherProfileId });
  });

  it('enforces teacher scope before linking, grants only assigned-class access, then revokes via HTTP', async () => {
    const endpoint = '/api/teachers/' + teacherId + '/account';
    const searchUrl = '/api/students?search=' + encodeURIComponent(search);
    const attendanceUrl = '/api/attendance?classId=' + assignedClassId;
    const attendanceRecord = {
      studentId, classId: assignedClassId, date: attendanceDate,
      status: 'present', observations: 'CI scope verification',
    };

    const before = await asTeacher(request(app.getHttpServer()).get(searchUrl)).expect(200);
    expect(before.body.data.some((s: { id: string }) => s.id === studentId)).toBe(false);
    const beforeClasses = await asTeacher(request(app.getHttpServer()).get('/api/classes')).expect(200);
    expect(beforeClasses.body.data.some((c: { id: string }) => c.id === assignedClassId)).toBe(false);
    await asTeacher(request(app.getHttpServer()).get(attendanceUrl)).expect(403);

    const current = await asAdmin(request(app.getHttpServer()).get(endpoint)).expect(200);
    expect(current.body.data).toEqual({ teacherId, profileId: null });

    const linked = await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: teacherProfileId }).expect(200);
    expect(linked.body.data).toEqual({ teacherId, profileId: teacherProfileId });
    await asAdmin(request(app.getHttpServer()).put(endpoint))
      .send({ profileId: teacherProfileId }).expect(200);
    const verified = await asAdmin(request(app.getHttpServer()).get(endpoint)).expect(200);
    expect(verified.body.data.profileId).toBe(teacherProfileId);
    expect(await prisma.teacherAccountLinkEvent.count({
      where: { teacherId, action: 'LINK' },
    })).toBe(1);

    const classes = await asTeacher(request(app.getHttpServer()).get('/api/classes')).expect(200);
    expect(classes.body.data.some((c: { id: string }) => c.id === assignedClassId)).toBe(true);
    expect(classes.body.data.some((c: { id: string }) => c.id === unassignedClassId)).toBe(false);
    const students = await asTeacher(request(app.getHttpServer()).get(searchUrl)).expect(200);
    expect(students.body.data.some((s: { id: string }) => s.id === studentId)).toBe(true);
    await asTeacher(request(app.getHttpServer())
      .get('/api/attendance?classId=' + unassignedClassId)).expect(403);
    await asTeacher(request(app.getHttpServer()).post('/api/attendance'))
      .send({ records: [{ ...attendanceRecord, classId: unassignedClassId }] }).expect(403);
    await asTeacher(request(app.getHttpServer()).post('/api/attendance'))
      .send({ records: [attendanceRecord] }).expect(201);
    const attendance = await asTeacher(request(app.getHttpServer()).get(attendanceUrl)).expect(200);
    expect(attendance.body.data.some(
      (r: { studentId: string; classId: string }) =>
        r.studentId === studentId && r.classId === assignedClassId,
    )).toBe(true);
    await asTeacher(request(app.getHttpServer())
      .get('/api/attendance/summary?classId=' + assignedClassId)).expect(200);

    const revoked = await asAdmin(request(app.getHttpServer()).delete(endpoint)).expect(200);
    expect(revoked.body.data).toEqual({ teacherId, profileId: null });
    await asAdmin(request(app.getHttpServer()).delete(endpoint)).expect(200);
    const unlinked = await asAdmin(request(app.getHttpServer()).get(endpoint)).expect(200);
    expect(unlinked.body.data.profileId).toBeNull();

    const after = await asTeacher(request(app.getHttpServer()).get(searchUrl)).expect(200);
    expect(after.body.data.some((s: { id: string }) => s.id === studentId)).toBe(false);
    const afterClasses = await asTeacher(request(app.getHttpServer()).get('/api/classes')).expect(200);
    expect(afterClasses.body.data.some((c: { id: string }) => c.id === assignedClassId)).toBe(false);
    await asTeacher(request(app.getHttpServer()).get(attendanceUrl)).expect(403);
    await asTeacher(request(app.getHttpServer())
      .get('/api/attendance/summary?classId=' + assignedClassId)).expect(403);
    await asTeacher(request(app.getHttpServer()).post('/api/attendance'))
      .send({ records: [attendanceRecord] }).expect(403);

    const events = await prisma.teacherAccountLinkEvent.findMany({
      where: { teacherId }, orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.action)).toEqual(['LINK', 'UNLINK']);
    expect(events.every((event) => event.actorProfileId === adminId)).toBe(true);
    expect(events.every((event) => event.profileId === teacherProfileId)).toBe(true);
    const persisted = await prisma.attendanceRecord.findUnique({
      where: {
        studentId_classId_date: {
          studentId, classId: assignedClassId, date: new Date(attendanceDate),
        },
      },
    });
    expect(persisted?.status).toBe('present');
    // Revoking access does not delete the account profile.
    expect(await prisma.profile.count({ where: { id: teacherProfileId } })).toBe(1);
  });
});

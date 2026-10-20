import { UnauthorizedException, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { createE2EApp } from '../utils/create-e2e-app';

const ADMIN = 'ab000000-0000-4000-8000-000000000001';
const COACH = 'ab000000-0000-4000-8000-000000000002';
const date = (iso: string) => new Date(iso + 'T00:00:00.000Z');

const admin = (app: INestApplication<App>) =>
  request(app.getHttpServer()).get('/api/students').set('Authorization', 'Bearer admin');
const asAdmin = (req: request.Test) => req.set('Authorization', 'Bearer admin');
const asTeacher = (req: request.Test) => req.set('Authorization', 'Bearer teacher');

describe('Swim Flow: actual NestJS -> Prisma -> disposable PostgreSQL', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let categoryId: string;
  let levelId: string;
  let seasonId: string;
  let parentA: string;
  let parentB: string;
  let classA: string;
  let classB: string;
  let teacherId: string;
  let studentId: string;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    const isolated = process.env.SWIM_FLOW_TEST_DB === 'true';
    const hostOK = ['localhost', '127.0.0.1'].includes(url.hostname);
    const nameOK = url.pathname === '/swimflow';
    if (!isolated || !hostOK || !nameOK || process.env.NODE_ENV === 'production') {
      throw new Error('Refusing DB integration test outside isolated local PostgreSQL');
    }
    prisma = new PrismaClient();
    await prisma.$connect();
    // CI owns a brand-new database. Do not clear or truncate other environments.
    await prisma.profile.createMany({
      data: [
        { id: ADMIN, fullName: 'CI administrator', role: 'admin' },
        { id: COACH, fullName: 'CI coach', role: 'teacher' },
      ],
    });
    const category = await prisma.category.create({ data: { name: 'Mirim_1' } });
    const level = await prisma.level.create({ data: { name: 'Iniciante' } });
    const season = await prisma.season.create({
      data: {
        year: 2027, label: 'CI Season 2027',
        startsOn: date('2027-01-01'), endsOn: date('2027-12-31'), status: 'ACTIVE',
      },
    });
    categoryId = category.id;
    levelId = level.id;
    seasonId = season.id;

    const [a, b] = await Promise.all([
      prisma.parent.create({ data: { name: 'Adult A' } }),
      prisma.parent.create({ data: { name: 'Adult B' } }),
    ]);
    parentA = a.id;
    parentB = b.id;
    const pool = await prisma.pool.create({ data: { name: 'Disposable 25m', lengthMeters: 25 } });
    const [aClass, bClass] = await Promise.all([
      prisma.swimmingClass.create({ data: {
        name: 'CI Group A', categoryId, poolId: pool.id,
      } }),
      prisma.swimmingClass.create({ data: {
        name: 'CI Group B', categoryId, poolId: pool.id,
      } }),
    ]);
    classA = aClass.id;
    classB = bClass.id;
    const teacher = await prisma.teacher.create({
      data: { name: 'CI swim coach', profileId: COACH },
    });
    teacherId = teacher.id;
    await prisma.classTeacher.create({
      data: { teacherId, classId: classA, role: 'head_coach' },
    });

    app = await createE2EApp(builder => builder
      // JWT signature only is simulated: both role and permission checks
      // query the actual Profile in disposable PostgreSQL.
      .overrideGuard(JwtAuthGuard).useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; email: string; sessionId: string };
          }>();
          const bearer = req.headers.authorization;
          const userId = bearer === 'Bearer admin'
            ? ADMIN : bearer === 'Bearer teacher' ? COACH : null;
          if (!userId) throw new UnauthorizedException();
          req.user = { id: userId, email: 'ci@example.invalid', sessionId: 'ci' };
          return true;
        },
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('persists a student, current class, guardian and season category through HTTP', async () => {
    const response = await asAdmin(request(app.getHttpServer()).post('/api/students'))
      .send({
        name: 'CI Swimmer A', gender: 'Feminino', birthDate: '2018-03-10',
        level: 'Iniciante', parentId: parentA, classId: classA,
        status: 'Ativo', phone: '(71) 99999-0000',
      }).expect(201);
    studentId = response.body.data.id;
    expect(studentId).toEqual(expect.any(String));

    const [student, seasonHistory, guardian, enrollment] = await Promise.all([
      prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
      prisma.studentSeasonCategory.findUniqueOrThrow({
        where: { studentId_seasonId: { studentId, seasonId } },
      }),
      prisma.studentGuardian.findUniqueOrThrow({
        where: { studentId_parentId: { studentId, parentId: parentA } },
      }),
      prisma.studentClass.findFirstOrThrow({
        where: { studentId, classId: classA, toDate: null },
      }),
    ]);
    expect(student.categoryId).toBe(categoryId);
    expect(student.levelId).toBe(levelId);
    expect(seasonHistory.categoryId).toBe(categoryId);
    expect(guardian.isPrimary).toBe(true);
    expect(enrollment.isPrimary).toBe(true);

    const teacherVisible = await asTeacher(request(app.getHttpServer()).get('/api/students'))
      .expect(200);
    expect(teacherVisible.body.data.map((x: {id:string})=>x.id)).toContain(studentId);
    const anonymous = await request(app.getHttpServer()).get('/api/students').expect(401);
    expect(anonymous.text).not.toContain('CI Swimmer A');
  });

  it('transfers classes and changes principal without losing the other guardian', async () => {
    await prisma.studentGuardian.create({
      data: { studentId, parentId: parentB, isPrimary: false },
    });
    await asAdmin(request(app.getHttpServer()).put('/api/students/' + studentId))
      .send({
        name: 'CI Swimmer A', gender: 'Feminino', birthDate: '2018-03-10',
        level: 'Iniciante', parentId: parentB, classId: classB,
        status: 'Ativo', phone: '(71) 99999-0000',
      }).expect(200);
    const guardianLinks = await prisma.studentGuardian.findMany({
      where: { studentId }, orderBy: { parentId: 'asc' },
    });
    expect(guardianLinks).toHaveLength(2);
    expect(guardianLinks.find((x) => x.parentId === parentB)?.isPrimary).toBe(true);
    expect(guardianLinks.find((x) => x.parentId === parentA)?.isPrimary).toBe(false);
    const enrollments = await prisma.studentClass.findMany({ where: { studentId } });
    expect(enrollments).toHaveLength(2);
    expect(enrollments.find((x) => x.classId === classA)?.toDate).not.toBeNull();
    expect(enrollments.find((x) => x.classId === classB)?.isPrimary).toBe(true);

    // The class-A coach immediately loses visibility of the transferred swimmer.
    const scoped = await asTeacher(request(app.getHttpServer()).get('/api/students'))
      .expect(200);
    expect(scoped.body.data.map((x:{id:string})=>x.id)).not.toContain(studentId);
    await asTeacher(request(app.getHttpServer()).post('/api/attendance'))
      .send({ records: [{ studentId, classId: classB, date: '2026-10-01', status: 'present' }] })
      .expect(403);
  });

  it('persists attendance through the use-case and enforces one record per date', async () => {
    const data = { records: [{
      studentId, classId: classB, date: '2026-10-01', status: 'present',
    }] };
    await asAdmin(request(app.getHttpServer()).post('/api/attendance'))
      .send(data).expect(201);
    await asAdmin(request(app.getHttpServer()).post('/api/attendance'))
      .send({records:[{...data.records[0], status:'late'}]}).expect(201);
    const rows = await prisma.attendanceRecord.findMany({ where: { studentId, classId: classB } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('late');
    await expect(prisma.studentClass.create({ data: {
      studentId, classId: classB, isPrimary: true,
    } })).rejects.toThrow();
  });

  it('separates pool and open-water results into typed relational tables', async () => {
    const base = {
      studentId, style: 'Livre', date: '2026-09-19',
      position: 1, resultStatus: 'Classificado',
      competition: 'CI Competition', category: 'Mirim 1',
    };
    await asAdmin(request(app.getHttpServer()).post('/api/results'))
      .send({
        ...base, discipline: 'Piscina', competitionType: 'Piscina',
        courseType: 'Piscina Curta', distance: '50m',
        eventFormat: 'Prova Individual', time: '00:32.45',
      }).expect(201);
    await asAdmin(request(app.getHttpServer()).post('/api/results'))
      .send({
        ...base, discipline: 'Aguas Abertas', competitionType: 'Aguas Abertas',
        courseType: 'Mar', distance: '1500m', routeKey: 'ci-marine-route',
        eventFormat: 'Travessia', time: '25:30.00',
      }).expect(201);

    const [pool, water] = await Promise.all([
      prisma.poolResult.findMany({where:{studentId}}),
      prisma.openWaterResult.findMany({where:{studentId}}),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({
      distanceMeters: 50, durationMs: 32450, status: 'CLASSIFIED',
    });
    expect(water).toHaveLength(1);
    expect(water[0]).toMatchObject({
      distanceMeters: 1500, durationMs: 1530000, bodyType: 'SEA',
      routeKey: 'ci-marine-route',
    });
    await expect(prisma.poolResult.create({ data: {
      studentId, heldOn: date('2026-09-19'), distanceMeters: -1,
      style: 'Livre', status: 'CLASSIFIED', durationMs: 1000,
    } })).rejects.toThrow();
  });

  it('stores optional anthropometry and rejects negative measures', async () => {
    const assessment = await prisma.anthropometricAssessment.create({
      data: {
        studentId, measuredOn: date('2026-10-05'),
        heightCm: '138.50', armSpanCm: '140.25',
        bodyMassKg: '34.80', footLengthCm: null, legLengthCm: null,
        assessorTeacherId: teacherId,
      },
    });
    expect(assessment.heightCm?.toNumber()).toBe(138.5);
    expect(assessment.footLengthCm).toBeNull();
    expect(assessment.legLengthCm).toBeNull();
    await expect(prisma.anthropometricAssessment.create({ data: {
      studentId, measuredOn: date('2026-10-06'), heightCm: '-1',
    } })).rejects.toThrow();
  });

  it('enforces assessment criterion/template integrity across different templates', async () => {
    const [first, second] = await Promise.all([
      prisma.technicalAssessmentTemplate.create({data:{name:'CI freestyle technique',version:1}}),
      prisma.technicalAssessmentTemplate.create({data:{name:'CI breaststroke technique',version:1}}),
    ]);
    const [firstCriterion, foreignCriterion] = await Promise.all([
      prisma.technicalAssessmentCriterion.create({data:{
        templateId:first.id,code:'STREAMLINE',name:'Body streamline',style:'Livre',
      }}),
      prisma.technicalAssessmentCriterion.create({data:{
        templateId:second.id,code:'KICK',name:'Kick',style:'Peito',
      }}),
    ]);
    const attempt = await prisma.studentTechnicalAssessment.create({data:{
      studentId,templateId:first.id,assessedOn:date('2026-10-07'),
      assessorTeacherId: teacherId,
    }});
    await prisma.technicalAssessmentScore.create({data:{
      assessmentId:attempt.id,templateId:first.id,criterionId:firstCriterion.id,score:'4',
    }});
    await expect(prisma.technicalAssessmentScore.create({data:{
      assessmentId:attempt.id,templateId:first.id,criterionId:foreignCriterion.id,score:'5',
    }})).rejects.toThrow();
    expect(await prisma.technicalAssessmentScore.count({where:{assessmentId:attempt.id}})).toBe(1);
  });

  it('retains departure history after reactivation with results preserved', async () => {
    const archived = await asAdmin(request(app.getHttpServer()).post('/api/ex-students'))
      .send({studentId,exitDate:'2026-10-10',exitReason:'Falta de tempo'})
      .expect(201);
    expect((await prisma.student.findUniqueOrThrow({where:{id:studentId}})).status).toBe('Inativo');
    await asAdmin(request(app.getHttpServer()).post(
      '/api/ex-students/' + archived.body.data.id + '/reactivate',
    )).send({id:archived.body.data.id}).expect(201);
    expect((await prisma.student.findUniqueOrThrow({where:{id:studentId}})).status).toBe('Ativo');
    const historical = await prisma.exStudent.findUniqueOrThrow({where:{id:archived.body.data.id}});
    expect(historical.reactivatedAt).not.toBeNull();
    expect(await prisma.poolResult.count({where:{studentId}})).toBe(1);
    expect(await prisma.openWaterResult.count({where:{studentId}})).toBe(1);
    const visibleHistory = await asAdmin(request(app.getHttpServer())
      .get('/api/ex-students?includeHistory=true&studentId=' + studentId)).expect(200);
    expect(visibleHistory.body.data).toHaveLength(1);
  });
});

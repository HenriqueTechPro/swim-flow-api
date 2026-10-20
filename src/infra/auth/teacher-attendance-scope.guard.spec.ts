import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { TeacherAttendanceScopeGuard } from './teacher-attendance-scope.guard';
import type { PrismaService } from '@/infra/database/prisma/prisma.service';

const profileId = '11111111-1111-4111-8111-111111111111';
const ownClass = '22222222-2222-4222-8222-222222222222';
const otherClass = '33333333-3333-4333-8333-333333333333';
const ownStudent = '44444444-4444-4444-8444-444444444444';
const otherStudent = '55555555-5555-4555-8555-555555555555';

describe('TeacherAttendanceScopeGuard', () => {
  const prisma = {
    classTeacher: { findMany: jest.fn() },
    studentClass: { findMany: jest.fn() },
  };
  const guard = new TeacherAttendanceScopeGuard(prisma as unknown as PrismaService);
  const context = (overrides: Record<string, unknown> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: profileId, role: 'teacher' },
        method: 'GET',
        query: { classId: ownClass },
        body: {},
        ...overrides,
      }),
    }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.classTeacher.findMany.mockResolvedValue([{ classId: ownClass }]);
    prisma.studentClass.findMany.mockResolvedValue([
      { classId: ownClass, studentId: ownStudent },
    ]);
  });

  it('allows an assigned teacher to read a single authorized class', async () => {
    expect(await guard.canActivate(context())).toBe(true);
    expect(prisma.classTeacher.findMany).toHaveBeenCalledWith({
      where: {
        classId: { in: [ownClass] },
        teacher: { profileId, status: 'Ativo' },
      },
      select: { classId: true },
    });
  });

  it('fails closed when teacher account is not linked to a class', async () => {
    prisma.classTeacher.findMany.mockResolvedValue([]);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies unfiltered global attendance requests', async () => {
    await expect(guard.canActivate(context({ query: {} }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.classTeacher.findMany).not.toHaveBeenCalled();
  });

  it('denies a student who is not currently in that class', async () => {
    await expect(guard.canActivate(context({
      query: { classId: ownClass, studentId: otherStudent },
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects mixed-class writes when even one class is outside the teacher scope', async () => {
    await expect(guard.canActivate(context({
      method: 'POST',
      body: { records: [
        { classId: ownClass, studentId: ownStudent },
        { classId: otherClass, studentId: otherStudent },
      ] },
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects attendance writes for transferred students', async () => {
    prisma.studentClass.findMany.mockResolvedValue([]);
    await expect(guard.canActivate(context({
      method: 'POST',
      body: { records: [{ classId: ownClass, studentId: ownStudent }] },
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows authorized active attendance submission', async () => {
    expect(await guard.canActivate(context({
      method: 'POST',
      body: { records: [{ classId: ownClass, studentId: ownStudent }] },
    }))).toBe(true);
  });

  it('never trusts a teacher account without a user id', async () => {
    await expect(guard.canActivate(context({
      user: { role: 'teacher' },
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not restrict admin operations or query Prisma', async () => {
    expect(await guard.canActivate(context({
      user: { id: profileId, role: 'admin' }, query: {},
    }))).toBe(true);
    expect(prisma.classTeacher.findMany).not.toHaveBeenCalled();
  });
});

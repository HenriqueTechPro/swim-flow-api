import type { PrismaService } from '../prisma.service';
import { PrismaPrivateMediaAccessRepository } from './prisma-private-media-access-repository';

const profile = '11111111-1111-4111-8111-111111111111';
const student = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';

describe('Private media ACL uses live class membership', () => {
  const prisma = {
    profile: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), findUnique: jest.fn() },
    teacher: { findFirst: jest.fn(), findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
  };
  const repository = new PrismaPrivateMediaAccessRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('limits a teacher to students currently enrolled in their classes', async () => {
    prisma.student.findFirst.mockResolvedValueOnce({ id: student }).mockResolvedValueOnce(null);
    const input = {
      actor: { id: profile, role: 'teacher' as const },
      operation: 'read' as const,
      target: 'student-photo' as const,
      resourceId: student,
    };
    expect(await repository.canAccess(input)).toBe(true);
    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: student,
        studentClasses: {
          some: {
            toDate: null,
            swimmingClass: {
              classTeachers: {
                some: { teacher: { profileId: profile, status: 'Ativo' } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    // Simulate a removed class link: next request must check the database again.
    expect(await repository.canAccess(input)).toBe(false);
    expect(prisma.student.findFirst).toHaveBeenCalledTimes(2);
  });

  it('denies a teacher photo belonging to another profile', async () => {
    prisma.teacher.findFirst.mockResolvedValue(null);
    expect(await repository.canAccess({
      actor: { id: profile, role: 'teacher' },
      operation: 'write',
      target: 'teacher-photo',
      resourceId: other,
    })).toBe(false);
    expect(prisma.teacher.findFirst).toHaveBeenCalledWith({
      where: { id: other, profileId: profile, status: 'Ativo' },
      select: { id: true },
    });
  });

  it('never reveals parent images or writes to arbitrary avatars for teachers', async () => {
    const actor = { id: profile, role: 'teacher' as const };
    expect(await repository.canAccess({
      actor, operation: 'read', target: 'parent-photo', resourceId: other,
    })).toBe(false);
    expect(await repository.canAccess({
      actor, operation: 'write', target: 'profile-avatar', resourceId: other,
    })).toBe(false);
    expect(prisma.parent.findUnique).not.toHaveBeenCalled();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });

  it('allows only a currently existing self-avatar for regular users', async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: profile });
    const actor = { id: profile, role: 'user' as const };
    expect(await repository.canAccess({
      actor, operation: 'write', target: 'profile-avatar', resourceId: profile,
    })).toBe(true);
    expect(await repository.canAccess({
      actor, operation: 'write', target: 'student-photo', resourceId: student,
    })).toBe(false);
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('admin can use existing resources but not phantom resources', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({ id: student }).mockResolvedValueOnce(null);
    const input = {
      actor: { id: profile, role: 'admin' as const },
      operation: 'write' as const,
      target: 'student-photo' as const,
      resourceId: student,
    };
    expect(await repository.canAccess(input)).toBe(true);
    expect(await repository.canAccess(input)).toBe(false);
    expect(prisma.student.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects absent role claims without touching any resource', async () => {
    expect(await repository.canAccess({
      actor: { id: profile, role: undefined },
      operation: 'read',
      target: 'profile-avatar',
      resourceId: profile,
    })).toBe(false);
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });
});

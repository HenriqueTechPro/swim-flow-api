import type { PrismaService } from './prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import { PrismaStudentsRepository } from './repositories/prisma-students-repository';
import { PrismaClassesRepository } from './repositories/prisma-classes-repository';
import { PrismaTeachersRepository } from './repositories/prisma-teachers-repository';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_PROFILE_ID = '22222222-2222-4222-8222-222222222222';

describe('02F-05C11 scoped detail repositories', () => {
  const prisma = {
    student: { findFirst: jest.fn() },
    swimmingClass: { findFirst: jest.fn() },
    teacher: { findUnique: jest.fn() },
  };
  const cache = {} as CacheRepository;
  const env = {} as EnvService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.swimmingClass.findFirst.mockResolvedValue(null);
    prisma.teacher.findUnique.mockResolvedValue(null);
  });

  it('requires a current teacher assignment inside the student SQL query', async () => {
    const repo = new PrismaStudentsRepository(prisma as unknown as PrismaService, cache, env);
    expect(await repo.findById(STUDENT_ID, TEACHER_PROFILE_ID)).toBeNull();
    expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: STUDENT_ID,
        studentClasses: { some: {
          toDate: null,
          swimmingClass: { classTeachers: { some: {
            teacher: { profileId: TEACHER_PROFILE_ID, status: 'Ativo' },
          } } },
        } },
      },
    }));
  });

  it('requires an active associated teacher in the class SQL query', async () => {
    const repo = new PrismaClassesRepository(prisma as unknown as PrismaService, cache, env);
    expect(await repo.findById(STUDENT_ID, TEACHER_PROFILE_ID)).toBeNull();
    expect(prisma.swimmingClass.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: STUDENT_ID,
        classTeachers: { some: {
          teacher: { profileId: TEACHER_PROFILE_ID, status: 'Ativo' },
        } },
      },
    }));
  });

  it('uses one indexed teacher lookup without listing all teachers', async () => {
    const repo = new PrismaTeachersRepository(prisma as unknown as PrismaService, cache, env);
    expect(await repo.findById(STUDENT_ID)).toBeNull();
    expect(prisma.teacher.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: STUDENT_ID },
    }));
  });
});

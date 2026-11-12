import type { PrismaService } from '../prisma.service';
import {
  listStudentPhysicalAssessmentsQuerySchema,
} from '@/shared/contracts/student-physical-assessments';
import {
  PrismaStudentPhysicalAssessmentsRepository,
} from './prisma-student-physical-assessments-repository';

describe('student physical assessment history (read only)', () => {
  const studentId = '11111111-1111-4111-8111-111111111111';
  const prisma = {
    student: { findUnique: jest.fn() },
    anthropometricAssessment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const repository = new PrismaStudentPhysicalAssessmentsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findUnique.mockResolvedValue({ id: studentId });
    prisma.anthropometricAssessment.findMany.mockResolvedValue([]);
    prisma.anthropometricAssessment.count.mockResolvedValue(125);
  });

  it('keeps the legacy GET limited to the 50 latest records', async () => {
    expect(await repository.list(studentId)).toEqual([]);
    expect(prisma.anthropometricAssessment.findMany).toHaveBeenCalledWith({
      where: { studentId },
      select: expect.any(Object),
      orderBy: [
        { measuredOn: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 50,
    });
    expect(prisma.anthropometricAssessment.count).not.toHaveBeenCalled();
  });

  it('retrieves pages beyond the initial 50 records', async () => {
    const page = await repository.listPage(studentId, { page: 6, perPage: 10 });
    expect(page).toMatchObject({ total: 125, page: 6, perPage: 10, items: [] });
    expect(prisma.anthropometricAssessment.findMany).toHaveBeenCalledWith({
      where: { studentId },
      select: expect.any(Object),
      orderBy: [
        { measuredOn: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: 50,
      take: 10,
    });
    expect(prisma.anthropometricAssessment.count).toHaveBeenCalledWith({
      where: { studentId },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('filters one calendar year using exclusive end', async () => {
    await repository.listPage(studentId, { year: 2026, page: 1, perPage: 20 });
    const where = {
      studentId,
      measuredOn: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lt: new Date('2027-01-01T00:00:00.000Z'),
      },
    };
    expect(prisma.anthropometricAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(prisma.anthropometricAssessment.count).toHaveBeenCalledWith({
      where,
    });
  });

  it('supports a bounded inclusive date interval', async () => {
    await repository.listPage(studentId, {
      from: '2025-12-01',
      to: '2026-03-15',
    });
    const where = {
      studentId,
      measuredOn: {
        gte: new Date('2025-12-01T00:00:00.000Z'),
        lte: new Date('2026-03-15T00:00:00.000Z'),
      },
    };
    expect(prisma.anthropometricAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 20 }),
    );
    expect(prisma.anthropometricAssessment.count).toHaveBeenCalledWith({
      where,
    });
  });

  it('rejects missing students without querying history', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    const request = repository.listPage(studentId, { page: 1 });
    await expect(request).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.anthropometricAssessment.findMany).not.toHaveBeenCalled();
    expect(prisma.anthropometricAssessment.count).not.toHaveBeenCalled();
  });

  it('rejects invalid pages, dates and conflicting filters', () => {
    const valid = listStudentPhysicalAssessmentsQuerySchema.safeParse({
      page: '2',
      perPage: '25',
      year: '2026',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toEqual({ page: 2, perPage: 25, year: 2026 });
    }
    const invalidQueries = [
      { page: '0' },
      { page: '1.5' },
      { perPage: '101' },
      { from: '2026-02-30' },
      { from: '2026-09-30', to: '2026-09-01' },
      { year: '2026', from: '2026-01-01' },
      { unwanted: 'field' },
    ];
    for (const query of invalidQueries) {
      expect(
        listStudentPhysicalAssessmentsQuerySchema.safeParse(query).success,
      ).toBe(false);
    }
  });
});

import type { PrismaService } from '../prisma.service';
import { PrismaResultSeasonsRepository } from './prisma-result-seasons-repository';

describe('2027 category rollover preview (read only)', () => {
  const source = {
    id: '88888888-8888-4888-8888-888888888888',
    year: 2026, label: '2026', status: 'ACTIVE',
    startsOn: new Date('2026-01-01T00:00:00.000Z'),
    endsOn: new Date('2026-12-31T00:00:00.000Z'),
  };
  const target = {
    ...source, id: '99999999-9999-4999-8999-999999999999',
    year: 2027, label: '2027', status: 'PLANNED',
  };
  const seasonLookup = jest.fn();
  const sourceLookup = jest.fn();
  const linksCount = jest.fn();
  const linksFind = jest.fn();
  const categoryFind = jest.fn();
  const poolFind = jest.fn();
  const openWaterFind = jest.fn();
  const prisma = {
    season: { findUnique: seasonLookup, findFirst: sourceLookup },
    studentSeasonCategory: { count: linksCount, findMany: linksFind },
    category: { findMany: categoryFind },
    poolResult: { findMany: poolFind },
    openWaterResult: { findMany: openWaterFind },
  };
  const repo = new PrismaResultSeasonsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    seasonLookup.mockResolvedValue(target);
    sourceLookup.mockResolvedValue(source);
    linksCount.mockResolvedValue(2);
    linksFind
      .mockResolvedValueOnce([
        {
          studentId: 'student-a',
          student: { name: 'Atleta A', birthDate: new Date('2019-05-01'), status: 'Ativo' },
          category: { id: 'old', name: 'Pre_Mirim' },
        },
        {
          studentId: 'student-b',
          student: { name: 'Atleta B', birthDate: null, status: 'Inativo' },
          category: { id: 'old', name: 'Pre_Mirim' },
        },
      ])
      .mockResolvedValueOnce([]);
    categoryFind.mockResolvedValue([{ id: 'm1', name: 'Mirim_1' }]);
    poolFind.mockResolvedValue([{ studentId: 'student-a' }]);
    openWaterFind.mockResolvedValue([]);
  });

  it('suggests Mirim 1 for birth year 2019 in 2027 and flags existing results', async () => {
    const result = await repo.categoryRolloverPreview(target.id, { page: 1, perPage: 25 });
    expect(result.readOnly).toBe(true);
    expect(result.source.id).toBe(source.id);
    expect(result.items).toMatchObject([
      { studentId: 'student-a', suggestedCategory: { id: 'm1', name: 'Mirim 1' }, warnings: ['TARGET_HAS_RESULTS'] },
      { studentId: 'student-b', suggestedCategory: null, warnings: ['MISSING_BIRTH_DATE'] },
    ]);
    expect(linksFind).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { seasonId: source.id },
      skip: 0, take: 25,
    }));
    expect(poolFind).toHaveBeenCalledWith(expect.objectContaining({
      distinct: ['studentId'],
      where: expect.objectContaining({
        OR: [{ seasonId: target.id }, { event: { is: { seasonId: target.id } } }],
      }),
    }));
    expect(prisma).not.toHaveProperty('student.update');
  });

  it('never rewrites an existing target assignment', async () => {
    linksFind.mockReset();
    linksFind
      .mockResolvedValueOnce([{
        studentId: 'student-a',
        student: { name: 'Atleta A', birthDate: new Date('2019-05-01'), status: 'Ativo' },
        category: { id: 'old', name: 'Pre_Mirim' },
      }])
      .mockResolvedValueOnce([
        { studentId: 'student-a', category: { id: 'existing', name: 'Mirim_2' } },
      ]);
    const result = await repo.categoryRolloverPreview(target.id, { page: 1, perPage: 25 });
    expect(result.items[0].existingTargetCategory?.name).toBe('Mirim 2');
    expect(result.items[0].warnings).toContain('TARGET_ALREADY_ASSIGNED');
  });

  it('rejects non-planned target, missing target and absent predecessor', async () => {
    seasonLookup.mockResolvedValueOnce(null);
    await expect(repo.categoryRolloverPreview(target.id, { page: 1, perPage: 25 }))
      .rejects.toThrow('Target season not found');
    seasonLookup.mockResolvedValueOnce({ ...target, status: 'ACTIVE' });
    await expect(repo.categoryRolloverPreview(target.id, { page: 1, perPage: 25 }))
      .rejects.toThrow('requires a planned season');
    sourceLookup.mockResolvedValueOnce(null);
    await expect(repo.categoryRolloverPreview(target.id, { page: 1, perPage: 25 }))
      .rejects.toThrow('No eligible previous season was found');
    expect(linksCount).not.toHaveBeenCalled();
  });
});

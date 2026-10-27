import { Prisma } from '@prisma/client';
import { PrismaStudentsRepository } from './prisma-students-repository';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';

describe('PrismaStudentsRepository near-date projection', () => {
  const queryRaw = jest.fn().mockResolvedValue([
    { id: 'a', name: 'Ana', birthDate: new Date('2015-10-27T00:00:00.000Z') },
  ]);
  const repository = new PrismaStudentsRepository(
    { $queryRaw: queryRaw } as unknown as PrismaService,
    {} as CacheRepository,
    {} as EnvService,
  );

  beforeEach(() => queryRaw.mockClear());

  it('returns minimum fields and restricts the query to active swimmers', async () => {
    const rows = await repository.listUpcomingBirthdays({ dayKeys: ['10-27'] });
    expect(rows).toEqual([{ id: 'a', name: 'Ana', birthDate: '2015-10-27' }]);
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql).toContain('s.status');
    expect(query.sql).toContain('s.birth_date');
    expect(query.sql).toContain('MM-DD');
    expect(query.values).toContain('10-27');
  });

  it('restricts teachers to students in their active class assignments', async () => {
    const profileId = '11111111-1111-4111-8111-111111111111';
    await repository.listUpcomingBirthdays({
      dayKeys: ['10-27'],
      teacherProfileId: profileId,
    });
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql).toContain('EXISTS');
    expect(query.sql).toContain('sc.to_date IS NULL');
    expect(query.sql).toContain('t.profile_id');
    expect(query.sql).toContain('t.status');
    expect(query.values).toContain(profileId);
  });

  it('avoids querying a database for an empty calendar window', async () => {
    expect(await repository.listUpcomingBirthdays({ dayKeys: [] })).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository';
import { makeStudent } from '../../../../../test/factories/make-student';
import { ListStudentSeasonCategoriesUseCase } from './list-student-season-categories';

describe('ListStudentSeasonCategoriesUseCase', () => {
  let repository: InMemoryStudentsRepository;
  let useCase: ListStudentSeasonCategoriesUseCase;
  const studentId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    repository = new InMemoryStudentsRepository();
    useCase = new ListStudentSeasonCategoriesUseCase(repository);
  });

  it('returns an empty history, not a fabricated season', async () => {
    repository.items.push(makeStudent({ id: studentId }));
    await expect(useCase.execute(studentId)).resolves.toEqual({
      categories: [],
    });
  });

  it('returns only existing season-category associations', async () => {
    repository.items.push(makeStudent({ id: studentId }));
    const category = {
      seasonId: '22222222-2222-4222-8222-222222222222',
      year: 2026,
      seasonLabel: 'Temporada 2026',
      seasonStatus: 'ACTIVE' as const,
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      categoryId: '33333333-3333-4333-8333-333333333333',
      category: 'Mirim 1',
      assignedAt: '2026-01-10T12:00:00.000Z',
    };
    repository.seasonCategoryHistory[studentId] = [category];
    await expect(useCase.execute(studentId)).resolves.toEqual({
      categories: [category],
    });
  });

  it('rejects an unknown student instead of returning an empty history', async () => {
    await expect(useCase.execute(studentId)).rejects.toBeInstanceOf(AppError);
  });
});

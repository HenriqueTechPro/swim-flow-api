import { ListUpcomingBirthdaysUseCase } from './list-upcoming-birthdays';
import { InMemoryStudentsRepository } from '../../../../../test/repositories/in-memory-students-repository';
import { makeStudent } from '../../../../../test/factories/make-student';

describe('ListUpcomingBirthdaysUseCase', () => {
  let repository: InMemoryStudentsRepository;
  let sut: ListUpcomingBirthdaysUseCase;

  beforeEach(() => {
    repository = new InMemoryStudentsRepository();
    sut = new ListUpcomingBirthdaysUseCase(repository);
  });

  it('returns minimal data only for active birthdays near the date, across years', async () => {
    repository.items.push(
      makeStudent({ id: 'today', name: 'Ana', birthDate: '2015-10-27', status: 'Ativo' }),
      makeStudent({ id: 'far', name: 'Bruno', birthDate: '2012-02-10', status: 'Ativo' }),
      makeStudent({ id: 'former', name: 'Carla', birthDate: '2016-10-27', status: 'Inativo' }),
    );
    const { birthdays } = await sut.execute({ now: new Date('2026-10-27T12:00:00Z') });
    expect(birthdays).toEqual([{ id: 'today', name: 'Ana', birthDate: '2015-10-27' }]);
  });

  it('keeps birthdays around New Year within the client-timezone envelope', async () => {
    repository.items.push(
      makeStudent({ id: 'a', name: 'December', birthDate: '2018-12-31' }),
      makeStudent({ id: 'b', name: 'January', birthDate: '2019-01-01' }),
    );
    const { birthdays } = await sut.execute({ now: new Date('2026-12-31T23:59:00Z') });
    expect(birthdays.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('includes leap-day birthdays on March 1 when the year is not leap', async () => {
    repository.items.push(makeStudent({ id: 'leap', name: 'Salto', birthDate: '2012-02-29' }));
    const { birthdays } = await sut.execute({ now: new Date('2027-03-01T00:00:00Z') });
    expect(birthdays).toHaveLength(1);
    expect(birthdays[0].birthDate).toBe('2012-02-29');
  });

  it('does not misassign February 29 in actual leap years', async () => {
    repository.items.push(makeStudent({ id: 'leap', name: 'Salto', birthDate: '2012-02-29' }));
    const { birthdays } = await sut.execute({ now: new Date('2028-03-03T00:00:00Z') });
    expect(birthdays).toEqual([]);
  });
});

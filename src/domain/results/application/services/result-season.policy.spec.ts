import { AppError } from '@/shared/errors/app-error';
import { assertResultDateWithinSeason } from './result-season.policy';

const season = {
  startsOn: new Date('2025-09-01T00:00:00.000Z'),
  endsOn: new Date('2026-08-31T00:00:00.000Z'),
};

describe('Result season policy', () => {
  it('accepts both boundary dates for a season spanning two calendar years', () => {
    expect(() =>
      assertResultDateWithinSeason(season.startsOn, season),
    ).not.toThrow();
    expect(() =>
      assertResultDateWithinSeason(season.endsOn, season),
    ).not.toThrow();
  });

  it('rejects a result before or after the selected season', () => {
    for (const date of ['2025-08-31', '2026-09-01']) {
      expect(() =>
        assertResultDateWithinSeason(
          new Date(`${date}T00:00:00.000Z`),
          season,
        ),
      ).toThrow(AppError);
    }
  });

  it('rejects seasons with inverted dates', () => {
    expect(() =>
      assertResultDateWithinSeason(season.startsOn, {
        startsOn: season.endsOn,
        endsOn: season.startsOn,
      }),
    ).toThrow('Result date is outside the selected season');
  });
});

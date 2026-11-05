import { AppError } from '@/shared/errors/app-error';
import { assertResultDateWithinSeason } from './result-season.policy';

const season = {
  startsOn: new Date('2025-09-01T00:00:00.000Z'),
  endsOn: new Date('2026-08-31T00:00:00.000Z'),
};

describe('Result season policy', () => {
  it('accepts both boundaries of a cross-year season', () => {
    const checkStart = () =>
      assertResultDateWithinSeason(season.startsOn, season);
    const checkEnd = () => assertResultDateWithinSeason(season.endsOn, season);
    expect(checkStart).not.toThrow();
    expect(checkEnd).not.toThrow();
  });

  it('rejects results before and after the season', () => {
    for (const date of ['2025-08-31', '2026-09-01']) {
      const heldOn = new Date(`${date}T00:00:00.000Z`);
      const check = () => assertResultDateWithinSeason(heldOn, season);
      expect(check).toThrow(AppError);
    }
  });

  it('rejects an inverted season interval', () => {
    const invertedSeason = {
      startsOn: season.endsOn,
      endsOn: season.startsOn,
    };
    const check = () =>
      assertResultDateWithinSeason(season.startsOn, invertedSeason);
    expect(check).toThrow('Result date is outside the selected season');
  });
});

import { AppError } from '@/shared/errors/app-error';

export interface ResultSeasonPeriod {
  startsOn: Date;
  endsOn: Date;
}

/** The result date must fall within the selected season (both ends included). */
export function assertResultDateWithinSeason(
  heldOn: Date,
  season: ResultSeasonPeriod,
): void {
  if (
    season.startsOn > season.endsOn ||
    heldOn < season.startsOn ||
    heldOn > season.endsOn
  ) {
    throw new AppError(422, 'Result date is outside the selected season');
  }
}

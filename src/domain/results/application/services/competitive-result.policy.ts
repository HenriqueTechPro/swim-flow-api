import { AppError } from '@/shared/errors/app-error';
import type { ResultStyle } from '../../enterprise/entities/result';

// Use a discriminated union: a pool result cannot carry water-body metadata,
// and an open-water result cannot accidentally specify a pool length.
type RaceOutcome =
  | 'PENDING'
  | 'CLASSIFIED'
  | 'DISQUALIFIED'
  | 'DID_NOT_START'
  | 'DID_NOT_FINISH';

interface SharedRaceInput {
  studentId: string;
  distanceMeters: number;
  durationMs: number | null;
  position: number | null;
  status: RaceOutcome;
}

export interface PoolResultInput extends SharedRaceInput {
  discipline: 'POOL';
  style: ResultStyle;
  poolLengthMeters: number | null;
  format: 'INDIVIDUAL' | 'RELAY';
}

export interface OpenWaterResultInput extends SharedRaceInput {
  discipline: 'OPEN_WATER';
  bodyType: 'SEA' | 'RIVER' | 'LAKE' | 'RESERVOIR' | null;
  routeKey: string | null;
  format:
    | 'INDIVIDUAL'
    | 'RELAY'
    | 'TRAVESSIA'
    | 'KNOCKOUT_SPRINT'
    | 'ULTRAMARATHON';
}

export type CompetitiveResultInput = PoolResultInput | OpenWaterResultInput;

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export class CompetitiveResultPolicy {
  static assertValid(input: CompetitiveResultInput): void {
    if (!positiveInteger(input.distanceMeters)) {
      throw new AppError(422, 'distanceMeters must be a positive whole number');
    }

    if (input.durationMs !== null && !positiveInteger(input.durationMs)) {
      throw new AppError(422, 'durationMs must be a positive integer when present');
    }

    if (input.position !== null && !positiveInteger(input.position)) {
      throw new AppError(422, 'position must be a positive integer when present');
    }

    if (input.status === 'CLASSIFIED' && input.durationMs === null) {
      throw new AppError(422, 'Classified results require a recorded duration');
    }

    if (input.status !== 'CLASSIFIED' && input.position !== null) {
      throw new AppError(422, 'Only classified results can have a finishing position');
    }

    if (input.discipline === 'POOL') {
      if (
        input.poolLengthMeters !== null &&
        (!Number.isFinite(input.poolLengthMeters) ||
          input.poolLengthMeters <= 0)
      ) {
        throw new AppError(422, 'poolLengthMeters must be positive when present');
      }
    } else if (input.routeKey !== null && !input.routeKey.trim()) {
      throw new AppError(422, 'routeKey cannot be blank');
    }
  }

  /**
   * Only individually classified pool swims with a KNOWN lane length are
   * directly comparable as automatic PBs. Never group 25m and 50m together.
   * A relay split or outdoor race is not an individual pool PB.
   */
  static automaticPersonalBestKey(input: CompetitiveResultInput): string | null {
    this.assertValid(input);

    if (
      input.discipline !== 'POOL' ||
      input.status !== 'CLASSIFIED' ||
      input.format !== 'INDIVIDUAL' ||
      input.poolLengthMeters === null
    ) {
      return null;
    }

    return [
      'POOL',
      input.style,
      input.distanceMeters,
      input.poolLengthMeters.toFixed(2),
    ].join(':');
  }

  /**
   * Outdoor routes can be grouped for descriptive review, NOT for automatic
   * equivalence: tides, current and weather still affect race times.
   */
  static openWaterRouteGroupKey(
    input: OpenWaterResultInput,
  ): string | null {
    this.assertValid(input);
    if (input.routeKey === null || input.bodyType === null) return null;

    return [
      'OPEN_WATER',
      input.bodyType,
      input.routeKey.trim(),
      input.distanceMeters,
      input.format,
    ].join(':');
  }
}

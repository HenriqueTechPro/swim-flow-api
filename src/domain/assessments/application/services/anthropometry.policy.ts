import { AppError } from '@/shared/errors/app-error';

export interface AnthropometricMeasurements {
  heightCm?: number | null;
  bodyMassKg?: number | null;
  armSpanCm?: number | null;
  legLengthCm?: number | null;
  footLengthCm?: number | null;
  handLengthCm?: number | null;
  trunkLengthCm?: number | null;
}

export interface DerivedAnthropometricMetrics {
  // These are descriptive measurements, NOT a diagnosis or stroke prediction.
  bodyMassIndex: number | null;
  armSpanMinusHeightCm: number | null;
}

const MEASUREMENT_KEYS = [
  'heightCm',
  'bodyMassKg',
  'armSpanCm',
  'legLengthCm',
  'footLengthCm',
  'handLengthCm',
  'trunkLengthCm',
] as const satisfies ReadonlyArray<keyof AnthropometricMeasurements>;

export class AnthropometryPolicy {
  static validateAndDerive(
    measurements: AnthropometricMeasurements,
  ): DerivedAnthropometricMetrics {
    let recordedCount = 0;

    for (const key of MEASUREMENT_KEYS) {
      const value = measurements[key];
      if (value === undefined || value === null) continue;

      if (!Number.isFinite(value) || value <= 0) {
        throw new AppError(422, `${key} must be a positive finite number`);
      }

      recordedCount += 1;
    }

    if (recordedCount === 0) {
      throw new AppError(422, 'At least one physical measurement is required');
    }

    const heightCm = measurements.heightCm;
    const bodyMassKg = measurements.bodyMassKg;
    const armSpanCm = measurements.armSpanCm;

    return {
      bodyMassIndex:
        heightCm != null && bodyMassKg != null
          ? bodyMassKg / (heightCm / 100) ** 2
          : null,
      armSpanMinusHeightCm:
        armSpanCm != null && heightCm != null
          ? armSpanCm - heightCm
          : null,
    };
  }
}

const FRACTION_SCALE = 1000;
const DEFAULT_PRECISION = 2;

export interface ParsedDuration {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalMilliseconds: number;
  totalSeconds: number;
}

function padFraction(value: number, precision: number) {
  const factor = 10 ** (3 - precision);
  return Math.floor(value / factor)
    .toString()
    .padStart(precision, '0');
}

export function parseDuration(value: string): ParsedDuration | null {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return null;
  }

  const [wholePart, fractionPart = ''] = normalized.split('.');

  if (!wholePart || normalized.split('.').length > 2) {
    return null;
  }

  if (fractionPart && !/^\d{1,3}$/.test(fractionPart)) {
    return null;
  }

  const timeParts = wholePart.split(':');

  if (timeParts.length < 1 || timeParts.length > 3) {
    return null;
  }

  if (timeParts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeParts.length === 1) {
    seconds = Number.parseInt(timeParts[0], 10);
  }

  if (timeParts.length === 2) {
    minutes = Number.parseInt(timeParts[0], 10);
    seconds = Number.parseInt(timeParts[1], 10);
  }

  if (timeParts.length === 3) {
    hours = Number.parseInt(timeParts[0], 10);
    minutes = Number.parseInt(timeParts[1], 10);
    seconds = Number.parseInt(timeParts[2], 10);
  }

  if (seconds > 59) {
    return null;
  }

  if (timeParts.length === 3 && minutes > 59) {
    return null;
  }

  const milliseconds = fractionPart
    ? Number.parseInt(fractionPart.padEnd(3, '0').slice(0, 3), 10)
    : 0;
  const totalMilliseconds =
    (((hours * 60 + minutes) * 60 + seconds) * FRACTION_SCALE) + milliseconds;

  const normalizedHours = Math.floor(totalMilliseconds / 3_600_000);
  const normalizedMinutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const normalizedSeconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const normalizedMilliseconds = totalMilliseconds % 1_000;

  return {
    hours: normalizedHours,
    minutes: normalizedMinutes,
    seconds: normalizedSeconds,
    milliseconds: normalizedMilliseconds,
    totalMilliseconds,
    totalSeconds: totalMilliseconds / FRACTION_SCALE,
  };
}

export function isValidDurationString(value: string) {
  return parseDuration(value) !== null;
}

export function formatDurationFromMilliseconds(
  totalMilliseconds: number,
  precision = DEFAULT_PRECISION,
) {
  const safePrecision = Math.max(0, Math.min(3, precision));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const milliseconds = totalMilliseconds % 1_000;
  const fraction =
    safePrecision > 0 ? '.' + padFraction(milliseconds, safePrecision) : '';

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${fraction}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}${fraction}`;
}

export function formatDurationFromSeconds(totalSeconds: number, precision = DEFAULT_PRECISION) {
  return formatDurationFromMilliseconds(Math.round(totalSeconds * FRACTION_SCALE), precision);
}

export function normalizeDurationString(value: string, precision = DEFAULT_PRECISION) {
  const parsed = parseDuration(value);

  if (!parsed) {
    return null;
  }

  return formatDurationFromMilliseconds(parsed.totalMilliseconds, precision);
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified';

export interface AttendanceStatusCount {
  status: AttendanceStatus;
  count: number;
}

export interface ProgressAttendanceSummary {
  recordedSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  justifiedCount: number;
  presencePercentage: number | null;
  /** Unrecorded scheduled classes are not considered absences. */
  denominator: 'recorded-attendance-only';
}

/**
 * For the individual report, a justified absence is not a presence.
 * Do not reuse the operational attendance dashboard's historical definition.
 */
export function summarizeStudentAttendance(
  counts: readonly AttendanceStatusCount[],
): ProgressAttendanceSummary {
  const byStatus: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    justified: 0,
  };
  for (const { status, count } of counts) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('Invalid attendance count');
    }
    byStatus[status] += count;
  }

  const recordedSessions = Object.values(byStatus).reduce(
    (total, count) => total + count,
    0,
  );
  return {
    recordedSessions,
    presentCount: byStatus.present,
    absentCount: byStatus.absent,
    lateCount: byStatus.late,
    justifiedCount: byStatus.justified,
    presencePercentage:
      recordedSessions > 0
        ? Math.round(
            ((byStatus.present + byStatus.late) / recordedSessions) * 1000,
          ) / 10
        : null,
    denominator: 'recorded-attendance-only',
  };
}

export const PHYSICAL_MEASURES = [
  'heightCm',
  'bodyMassKg',
  'armSpanCm',
  'legLengthCm',
  'footLengthCm',
  'handLengthCm',
  'trunkLengthCm',
] as const;

export type PhysicalMeasure = (typeof PHYSICAL_MEASURES)[number];
export type PhysicalMeasurements = Record<PhysicalMeasure, number | null>;

export interface DatedMeasurements {
  measuredOn: string;
  values: PhysicalMeasurements;
}

export interface PhysicalProgressSummary {
  assessmentCount: number;
  initial: DatedMeasurements | null;
  final: DatedMeasurements | null;
  changes: Partial<Record<PhysicalMeasure, number>>;
}

/**
 * Changes are only meaningful when two DIFFERENT assessments contain
 * the same recorded measure. Missing values are never assumed to be zero.
 */
export function summarizePhysicalProgress(
  assessmentCount: number,
  initial: DatedMeasurements | null,
  final: DatedMeasurements | null,
): PhysicalProgressSummary {
  const changes: Partial<Record<PhysicalMeasure, number>> = {};
  if (assessmentCount >= 2 && initial && final) {
    for (const key of PHYSICAL_MEASURES) {
      const before = initial.values[key];
      const after = final.values[key];
      if (before !== null && after !== null) {
        changes[key] = Math.round((after - before) * 100) / 100;
      }
    }
  }
  return { assessmentCount, initial, final, changes };
}

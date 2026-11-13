import {
  summarizePhysicalProgress,
  summarizeStudentAttendance,
} from './student-progress-report.policy';

const measure = (height: number | null) => ({
  heightCm: height,
  bodyMassKg: null,
  armSpanCm: null,
  legLengthCm: null,
  footLengthCm: null,
  handLengthCm: null,
  trunkLengthCm: null,
});

describe('Student progress report rules', () => {
  it('counts only recorded attendance and does not treat justified as presence', () => {
    const result = summarizeStudentAttendance([
      { status: 'present', count: 8 },
      { status: 'late', count: 1 },
      { status: 'absent', count: 2 },
      { status: 'justified', count: 1 },
    ]);
    expect(result).toEqual({
      recordedSessions: 12,
      presentCount: 8,
      lateCount: 1,
      absentCount: 2,
      justifiedCount: 1,
      presencePercentage: 75,
      denominator: 'recorded-attendance-only',
    });
  });

  it('reports missing attendance as unknown rather than zero percent', () => {
    expect(summarizeStudentAttendance([]).presencePercentage).toBeNull();
  });

  it('compares only measures present in two different assessments', () => {
    const result = summarizePhysicalProgress(
      2,
      { measuredOn: '2026-01-10', values: measure(120) },
      { measuredOn: '2026-10-10', values: measure(125.5) },
    );
    expect(result.changes).toEqual({ heightCm: 5.5 });
  });

  it('does not call multiple same-day measurements physical evolution', () => {
    const result = summarizePhysicalProgress(
      2,
      { measuredOn: '2026-08-20', values: measure(140) },
      { measuredOn: '2026-08-20', values: measure(141.5) },
    );
    expect(result.assessmentCount).toBe(2);
    expect(result.changes).toEqual({});
  });

  it('does not invent growth when there is only one assessment', () => {
    const entry = { measuredOn: '2026-01-10', values: measure(120) };
    const result = summarizePhysicalProgress(1, entry, entry);
    expect(result.changes).toEqual({});
  });
});

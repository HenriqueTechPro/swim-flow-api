import { studentProgressReportQuerySchema } from './student-progress-report';

describe('Student progress report period', () => {
  it('accepts an existing season identifier as a selection', () => {
    expect(
      studentProgressReportQuerySchema.safeParse({
        seasonId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('accepts an inclusive interval', () => {
    expect(
      studentProgressReportQuerySchema.safeParse({
        from: '2026-01-01',
        to: '2026-12-31',
      }).success,
    ).toBe(true);
  });

  it.each([
    {},
    { from: '2026-01-01' },
    { from: '2026-09-01', to: '2026-01-01' },
    { from: '2026-02-30', to: '2026-12-31' },
    {
      seasonId: '11111111-1111-4111-8111-111111111111',
      from: '2026-01-01',
      to: '2026-12-31',
    },
  ])('rejects incomplete or contradictory periods: %j', (query) => {
    expect(studentProgressReportQuerySchema.safeParse(query).success).toBe(
      false,
    );
  });
});

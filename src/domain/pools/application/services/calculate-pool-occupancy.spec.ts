import { calculatePoolOccupancy, poolOccupancyQuerySchema } from './calculate-pool-occupancy';

describe('pool planned occupancy', () => {
  const pool = { id: 'p1', name: 'Piscina 25m', capacity: 20 };

  it('deduplicates one athlete in two integrated classes and counts simultaneous students', () => {
    const response = calculatePoolOccupancy(pool, '2026-11-10', 'Terça-feira', [
      { id: 'a', name: 'Infantil', studentIds: ['1','2','3'], schedules: [{ startTime: '08:00', endTime: '09:00' }] },
      { id: 'b', name: 'Petiz', studentIds: ['3','4'], schedules: [{ startTime: '08:30', endTime: '09:30' }] },
    ], []);
    expect(response.slots.map((slot) => slot.uniqueStudents)).toEqual([3,4,2]);
    expect(response.slots[1]).toMatchObject({
      startTime: '08:30', plannedPercent: 20, overlappingEnrollmentCount: 1,
    });
    expect(response.slots[1].classes).toHaveLength(2);
  });

  it('does not count declared training participants as unique students', () => {
    const response = calculatePoolOccupancy(pool, '2026-11-10', 'Terça-feira', [], [
      { id: 't1', title: 'Treino conjunto', startTime: '08:00', endTime: '09:00', declaredParticipants: 20 },
    ]);
    expect(response.slots).toHaveLength(2);
    expect(response.slots.every((slot) => slot.uniqueStudents === 0)).toBe(true);
    expect(response.trainingsNotCounted[0].declaredParticipants).toBe(20);
    expect(response.limits.excludesTrainings).toBe(true);
  });

  it('does not sum different students in sequential sessions inside one time slot', () => {
    const response = calculatePoolOccupancy(pool, '2026-11-10', 'Terça-feira', [
      { id: 'a', name: 'A', studentIds: ['1','2'], schedules: [{ startTime: '08:00', endTime: '08:15' }] },
      { id: 'b', name: 'B', studentIds: ['3','4','5'], schedules: [{ startTime: '08:15', endTime: '08:30' }] },
    ], []);
    expect(response.slots).toHaveLength(1);
    expect(response.slots[0].uniqueStudents).toBe(3);
    expect(response.slots[0].plannedPercent).toBe(15);
  });

  it('does not manufacture percentages without declared capacity', () => {
    const response = calculatePoolOccupancy({ ...pool, capacity: null }, '2026-11-10', 'Terça-feira', [
      { id: 'a', name: 'Infantil', studentIds: ['1'], schedules: [{ startTime: '10:00', endTime: '10:30' }] },
    ], []);
    expect(response.slots[0].plannedPercent).toBeNull();
  });

  it('uses half-open ranges for adjacent schedules', () => {
    const response = calculatePoolOccupancy(pool, '2026-11-10', 'Terça-feira', [
      { id: 'a', name: 'A', studentIds: ['1'], schedules: [{ startTime: '08:00', endTime: '08:30' }] },
      { id: 'b', name: 'B', studentIds: ['2'], schedules: [{ startTime: '08:30', endTime: '09:00' }] },
    ], []);
    expect(response.slots.map((slot) => slot.uniqueStudents)).toEqual([1,1]);
  });

  it('rejects invalid days, avoiding misleading current occupancy', () => {
    expect(poolOccupancyQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
    expect(poolOccupancyQuerySchema.safeParse({ date: '2026-11-10' }).success).toBe(true);
  });
});

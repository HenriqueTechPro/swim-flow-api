import { z } from 'zod';
import type {
  PoolOccupancyPreview,
  PoolOccupancySlot,
} from '../repositories/pools-repository';

export const poolOccupancyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
    }, 'Invalid calendar date'),
});

interface ScheduledClass {
  id: string;
  name: string;
  studentIds: string[];
  schedules: Array<{ startTime: string; endTime: string }>;
}

type ScheduledTraining = PoolOccupancyPreview['trainingsNotCounted'][number];

const minute = (time: string) => {
  const [hour, min] = time.split(':').map(Number);
  return hour * 60 + min;
};
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function calculatePoolOccupancy(
  pool: PoolOccupancyPreview['pool'],
  date: string,
  weekday: string,
  classes: ScheduledClass[],
  trainings: ScheduledTraining[],
): PoolOccupancyPreview {
  const slots: PoolOccupancySlot[] = [];
  for (let start = 0; start < 1440; start += 30) {
    const end = start + 30;
    const overlapping = classes.filter((item) =>
      item.schedules.some(
        (schedule) => minute(schedule.startTime) < end &&
          minute(schedule.endTime) > start,
      ),
    );
    const participants = new Set(overlapping.flatMap((item) => item.studentIds));
    const rawCount = overlapping.reduce(
      (total, item) => total + new Set(item.studentIds).size,
      0,
    );
    const trainingAtTime = trainings.some((item) =>
      minute(item.startTime) < end && minute(item.endTime) > start,
    );
    if (!overlapping.length && !trainingAtTime) continue;
    slots.push({
      startTime: hhmm(start),
      endTime: hhmm(end),
      uniqueStudents: participants.size,
      plannedPercent: pool.capacity && pool.capacity > 0
        ? Math.round((participants.size / pool.capacity) * 100)
        : null,
      classes: overlapping.map((item) => ({
        id: item.id,
        name: item.name,
        students: new Set(item.studentIds).size,
      })),
      overlappingEnrollmentCount: rawCount - participants.size,
    });
  }
  return {
    pool,
    date,
    weekday,
    measurement: 'PLANNED_ENROLLMENT',
    limits: {
      recurringScheduleOnly: true,
      excludesTrainings: true,
      excludesAttendance: true,
      noCrossClassDoubleCounting: true,
    },
    slots,
    trainingsNotCounted: trainings,
  };
}

import { z } from 'zod';
import type {
  PoolOccupancyPreview,
  PoolOccupancySlot,
} from '../repositories/pools-repository';

export const poolOccupancyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
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
    // A 30-minute interval can contain back-to-back sessions. Count the
    // maximum number of students simultaneously present, not their union.
    const boundaryMinutes = new Set<number>([start]);
    for (const item of classes) {
      for (const schedule of item.schedules) {
        const begin = minute(schedule.startTime);
        const finish = minute(schedule.endTime);
        if (begin < end && finish > start) {
          boundaryMinutes.add(Math.max(start, begin));
          if (finish < end) boundaryMinutes.add(finish);
        }
      }
    }
    let peak = 0;
    let peakClasses: typeof classes = [];
    let duplicatedEnrollment = 0;
    for (const at of [...boundaryMinutes].sort((a, b) => a - b)) {
      if (at >= end) continue;
      const concurrent = classes.filter((item) =>
        item.schedules.some(
          (schedule) => minute(schedule.startTime) <= at &&
            minute(schedule.endTime) > at,
        ),
      );
      const participants = new Set(concurrent.flatMap((item) => item.studentIds));
      if (participants.size > peak || (participants.size === peak && concurrent.length > peakClasses.length)) {
        peak = participants.size;
        peakClasses = concurrent;
        duplicatedEnrollment =
          concurrent.reduce((sum, item) => sum + new Set(item.studentIds).size, 0) -
          participants.size;
      }
    }
    const trainingAtTime = trainings.some((item) =>
      minute(item.startTime) < end && minute(item.endTime) > start,
    );
    if (!peakClasses.length && !trainingAtTime) continue;
    slots.push({
      startTime: hhmm(start),
      endTime: hhmm(end),
      uniqueStudents: peak,
      plannedPercent: pool.capacity && pool.capacity > 0
        ? Math.round((peak / pool.capacity) * 100)
        : null,
      classes: peakClasses.map((item) => ({
        id: item.id,
        name: item.name,
        students: new Set(item.studentIds).size,
      })),
      overlappingEnrollmentCount: duplicatedEnrollment,
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

import { z } from 'zod';

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    'Data inválida',
  );

const centimeters = z.number().finite().positive().max(400).nullish();
const kilograms = z.number().finite().positive().max(350).nullish();

export const createStudentPhysicalAssessmentSchema = z
  .object({
    measuredOn: calendarDateSchema,
    heightCm: centimeters,
    bodyMassKg: kilograms,
    armSpanCm: centimeters,
    legLengthCm: centimeters,
    footLengthCm: centimeters,
    handLengthCm: centimeters,
    trunkLengthCm: centimeters,
    measurementMethod: z.string().trim().max(120).nullish(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .strict();

export type CreateStudentPhysicalAssessmentDto = z.infer<
  typeof createStudentPhysicalAssessmentSchema
>;

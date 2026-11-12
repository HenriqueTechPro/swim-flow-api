import { z } from 'zod';

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Data inválida');

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


/**
 * Opt-in read-only history filters. A request without query parameters
 * continues to use the legacy unpaginated response (latest 50 records).
 */
export const listStudentPhysicalAssessmentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.year !== undefined && (query.from || query.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use year or a date interval, not both',
      });
    }
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be on or before to',
      });
    }
  });

export type ListStudentPhysicalAssessmentsQuery = z.infer<
  typeof listStudentPhysicalAssessmentsQuerySchema
>;

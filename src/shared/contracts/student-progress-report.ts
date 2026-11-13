import { z } from 'zod';

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00.000Z');
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Data inválida');

export const studentProgressReportQuerySchema = z
  .object({
    seasonId: z.string().uuid().optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.seasonId) {
      if (query.from || query.to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Use seasonId ou um intervalo de datas, não ambos',
        });
      }
      return;
    }

    if (!query.from || !query.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe seasonId ou as datas from e to',
      });
    } else if (query.from > query.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data inicial deve ser anterior ou igual à final',
      });
    }
  });

export type StudentProgressReportQuery = z.infer<
  typeof studentProgressReportQuerySchema
>;

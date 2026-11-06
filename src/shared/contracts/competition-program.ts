import { z } from 'zod';

const id = z.string().uuid();
const positiveNumber = z.number().int().positive();
const label = (limit: number) => z.string().trim().min(1).max(limit);

export const createPoolProgramRaceSchema = z
  .object({
    eventId: id,
    sessionCode: label(40),
    raceNumber: positiveNumber,
    style: z.enum(['Livre', 'Costas', 'Peito', 'Borboleta', 'Medley']),
    distanceMeters: positiveNumber,
    poolLengthMeters: z.number().finite().positive().max(9999.99),
    format: z.enum(['INDIVIDUAL', 'RELAY']).default('INDIVIDUAL'),
    categorySnapshot: label(120),
    genderScope: z.enum(['MASCULINO', 'FEMININO', 'MISTO']),
  })
  .strict();

export const createOpenWaterProgramRaceSchema = z
  .object({
    eventId: id,
    sessionCode: label(40),
    raceNumber: positiveNumber,
    distanceMeters: positiveNumber,
    bodyType: z.enum(['SEA', 'RIVER', 'LAKE', 'RESERVOIR']),
    routeKey: label(160),
    format: z
      .enum([
        'INDIVIDUAL',
        'RELAY',
        'TRAVESSIA',
        'KNOCKOUT_SPRINT',
        'ULTRAMARATHON',
      ])
      .default('TRAVESSIA'),
    categorySnapshot: label(120),
    genderScope: z.enum(['MASCULINO', 'FEMININO', 'MISTO']),
  })
  .strict();

const time = z.string().datetime({ offset: true });

export const createPoolProgramHeatSchema = z
  .object({
    raceId: id,
    heatNumber: positiveNumber,
    plannedStartAt: time.nullable().optional(),
  })
  .strict();

export const createOpenWaterProgramStartSchema = z
  .object({
    raceId: id,
    waveNumber: positiveNumber,
    plannedStartAt: time.nullable().optional(),
  })
  .strict();

const pagination = {
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
};

export const programRaceListSchema = z
  .object({
    eventId: id,
    ...pagination,
  })
  .strict();

export const programSeriesListSchema = z
  .object({
    raceId: id,
    ...pagination,
  })
  .strict();

export type CreatePoolProgramRaceDto = z.infer<
  typeof createPoolProgramRaceSchema
>;
export type CreateOpenWaterProgramRaceDto = z.infer<
  typeof createOpenWaterProgramRaceSchema
>;
export type CreatePoolProgramHeatDto = z.infer<
  typeof createPoolProgramHeatSchema
>;
export type CreateOpenWaterProgramStartDto = z.infer<
  typeof createOpenWaterProgramStartSchema
>;
export type ProgramRaceListDto = z.infer<typeof programRaceListSchema>;
export type ProgramSeriesListDto = z.infer<typeof programSeriesListSchema>;

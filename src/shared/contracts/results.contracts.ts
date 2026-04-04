import { z } from 'zod'

export const createResultSchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  discipline: z.string().min(1).default('Piscina'),
  style: z.string().min(1),
  distance: z.string().min(1),
  customDistance: z.string().optional().default(''),
  competitionType: z.string().optional().default(''),
  courseType: z.string().optional().default(''),
  eventFormat: z.string().optional().default('Prova Individual'),
  time: z.string().min(1),
  date: z.string().min(1),
  competition: z.string().optional().default(''),
  position: z.number().int().min(0).optional().default(0),
  resultStatus: z.enum(['Classificado', 'Desclassificado']).optional().default('Classificado'),
  category: z.string().optional().default(''),
  notes: z.string().optional(),
})

export const updateResultSchema = createResultSchema.extend({
  timeInSeconds: z.number(),
  personalBest: z.boolean().default(false),
  improvement: z.number().default(0),
})

export type CreateResultDto = z.infer<typeof createResultSchema>
export type UpdateResultDto = z.infer<typeof updateResultSchema>

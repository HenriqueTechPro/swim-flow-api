import { z } from 'zod'

export const resultDisciplineSchema = z.enum(['Piscina', 'Aguas Abertas'])
export const resultStatusSchema = z.enum(['Classificado', 'Desclassificado'])
export const resultEventFormatSchema = z.enum(['Prova Individual', 'Travessia', 'Knockout Sprint', 'Revezamento'])
export const resultCourseTypeSchema = z.enum(['Piscina Curta', 'Piscina Longa', 'Mar', 'Rio', 'Lago', 'Represa'])
export const resultStyleSchema = z.enum(['Livre', 'Costas', 'Peito', 'Borboleta', 'Medley'])

export const createResultSchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  discipline: resultDisciplineSchema.default('Piscina'),
  style: resultStyleSchema,
  distance: z.string().min(1),
  customDistance: z.string().optional().default(''),
  competitionType: z.string().optional().default(''),
  courseType: resultCourseTypeSchema.optional(),
  eventFormat: resultEventFormatSchema.optional().default('Prova Individual'),
  time: z.string().min(1),
  date: z.string().min(1),
  competition: z.string().optional().default(''),
  position: z.number().int().min(0).optional().default(0),
  resultStatus: resultStatusSchema.optional().default('Classificado'),
  category: z.string().optional().default(''),
  notes: z.string().optional(),
})

export const updateResultSchema = createResultSchema.extend({
  timeInSeconds: z.number(),
  personalBest: z.boolean().default(false),
  improvement: z.number().default(0),
})

export type ResultDiscipline = z.infer<typeof resultDisciplineSchema>
export type ResultStatus = z.infer<typeof resultStatusSchema>
export type ResultEventFormat = z.infer<typeof resultEventFormatSchema>
export type ResultCourseType = z.infer<typeof resultCourseTypeSchema>
export type ResultStyle = z.infer<typeof resultStyleSchema>

export type CreateResultDto = z.infer<typeof createResultSchema>
export type UpdateResultDto = z.infer<typeof updateResultSchema>

import { z } from 'zod'

export const trainingTypeSchema = z.enum(['Técnico', 'Resistência', 'Velocidade', 'Misto'])
export const trainingDayOfWeekSchema = z.enum([
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
])
export const trainingLevelSchema = z.enum(['Iniciante', 'Intermediário', 'Avançado', 'Todos'])
export const trainingStatusSchema = z.enum(['Ativo', 'Pausado', 'Encerrado'])
export const trainingVenueTypeSchema = z.enum(['Piscina', 'Mar', 'Rio', 'Lago', 'Represa', 'Outro'])

export const createTrainingSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().optional().default(''),
    type: trainingTypeSchema,
    dayOfWeek: trainingDayOfWeekSchema,
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    instructorId: z.string().uuid().nullable().optional(),
    level: trainingLevelSchema,
    maxParticipants: z.number().int().min(0),
    currentParticipants: z.number().int().min(0).optional(),
    status: trainingStatusSchema,
    venueType: trainingVenueTypeSchema.default('Piscina'),
    locationName: z.string().trim().max(120).optional().default(''),
    poolId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.venueType === 'Piscina' && !data.poolId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['poolId'],
        message: 'Pool is required when venue type is Piscina',
      })
    }

    if (data.venueType !== 'Piscina' && !data.locationName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locationName'],
        message: 'Location name is required when venue type is not Piscina',
      })
    }
  })

export const updateTrainingSchema = createTrainingSchema

export const trainingEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
})

export type CreateTrainingDto = z.infer<typeof createTrainingSchema>
export type UpdateTrainingDto = z.infer<typeof updateTrainingSchema>
export type TrainingEnrollmentDto = z.infer<typeof trainingEnrollmentSchema>

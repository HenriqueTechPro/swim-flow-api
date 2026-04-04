import { z } from 'zod'

export const createTrainingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(''),
  type: z.enum(['Técnico', 'Resistência', 'Velocidade', 'Misto']),
  dayOfWeek: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  instructorId: z.string().uuid().nullable().optional(),
  level: z.enum(['Iniciante', 'Intermediário', 'Avançado', 'Todos']),
  maxParticipants: z.number().int().min(0),
  currentParticipants: z.number().int().min(0),
  status: z.enum(['Ativo', 'Pausado', 'Encerrado']),
  venueType: z.enum(['Piscina', 'Mar', 'Rio', 'Lago', 'Represa', 'Outro']).default('Piscina'),
  locationName: z.string().trim().max(120).optional().default(''),
  poolId: z.string().uuid().nullable().optional(),
}).superRefine((data, ctx) => {
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

export type CreateTrainingDto = z.infer<typeof createTrainingSchema>
export type UpdateTrainingDto = z.infer<typeof updateTrainingSchema>

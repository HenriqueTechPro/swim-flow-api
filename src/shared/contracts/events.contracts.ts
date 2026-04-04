import { z } from 'zod'

export const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(''),
  type: z.enum(['Competição', 'Reunião', 'Festival', 'Outro']),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  location: z.string().min(1),
  status: z.enum(['Agendado', 'Em Andamento', 'Concluído', 'Cancelado']),
})

export const updateEventSchema = createEventSchema

export type CreateEventDto = z.infer<typeof createEventSchema>
export type UpdateEventDto = z.infer<typeof updateEventSchema>

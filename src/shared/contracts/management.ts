import { z } from 'zod'

export const classScheduleSchema = z.object({
  dayOfWeek: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const classTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(['head_coach', 'assistant_coach']),
})

export const createStudentSchema = z.object({
  name: z.string().min(3),
  gender: z.enum(['Masculino', 'Feminino', 'Outro']),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  phone: z.string().min(1),
  status: z.string().min(1),
  photo: z.string().optional().nullable(),
})

export const updateStudentSchema = createStudentSchema.partial().extend({
  name: z.string().min(3),
  gender: z.enum(['Masculino', 'Feminino', 'Outro']),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  phone: z.string().min(1),
  status: z.string().min(1),
})

export const createTeacherSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(1),
  photo: z.string().optional().nullable(),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  certifications: z.string().optional().default(''),
  status: z.string().min(1),
  bio: z.string().optional().nullable(),
})

export const updateTeacherSchema = createTeacherSchema.partial().extend({
  name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(1),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  status: z.string().min(1),
})

export const createParentSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(['Ativo', 'Inativo']),
})

export const updateParentSchema = createParentSchema.partial().extend({
  name: z.string().min(3),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(['Ativo', 'Inativo']),
})

export const createClassSchema = z.object({
  name: z.string().min(3),
  categories: z.array(z.string().min(1)).min(1),
  schedules: z.array(classScheduleSchema).min(1),
  classTeachers: z.array(classTeacherSchema).default([]),
  maxStudents: z.number().int().min(1),
  poolId: z.string().uuid().nullable().optional(),
  status: z.enum(['Ativa', 'Pausada', 'Encerrada']),
})

export const updateClassSchema = createClassSchema.extend({
  categoryIds: z.array(z.string().uuid()).optional(),
})

export const transferTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
})

export const transferStudentSchema = z.object({
  studentId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
})

export const assignClassTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(['head_coach', 'assistant_coach']).optional().default('assistant_coach'),
})

export const updateClassTeacherRoleSchema = z.object({
  role: z.enum(['head_coach', 'assistant_coach']),
})

export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'justified']),
  observations: z.string().optional().default(''),
  savedAt: z.string().optional(),
})

export const saveAttendanceBatchSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
})

export const createResultSchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  style: z.enum(['Livre', 'Costas', 'Peito', 'Borboleta']),
  distance: z.enum(['25m', '50m', '100m', '200m']),
  time: z.string().min(1),
  date: z.string().min(1),
  competition: z.string().optional().default(''),
  position: z.number().int().min(0).optional().default(0),
  category: z.string().optional().default(''),
  notes: z.string().optional(),
})

export const updateResultSchema = createResultSchema.extend({
  timeInSeconds: z.number(),
  personalBest: z.boolean().default(false),
  improvement: z.number().default(0),
})

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

export const createPoolSchema = z.object({
  name: z.string().min(3),
  lengthMeters: z.number().int().positive(),
  address: z.string().min(1),
  status: z.enum(['Ativa', 'Pausada', 'Encerrada']),
  maxCapacity: z.number().int().positive().nullable().optional(),
})

export const updatePoolSchema = createPoolSchema

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
  poolId: z.string().uuid().nullable().optional(),
})

export const updateTrainingSchema = createTrainingSchema

export const createExStudentSchema = z.object({
  studentId: z.string().uuid(),
  exitDate: z.string().min(1),
  exitReason: z.string().min(1),
  exitNotes: z.string().optional(),
  lastCompetition: z.string().optional(),
})

export const updateExStudentSchema = z.object({
  exitDate: z.string().min(1),
  exitReason: z.string().min(1),
  exitNotes: z.string().optional(),
  achievements: z.number().int().min(0),
  lastCompetition: z.string(),
})

export const reactivateExStudentSchema = z.object({
  id: z.string().uuid(),
})

export type CreateStudentDto = z.infer<typeof createStudentSchema>
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>
export type CreateTeacherDto = z.infer<typeof createTeacherSchema>
export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>
export type CreateParentDto = z.infer<typeof createParentSchema>
export type UpdateParentDto = z.infer<typeof updateParentSchema>
export type CreateClassDto = z.infer<typeof createClassSchema>
export type UpdateClassDto = z.infer<typeof updateClassSchema>
export type TransferTeacherDto = z.infer<typeof transferTeacherSchema>
export type TransferStudentDto = z.infer<typeof transferStudentSchema>
export type AssignClassTeacherDto = z.infer<typeof assignClassTeacherSchema>
export type UpdateClassTeacherRoleDto = z.infer<typeof updateClassTeacherRoleSchema>
export type SaveAttendanceBatchDto = z.infer<typeof saveAttendanceBatchSchema>
export type CreateResultDto = z.infer<typeof createResultSchema>
export type UpdateResultDto = z.infer<typeof updateResultSchema>
export type CreateEventDto = z.infer<typeof createEventSchema>
export type UpdateEventDto = z.infer<typeof updateEventSchema>
export type CreatePoolDto = z.infer<typeof createPoolSchema>
export type UpdatePoolDto = z.infer<typeof updatePoolSchema>
export type CreateTrainingDto = z.infer<typeof createTrainingSchema>
export type UpdateTrainingDto = z.infer<typeof updateTrainingSchema>
export type CreateExStudentDto = z.infer<typeof createExStudentSchema>
export type UpdateExStudentDto = z.infer<typeof updateExStudentSchema>
export type ReactivateExStudentDto = z.infer<typeof reactivateExStudentSchema>

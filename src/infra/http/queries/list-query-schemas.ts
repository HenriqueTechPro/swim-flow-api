import { z } from 'zod'

const optionalQueryString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

const optionalPositiveInt = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : value
}, z.number().int().positive().optional())

const optionalAllString = optionalQueryString.transform((value) => (value === 'all' ? undefined : value))

const optionalDateString = optionalQueryString.refine((value) => {
  if (!value) {
    return true
  }

  return !Number.isNaN(Date.parse(value))
}, 'Invalid date')

export const paginationQuerySchema = z.object({
  page: optionalPositiveInt,
  perPage: optionalPositiveInt,
})

export const studentsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  category: optionalAllString,
  status: optionalAllString,
})

export const trainingsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  type: optionalAllString,
  status: optionalAllString,
  poolId: optionalAllString,
})

export const teachersListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  status: optionalAllString,
})

export const parentsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  status: optionalAllString,
})

export const poolsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  status: optionalAllString,
})

export const exStudentsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  category: optionalAllString,
})

export const eventsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  type: optionalAllString,
  status: optionalAllString,
})

export const classesListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  category: optionalAllString,
  day: optionalAllString,
  status: optionalAllString,
  poolId: optionalAllString,
})

export const attendanceListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  startDate: optionalDateString,
  endDate: optionalDateString,
  classId: optionalQueryString,
  studentId: optionalQueryString,
  status: optionalAllString,
})

export const resultsListQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString,
  discipline: optionalQueryString,
  style: optionalQueryString,
  distance: optionalQueryString,
  competition: optionalQueryString,
  eventFormat: optionalQueryString,
  resultStatus: z.enum(['Classificado', 'Desclassificado']).optional(),
  category: optionalQueryString,
  startDate: optionalDateString,
  endDate: optionalDateString,
  studentId: optionalQueryString,
})

export type StudentsListQuery = z.infer<typeof studentsListQuerySchema>
export type TrainingsListQuery = z.infer<typeof trainingsListQuerySchema>
export type TeachersListQuery = z.infer<typeof teachersListQuerySchema>
export type ParentsListQuery = z.infer<typeof parentsListQuerySchema>
export type PoolsListQuery = z.infer<typeof poolsListQuerySchema>
export type ExStudentsListQuery = z.infer<typeof exStudentsListQuerySchema>
export type EventsListQuery = z.infer<typeof eventsListQuerySchema>
export type ClassesListQuery = z.infer<typeof classesListQuerySchema>
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
export type ResultsListQuery = z.infer<typeof resultsListQuerySchema>

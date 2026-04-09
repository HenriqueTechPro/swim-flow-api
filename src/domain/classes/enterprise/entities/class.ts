export interface ClassEntity {
  id: string
  name: string
  category: string
  categories: string[]
  categoryIds: string[]
  dayOfWeek:
    | 'Segunda-feira'
    | 'Terça-feira'
    | 'Quarta-feira'
    | 'Quinta-feira'
    | 'Sexta-feira'
    | 'Sábado'
    | 'Domingo'
  startTime: string
  endTime: string
  schedules: Array<{
    id: string
    dayOfWeek:
      | 'Segunda-feira'
      | 'Terça-feira'
      | 'Quarta-feira'
      | 'Quinta-feira'
      | 'Sexta-feira'
      | 'Sábado'
      | 'Domingo'
    startTime: string
    endTime: string
  }>
  teachers: string[]
  classTeachers: Array<{
    id: string
    teacherId: string
    teacherName: string
    role: 'head_coach' | 'assistant_coach'
    photo?: string
  }>
  maxStudents: number
  enrolledStudents: number
  poolId?: string
  pool: string
  status: 'Ativa' | 'Pausada' | 'Encerrada'
  students: Array<{
    id: string
    name: string
    age: number
    category: string
    level: string
    status: 'Ativo' | 'Inativo'
  }>
}

export interface Student {
  id: string
  name: string
  photo?: string
  gender: 'Masculino' | 'Feminino' | 'Outro'
  birthDate: string
  birthYear: number
  category: string
  level: string
  responsible: string
  parentId?: string
  classId?: string | null
  phone: string
  status: string
  achievements: number
}

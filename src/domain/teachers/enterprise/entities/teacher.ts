export interface Teacher {
  id: string
  name: string
  photo?: string
  cpf?: string
  speciality: string
  categories: string[]
  experience: number
  phone: string
  email: string
  status: 'Ativo' | 'Licença' | 'Inativo'
  studentsCount: number
  birthDate?: string
  address?: string
  bio?: string
  certifications?: string[]
}

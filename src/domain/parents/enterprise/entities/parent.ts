export interface Parent {
  id: string
  name: string
  photo?: string
  cpf?: string
  birthDate?: string
  childrenIds: string[]
  children: string[]
  phone: string
  email: string
  profession: string
  address: string
  emergencyContact: string
  emergencyPhone: string
  status: 'Ativo' | 'Inativo'
}

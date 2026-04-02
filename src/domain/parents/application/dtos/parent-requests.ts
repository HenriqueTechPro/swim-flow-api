export interface CreateParentRequest {
  name: string
  cpf?: string | null
  birthDate?: string | null
  photo?: string | null
  childrenIds: string[]
  email: string
  phone: string
  profession: string
  address: string
  emergencyContact: string
  emergencyPhone: string
  status: 'Ativo' | 'Inativo'
}

export interface UpdateParentRequest extends CreateParentRequest {}

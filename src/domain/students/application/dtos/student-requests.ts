export interface CreateStudentRequest {
  name: string
  gender: 'Masculino' | 'Feminino' | 'Outro'
  birthDate: string
  level: string
  parentId?: string | null
  classId?: string | null
  phone: string
  status: string
  photo?: string | null
}

export interface UpdateStudentRequest extends CreateStudentRequest {}

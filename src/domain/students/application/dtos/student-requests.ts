export interface CreateStudentRequest {
  name: string;
  gender: 'Masculino' | 'Feminino';
  birthDate: string;
  level: string;
  parentId?: string | null;
  classId?: string | null;
  phone: string;
  status: string;
  photo?: string | null;
}

export type UpdateStudentRequest = CreateStudentRequest;

export interface CreateTeacherRequest {
  name: string;
  cpf?: string | null;
  birthDate?: string | null;
  email: string;
  phone: string;
  photo?: string | null;
  specialities: string[];
  categories: string[];
  experience: string;
  certifications?: string | null;
  status: string;
  bio?: string | null;
}

export type UpdateTeacherRequest = CreateTeacherRequest;

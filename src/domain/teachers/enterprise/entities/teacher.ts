export interface Teacher {
  id: string;
  name: string;
  photo?: string;
  cpf?: string;
  speciality: string;
  categories: string[];
  experience: number;
  phone: string;
  email: string;
  status: 'Ativo' | 'Licença' | 'Inativo';
  studentsCount: number;
  /** Lightweight class assignments from the same paginated teacher query. */
  assignedClasses?: Array<{
    classId: string;
    name: string;
    role: 'head_coach' | 'assistant_coach';
  }>;
  birthDate?: string;
  address?: string;
  bio?: string;
  certifications?: string[];
}

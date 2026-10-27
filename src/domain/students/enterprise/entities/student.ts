export interface Student {
  id: string;
  name: string;
  photo?: string;
  gender: 'Masculino' | 'Feminino';
  birthDate: string;
  birthYear: number | null;
  category: string;
  level: string;
  responsible: string;
  /** Telephone of the designated primary guardian; absent when there is no primary link. */
  guardianPhone?: string;
  parentId?: string;
  classId?: string | null;
  /** IDs of all current classes, for detail screens without downloading the full class directory. */
  classIds?: string[];
  phone: string;
  status: string;
  achievements: number;
}

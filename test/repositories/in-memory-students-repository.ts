import { CATEGORY_GROUPS } from '@/shared/lib/categories';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';
import { AppError } from '@/shared/errors/app-error';
import type {
  CreateStudentRepositoryInput,
  StudentReferenceData,
  UpdateStudentRepositoryInput,
} from '@/domain/students/application/repositories/students-repository';
import { StudentsRepository } from '@/domain/students/application/repositories/students-repository';
import { StudentClassAssignmentPolicy } from '@/domain/students/application/services/student-class-assignment-policy';
import type { Student } from '@/domain/students/enterprise/entities/student';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';
import { paginateItems } from '@/domain/shared/pagination/pagination-utils';
import { makeStudent } from '../factories/make-student';

const categoryReferenceData = CATEGORY_GROUPS.flatMap((group) =>
  group.categories.map((category) => ({
    id: parseCategoryValue(category),
    name: parseCategoryValue(category),
  })),
);

const levelReferenceData = [
  { id: 'iniciante', name: 'Iniciante' },
  { id: 'intermediario', name: 'Intermediário' },
  { id: 'intermediario-mojibake', name: 'IntermediÃƒÂ¡rio' },
  { id: 'avancado', name: 'Avançado' },
];

export class InMemoryStudentsRepository implements StudentsRepository {
  public items: Student[] = [];

  async list(
    params?: PaginationParams & {
      search?: string;
      category?: string;
      status?: string;
    },
  ) {
    const filtered = this.items.filter((student) => {
      const matchesSearch =
        !params?.search ||
        student.name.toLowerCase().includes(params.search.toLowerCase()) ||
        student.responsible.toLowerCase().includes(params.search.toLowerCase());
      const matchesCategory =
        !params?.category || student.category === params.category;
      const matchesStatus = !params?.status || student.status === params.status;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return paginateItems(filtered, params);
  }

  async listReferenceData(): Promise<StudentReferenceData> {
    return {
      categories: categoryReferenceData,
      levels: levelReferenceData,
    };
  }

  async create(input: CreateStudentRepositoryInput): Promise<Student> {
    const birthYear = new Date(input.birthDate).getUTCFullYear();

    const student = makeStudent({
      name: input.name,
      photo: input.photo ?? undefined,
      gender: input.gender,
      birthDate: input.birthDate,
      birthYear,
      level: input.level,
      parentId: input.parentId ?? undefined,
      classId: input.classId ?? null,
      phone: input.phone,
      status: input.status,
    });

    this.items.push(student);

    return student;
  }

  async update(
    id: string,
    input: UpdateStudentRepositoryInput,
  ): Promise<Student> {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex < 0) {
      throw new AppError(404, 'Student not found');
    }

    const currentStudent = this.items[itemIndex];
    const birthYear = new Date(input.birthDate).getUTCFullYear();
    const classAssignmentPlan = StudentClassAssignmentPolicy.plan(
      currentStudent.classId ? [currentStudent.classId] : [],
      input.classId,
    );

    const updatedStudent: Student = {
      ...currentStudent,
      name: input.name,
      photo: input.photo ?? undefined,
      gender: input.gender,
      birthDate: input.birthDate,
      birthYear,
      level: input.level,
      parentId: input.parentId ?? undefined,
      classId: classAssignmentPlan.nextClassId,
      phone: input.phone,
      status: input.status,
    };

    this.items[itemIndex] = updatedStudent;

    return updatedStudent;
  }

  async remove(id: string): Promise<Student> {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex < 0) {
      throw new AppError(404, 'Student not found');
    }

    const [removedStudent] = this.items.splice(itemIndex, 1);

    return removedStudent;
  }
}
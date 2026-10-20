import { AppError } from '@/shared/errors/app-error';
import type {
  CreateExStudentRepositoryInput,
  ListExStudentsRepositoryParams,
  UpdateExStudentRepositoryInput,
} from '@/domain/ex-students/application/repositories/ex-students-repository';
import { ExStudentsRepository } from '@/domain/ex-students/application/repositories/ex-students-repository';
import type { ExStudent } from '@/domain/ex-students/enterprise/entities/ex-student';
import { paginateItems } from '@/domain/shared/pagination/pagination-utils';
import { makeExStudent } from '../factories/make-ex-student';

export class InMemoryExStudentsRepository implements ExStudentsRepository {
  public items: ExStudent[] = [];

  async list(params?: ListExStudentsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase();
    const category = params?.category?.trim();

    const filtered = this.items.filter((student) => {
      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(search) ||
        student.exitReason.toLowerCase().includes(search) ||
        student.lastCompetition.toLowerCase().includes(search);
      const matchesCategory = !category || student.category === category;
      const matchesStudent = !params?.studentId || student.studentId === params.studentId;
      const matchesState = params?.includeHistory || (!student.reactivatedAt && !student.voidedAt);

      return matchesSearch && matchesCategory && matchesStudent && matchesState;
    });

    return paginateItems([...filtered], params);
  }

  async summary() {
    const activeItems = this.items.filter((item) => !item.reactivatedAt && !item.voidedAt);
    return {
      total: activeItems.length,
      categoriesCount: new Set(
        activeItems.map((student) => student.category).filter(Boolean),
      ).size,
      totalAchievements: activeItems.reduce(
        (sum, student) => sum + student.achievements,
        0,
      ),
      archivedStudentIds: activeItems
        .map((student) => student.studentId)
        .filter((value): value is string => Boolean(value)),
    };
  }

  async create(input: CreateExStudentRepositoryInput): Promise<ExStudent> {
    const exStudent = makeExStudent({
      studentId: input.studentId,
      exitDate: input.exitDate,
      exitReason: input.exitReason,
      exitNotes: input.exitNotes ?? '',
      lastCompetition: input.lastCompetition ?? '',
    });

    if (this.items.some((item) => item.studentId === input.studentId && !item.reactivatedAt && !item.voidedAt)) {
      throw new AppError(409, 'Student already has an active departure');
    }
    this.items.push(exStudent);
    return exStudent;
  }

  async update(
    id: string,
    input: UpdateExStudentRepositoryInput,
  ): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id);
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found');

    if (this.items[itemIndex].reactivatedAt || this.items[itemIndex].voidedAt) throw new AppError(409, 'Historical departures are immutable');
    const updatedExStudent: ExStudent = {
      ...this.items[itemIndex],
      exitDate: input.exitDate,
      exitReason: input.exitReason,
      exitNotes: input.exitNotes ?? '',
      achievements: input.achievements,
      lastCompetition: input.lastCompetition,
    };

    this.items[itemIndex] = updatedExStudent;
    return updatedExStudent;
  }

  async remove(id: string): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id);
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found');

    const existing = this.items[itemIndex];
    if (existing.reactivatedAt || existing.voidedAt) throw new AppError(409, 'Historical departures cannot be voided twice');
    const voided = { ...existing, voidedAt: new Date().toISOString() };
    this.items[itemIndex] = voided;
    return voided;
  }

  async reactivate(id: string): Promise<ExStudent> {
    const itemIndex = this.items.findIndex((item) => item.id === id);
    if (itemIndex < 0) throw new AppError(404, 'Ex-student not found');

    const existing = this.items[itemIndex];
    if (existing.reactivatedAt || existing.voidedAt) throw new AppError(409, 'Student departure is already closed');
    const reactivated = { ...existing, reactivatedAt: new Date().toISOString() };
    this.items[itemIndex] = reactivated;
    return reactivated;
  }
}

import { CATEGORY_GROUPS } from '@/shared/lib/categories';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';
import { AppError } from '@/shared/errors/app-error';
import type {
  AssignClassTeacherRepositoryInput,
  ClassCategoryReference,
  CreateClassRepositoryInput,
  ListClassesRepositoryParams,
  TransferStudentRepositoryInput,
  TransferTeacherRepositoryInput,
  UpdateClassRepositoryInput,
  UpdateClassTeacherRoleRepositoryInput,
} from '@/domain/classes/application/repositories/classes-repository';
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository';
import { ClassTeacherPolicy } from '@/domain/classes/application/services/class-teacher-policy';
import type { ClassEntity } from '@/domain/classes/enterprise/entities/class';
import { paginateItems } from '@/domain/shared/pagination/pagination-utils';
import { makeClassEntity } from '../factories/make-class';

function toTeacherName(teacherId: string) {
  return `Professor ${teacherId.slice(0, 4)}`;
}

const categoryReferenceData: ClassCategoryReference[] = CATEGORY_GROUPS.flatMap(
  (group) =>
    group.categories.map((category) => ({
      id: parseCategoryValue(category),
      name: parseCategoryValue(category),
    })),
);

export class InMemoryClassesRepository implements ClassesRepository {
  public items: ClassEntity[] = [];

  async list(params?: ListClassesRepositoryParams) {
    const search = params?.search?.trim().toLowerCase();
    const category = params?.category?.trim();
    const day = params?.day?.trim();
    const status = params?.status?.trim();
    const poolId = params?.poolId?.trim();

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.teachers.some((teacher) =>
          teacher.toLowerCase().includes(search),
        ) ||
        item.pool.toLowerCase().includes(search);
      const matchesCategory = !category || item.categories.includes(category);
      const matchesDay =
        !day ||
        item.schedules.some((schedule) => schedule.dayOfWeek === day) ||
        item.dayOfWeek === day;
      const matchesStatus = !status || item.status === status;
      const matchesPool = !poolId || item.poolId === poolId;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesDay &&
        matchesStatus &&
        matchesPool
      );
    });

    return paginateItems(filteredItems, params);
  }

  async listCategoryReferenceData(): Promise<ClassCategoryReference[]> {
    return categoryReferenceData;
  }

  async create(input: CreateClassRepositoryInput): Promise<ClassEntity> {
    const normalizedTeachers = ClassTeacherPolicy.normalizeAssignments(
      input.classTeachers,
    );
    const classTeachers = normalizedTeachers.map((teacher) => ({
      id: crypto.randomUUID(),
      teacherId: teacher.teacherId,
      teacherName: toTeacherName(teacher.teacherId),
      role: teacher.role,
    }));

    const classItem = makeClassEntity({
      name: input.name,
      category: input.categories.join(', '),
      categories: input.categories,
      categoryIds: input.categoryIds,
      schedules: input.schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        ...schedule,
      })),
      dayOfWeek: input.schedules[0]?.dayOfWeek ?? 'Segunda',
      startTime: input.schedules[0]?.startTime ?? '08:00',
      endTime: input.schedules[0]?.endTime ?? '09:00',
      maxStudents: input.maxStudents,
      poolId: input.poolId ?? undefined,
      status: input.status,
      classTeachers,
      teachers: classTeachers.map((teacher) => teacher.teacherName),
    });

    this.items.push(classItem);
    return classItem;
  }

  async update(
    id: string,
    input: UpdateClassRepositoryInput,
  ): Promise<ClassEntity> {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex < 0) throw new AppError(404, 'Class not found');

    const normalizedTeachers = ClassTeacherPolicy.normalizeAssignments(
      input.classTeachers,
    );
    const classTeachers = normalizedTeachers.map((teacher) => ({
      id: crypto.randomUUID(),
      teacherId: teacher.teacherId,
      teacherName: toTeacherName(teacher.teacherId),
      role: teacher.role,
    }));

    const updatedClass: ClassEntity = {
      ...this.items[itemIndex],
      name: input.name,
      category: input.categories.join(', '),
      categories: input.categories,
      categoryIds: input.categoryIds,
      schedules: input.schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        ...schedule,
      })),
      dayOfWeek: input.schedules[0]?.dayOfWeek ?? 'Segunda',
      startTime: input.schedules[0]?.startTime ?? '08:00',
      endTime: input.schedules[0]?.endTime ?? '09:00',
      maxStudents: input.maxStudents,
      poolId: input.poolId ?? undefined,
      status: input.status,
      classTeachers,
      teachers: classTeachers.map((teacher) => teacher.teacherName),
    };

    this.items[itemIndex] = updatedClass;
    return updatedClass;
  }

  async addTeacher(
    classId: string,
    input: AssignClassTeacherRepositoryInput,
  ): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId);

    if (!classItem) throw new AppError(404, 'Class not found');
    if (
      classItem.classTeachers.some(
        (teacher) => teacher.teacherId === input.teacherId,
      )
    ) {
      throw new AppError(409, 'Teacher already assigned to class');
    }

    classItem.classTeachers.push({
      id: crypto.randomUUID(),
      teacherId: input.teacherId,
      teacherName: toTeacherName(input.teacherId),
      role: ClassTeacherPolicy.resolveAddedRole(
        classItem.classTeachers,
        input.role,
      ),
    });
    classItem.teachers = classItem.classTeachers.map(
      (teacher) => teacher.teacherName,
    );

    return classItem;
  }

  async updateTeacherRole(
    classId: string,
    teacherId: string,
    input: UpdateClassTeacherRoleRepositoryInput,
  ): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId);
    if (!classItem) throw new AppError(404, 'Class not found');

    const teacher = classItem.classTeachers.find(
      (item) => item.teacherId === teacherId,
    );
    if (!teacher) throw new AppError(404, 'Teacher not found in class');

    const rolePlan = ClassTeacherPolicy.planRoleUpdate(
      classItem.classTeachers,
      teacherId,
      input.role,
    );

    if (rolePlan.demotedTeacherId) {
      const demotedTeacher = classItem.classTeachers.find(
        (item) => item.id === rolePlan.demotedTeacherId,
      );
      if (demotedTeacher) {
        demotedTeacher.role = 'assistant_coach';
      }
    }

    teacher.role = rolePlan.nextRole;
    return classItem;
  }

  async removeTeacher(
    classId: string,
    teacherId: string,
  ): Promise<ClassEntity> {
    const classItem = this.items.find((item) => item.id === classId);
    if (!classItem) throw new AppError(404, 'Class not found');

    const assignedTeacher = classItem.classTeachers.find(
      (item) => item.teacherId === teacherId,
    );
    if (!assignedTeacher) throw new AppError(404, 'Teacher not found in class');

    const removalPlan = ClassTeacherPolicy.planRemoval(
      classItem.classTeachers,
      teacherId,
    );

    classItem.classTeachers = classItem.classTeachers.filter(
      (item) => item.teacherId !== teacherId,
    );

    if (removalPlan.promotedTeacherId) {
      const promotedTeacher = classItem.classTeachers.find(
        (item) => item.id === removalPlan.promotedTeacherId,
      );
      if (promotedTeacher) {
        promotedTeacher.role = 'head_coach';
      }
    }

    classItem.teachers = classItem.classTeachers.map(
      (teacher) => teacher.teacherName,
    );

    return classItem;
  }

  async transferTeacher(
    input: TransferTeacherRepositoryInput,
  ): Promise<ClassEntity> {
    const sourceClass = this.items.find(
      (item) => item.id === input.fromClassId,
    );
    const targetClass = this.items.find((item) => item.id === input.toClassId);

    if (!sourceClass) throw new AppError(404, 'Source class not found');
    if (!targetClass) throw new AppError(404, 'Target class not found');

    const teacher = sourceClass.classTeachers.find(
      (item) => item.teacherId === input.teacherId,
    );
    if (!teacher) throw new AppError(404, 'Teacher not found in source class');
    if (targetClass.classTeachers.some((item) => item.teacherId === input.teacherId)) {
      throw new AppError(409, 'Teacher already assigned to target class');
    }

    const transferPlan = ClassTeacherPolicy.planTransfer(
      sourceClass.classTeachers,
      targetClass.classTeachers,
      teacher,
    );

    sourceClass.classTeachers = sourceClass.classTeachers.filter(
      (item) => item.teacherId !== input.teacherId,
    );

    if (transferPlan.sourcePromotedTeacherId) {
      const promotedTeacher = sourceClass.classTeachers.find(
        (item) => item.id === transferPlan.sourcePromotedTeacherId,
      );
      if (promotedTeacher) {
        promotedTeacher.role = 'head_coach';
      }
    }

    sourceClass.teachers = sourceClass.classTeachers.map(
      (item) => item.teacherName,
    );

    targetClass.classTeachers.push({
      ...teacher,
      id: crypto.randomUUID(),
      role: transferPlan.targetRole,
    });
    targetClass.teachers = targetClass.classTeachers.map(
      (item) => item.teacherName,
    );

    return targetClass;
  }

  async transferStudent(
    input: TransferStudentRepositoryInput,
  ): Promise<ClassEntity> {
    const sourceClass = this.items.find(
      (item) => item.id === input.fromClassId,
    );
    const targetClass = this.items.find((item) => item.id === input.toClassId);

    if (!sourceClass) throw new AppError(404, 'Source class not found');
    if (!targetClass) throw new AppError(404, 'Target class not found');

    const student = sourceClass.students.find(
      (item) => item.id === input.studentId,
    );
    if (!student) throw new AppError(404, 'Student not found in source class');
    if (targetClass.students.some((item) => item.id === input.studentId)) {
      throw new AppError(409, 'Student already assigned to target class');
    }

    sourceClass.students = sourceClass.students.filter(
      (item) => item.id !== input.studentId,
    );
    sourceClass.enrolledStudents = sourceClass.students.length;

    targetClass.students.push(student);
    targetClass.enrolledStudents = targetClass.students.length;

    return targetClass;
  }

  async remove(id: string): Promise<ClassEntity> {
    const itemIndex = this.items.findIndex((item) => item.id === id);
    if (itemIndex < 0) throw new AppError(404, 'Class not found');

    const [removedClass] = this.items.splice(itemIndex, 1);
    return removedClass;
  }
}
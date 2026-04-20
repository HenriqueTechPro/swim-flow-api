type TeacherRole = 'head_coach' | 'assistant_coach';

type TeacherAssignment = {
  id: string;
  teacherId: string;
  role: TeacherRole;
};

export interface ClassTeacherRoleUpdatePlan {
  demotedTeacherId: string | null;
  nextRole: TeacherRole;
}

export interface ClassTeacherRemovalPlan {
  promotedTeacherId: string | null;
}

export interface ClassTeacherTransferPlan {
  sourcePromotedTeacherId: string | null;
  targetRole: TeacherRole;
}

export class ClassTeacherPolicy {
  static normalizeAssignments<T extends { role: TeacherRole }>(
    classTeachers: readonly T[],
  ): T[] {
    let headCoachAlreadyAssigned = false;

    return classTeachers.map((teacher) => {
      if (teacher.role === 'head_coach' && !headCoachAlreadyAssigned) {
        headCoachAlreadyAssigned = true;
        return { ...teacher, role: 'head_coach' };
      }

      return { ...teacher, role: 'assistant_coach' };
    });
  }

  static resolveAddedRole(
    existingTeachers: readonly Pick<TeacherAssignment, 'role'>[],
    requestedRole: TeacherRole,
  ): TeacherRole {
    if (
      requestedRole === 'head_coach' &&
      existingTeachers.some((teacher) => teacher.role === 'head_coach')
    ) {
      return 'assistant_coach';
    }

    return requestedRole;
  }

  static planRoleUpdate(
    existingTeachers: readonly TeacherAssignment[],
    teacherId: string,
    requestedRole: TeacherRole,
  ): ClassTeacherRoleUpdatePlan {
    return {
      demotedTeacherId:
        requestedRole === 'head_coach'
          ? existingTeachers.find(
              (teacher) =>
                teacher.role === 'head_coach' && teacher.teacherId !== teacherId,
            )?.id ?? null
          : null,
      nextRole: requestedRole,
    };
  }

  static planRemoval(
    existingTeachers: readonly TeacherAssignment[],
    teacherId: string,
  ): ClassTeacherRemovalPlan {
    const removedTeacher = existingTeachers.find(
      (teacher) => teacher.teacherId === teacherId,
    );
    const remainingTeachers = existingTeachers.filter(
      (teacher) => teacher.teacherId !== teacherId,
    );

    if (removedTeacher?.role !== 'head_coach') {
      return { promotedTeacherId: null };
    }

    if (remainingTeachers.some((teacher) => teacher.role === 'head_coach')) {
      return { promotedTeacherId: null };
    }

    return {
      promotedTeacherId: remainingTeachers[0]?.id ?? null,
    };
  }

  static planTransfer(
    sourceTeachers: readonly TeacherAssignment[],
    targetTeachers: readonly Pick<TeacherAssignment, 'role'>[],
    sourceTeacher: Pick<TeacherAssignment, 'teacherId' | 'role'>,
  ): ClassTeacherTransferPlan {
    return {
      sourcePromotedTeacherId:
        sourceTeacher.role === 'head_coach'
          ? sourceTeachers.find(
              (teacher) => teacher.teacherId !== sourceTeacher.teacherId,
            )?.id ?? null
          : null,
      targetRole:
        sourceTeacher.role === 'head_coach' &&
        targetTeachers.some((teacher) => teacher.role === 'head_coach')
          ? 'assistant_coach'
          : sourceTeacher.role,
    };
  }
}
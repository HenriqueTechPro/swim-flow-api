export interface StudentClassAssignmentPlan {
  classIdsToClose: string[];
  nextClassId: string | null;
  shouldCreateNextClassLink: boolean;
}

export class StudentClassAssignmentPolicy {
  static plan(
    activeClassIds: readonly string[],
    requestedClassId?: string | null,
  ): StudentClassAssignmentPlan {
    const currentClassIds = [...new Set(activeClassIds.filter(Boolean))];
    const nextClassId = requestedClassId?.trim() || null;

    if (!nextClassId) {
      return {
        classIdsToClose: currentClassIds,
        nextClassId: null,
        shouldCreateNextClassLink: false,
      };
    }

    if (currentClassIds.includes(nextClassId)) {
      return {
        classIdsToClose: currentClassIds.filter((classId) => classId !== nextClassId),
        nextClassId,
        shouldCreateNextClassLink: false,
      };
    }

    return {
      classIdsToClose: currentClassIds,
      nextClassId,
      shouldCreateNextClassLink: true,
    };
  }
}
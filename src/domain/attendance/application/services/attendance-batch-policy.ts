import type { SaveAttendanceBatchRequest } from '../dtos/attendance-requests';
import type { AttendanceBatchContext } from '../repositories/attendance-repository';
import { AppError } from '@/shared/errors/app-error';

function toAttendanceRecordKey(input: {
  studentId: string;
  classId: string;
  date: string;
}) {
  return `${input.studentId}:${input.classId}:${input.date}`;
}

function toStudentClassKey(input: { studentId: string; classId: string }) {
  return `${input.studentId}:${input.classId}`;
}

export class AttendanceBatchPolicy {
  static assertValid(
    input: SaveAttendanceBatchRequest,
    context: AttendanceBatchContext,
  ) {
    const duplicatedKeys = this.findDuplicatedKeys(input);
    if (duplicatedKeys.length > 0) {
      throw new AppError(
        422,
        'Duplicate attendance records found in request batch',
      );
    }

    const studentIds = [...new Set(input.records.map((record) => record.studentId))];
    const classIds = [...new Set(input.records.map((record) => record.classId))];
    const existingStudentIds = new Set(context.existingStudentIds);
    const existingClassIds = new Set(context.existingClassIds);

    const missingStudentIds = studentIds.filter(
      (studentId) => !existingStudentIds.has(studentId),
    );
    const missingClassIds = classIds.filter(
      (classId) => !existingClassIds.has(classId),
    );

    if (missingStudentIds.length > 0) {
      throw new AppError(
        422,
        `Students not found: ${missingStudentIds.join(', ')}`,
      );
    }

    if (missingClassIds.length > 0) {
      throw new AppError(422, `Classes not found: ${missingClassIds.join(', ')}`);
    }

    const validLinks = new Set(
      context.activeStudentClassLinks.map((link) => toStudentClassKey(link)),
    );
    const invalidLinks = input.records.filter(
      (record) => !validLinks.has(toStudentClassKey(record)),
    );

    if (invalidLinks.length > 0) {
      throw new AppError(
        422,
        `Students without active class link: ${invalidLinks
          .map((record) => `${record.studentId}:${record.classId}`)
          .join(', ')}`,
      );
    }
  }

  private static findDuplicatedKeys(input: SaveAttendanceBatchRequest) {
    const duplicatedKeys = new Set<string>();
    const seenKeys = new Set<string>();

    for (const record of input.records) {
      const key = toAttendanceRecordKey(record);
      if (seenKeys.has(key)) {
        duplicatedKeys.add(key);
      }
      seenKeys.add(key);
    }

    return [...duplicatedKeys];
  }
}
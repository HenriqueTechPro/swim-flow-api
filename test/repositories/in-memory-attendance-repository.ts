import type { SaveAttendanceBatchRequest } from '@/domain/attendance/application/dtos/attendance-requests';
import {
  AttendanceRepository,
  type AttendanceBatchContext,
  type ListAttendanceRepositoryParams,
  type AttendanceSummary,
  type AttendanceSummaryParams,
} from '@/domain/attendance/application/repositories/attendance-repository';
import type { AttendanceRecord } from '@/domain/attendance/enterprise/entities/attendance-record';
import { makeAttendanceRecord } from '../factories/make-attendance-record';

export class InMemoryAttendanceRepository implements AttendanceRepository {
  public items: AttendanceRecord[] = [];
  public validStudentClassLinks = new Set<string>();
  public studentNames = new Map<string, string>();
  public existingStudentIds = new Set<string>();
  public existingClassIds = new Set<string>();
  public classStudentIds = new Map<string, string[]>();

  async list(params?: ListAttendanceRepositoryParams) {
    const page = Math.max(1, params?.page ?? 1);
    const perPage = Math.min(100, Math.max(1, params?.perPage ?? 20));
    const filtered = this.items.filter((item) => {
      const studentName =
        this.studentNames.get(item.studentId)?.toLowerCase() ?? '';
      const matchesSearch =
        !params?.search ||
        studentName.includes(params.search.trim().toLowerCase());
      const matchesStartDate =
        !params?.startDate || item.date >= params.startDate;
      const matchesEndDate = !params?.endDate || item.date <= params.endDate;
      const matchesClass = !params?.classId || item.classId === params.classId;
      const matchesStudent =
        !params?.studentId || item.studentId === params.studentId;
      const matchesStatus = !params?.status || item.status === params.status;

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesClass &&
        matchesStudent &&
        matchesStatus
      );
    });
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      perPage,
    };
  }

  async summary(params?: AttendanceSummaryParams): Promise<AttendanceSummary> {
    const date = params?.date?.trim();
    const startDate = (params?.startDate?.trim() || date) ?? undefined;
    const endDate = (params?.endDate?.trim() || date) ?? undefined;
    const classId = params?.classId?.trim();
    const studentId = params?.studentId?.trim();

    const filteredRecords = this.items.filter((item) => {
      const matchesStartDate = !startDate || item.date >= startDate;
      const matchesEndDate = !endDate || item.date <= endDate;
      const matchesClass = !classId || item.classId === classId;
      const matchesStudent = !studentId || item.studentId === studentId;

      return matchesStartDate && matchesEndDate && matchesClass && matchesStudent;
    });

    const classIds = classId
      ? [classId]
      : Array.from(
          new Set([
            ...this.classStudentIds.keys(),
            ...filteredRecords.map((record) => record.classId),
          ]),
        );

    const classSummaries = classIds.map((currentClassId) => {
      const classRecords = filteredRecords.filter(
        (record) => record.classId === currentClassId,
      );
      const activeStudentIds = (
        this.classStudentIds.get(currentClassId) ?? []
      ).filter((currentStudentId) => !studentId || currentStudentId === studentId);
      const totalStudents =
        activeStudentIds.length > 0
          ? activeStudentIds.length
          : new Set(classRecords.map((record) => record.studentId)).size;
      const recordedStudents = new Set(
        classRecords.map((record) => record.studentId),
      ).size;
      const lastSavedAt = classRecords
        .map((record) => record.savedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

        return {
          classId: currentClassId,
        totalStudents,
          recordedStudents,
        presentCount: classRecords.filter((record) => record.status === 'present')
          .length,
        absentCount: classRecords.filter((record) => record.status === 'absent')
          .length,
        lateCount: classRecords.filter((record) => record.status === 'late').length,
        justifiedCount: classRecords.filter(
          (record) => record.status === 'justified',
        ).length,
        isCompleted:
          totalStudents > 0 && recordedStudents >= totalStudents,
          savedAt: lastSavedAt,
        };
      });

    const studentIds = studentId
      ? [studentId]
      : Array.from(new Set(filteredRecords.map((record) => record.studentId)));

    const studentSummaries = studentIds.map((currentStudentId) => {
      const studentRecords = filteredRecords.filter(
        (record) => record.studentId === currentStudentId,
      );
      const totalClasses = studentRecords.length;
      const presentCount = studentRecords.filter(
        (record) => record.status === 'present',
      ).length;
      const absentCount = studentRecords.filter(
        (record) => record.status === 'absent',
      ).length;
      const lateCount = studentRecords.filter(
        (record) => record.status === 'late',
      ).length;
      const justifiedCount = studentRecords.filter(
        (record) => record.status === 'justified',
      ).length;
      const attendancePercentage =
        totalClasses > 0
          ? Math.round(
              ((presentCount + lateCount + justifiedCount) / totalClasses) * 100,
            )
          : 0;

      return {
        studentId: currentStudentId,
        totalClasses,
        presentCount,
        absentCount,
        lateCount,
        justifiedCount,
        attendancePercentage,
      };
    });

    const totalStudents = classSummaries.reduce(
      (sum, item) => sum + item.totalStudents,
      0,
    );
    const studentsWithAttendance = new Set(
      filteredRecords.map((record) => record.studentId),
    ).size;
    const presentCount = filteredRecords.filter(
      (record) => record.status === 'present',
    ).length;
    const absentCount = filteredRecords.filter(
      (record) => record.status === 'absent',
    ).length;
    const lateCount = filteredRecords.filter(
      (record) => record.status === 'late',
    ).length;
    const justifiedCount = filteredRecords.filter(
      (record) => record.status === 'justified',
    ).length;
    const attendanceRate =
      studentsWithAttendance > 0
        ? Math.round(
            ((presentCount + lateCount + justifiedCount) / studentsWithAttendance) *
              100,
          )
        : 0;
    const lastSavedAt = filteredRecords
      .map((record) => record.savedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    return {
      date,
      startDate,
      endDate,
      totalClasses: classSummaries.length,
      completedClasses: classSummaries.filter((item) => item.isCompleted).length,
      pendingClasses: classSummaries.filter(
        (item) => item.totalStudents > 0 && !item.isCompleted,
      ).length,
      totalStudents,
      studentsWithAttendance,
      presentCount,
      absentCount,
      lateCount,
      justifiedCount,
      attendanceRate,
      classes: classSummaries,
      students: studentSummaries,
      lastSavedAt,
    };
  }

  async getBatchContext(
    input: SaveAttendanceBatchRequest,
  ): Promise<AttendanceBatchContext> {
    const studentIds = [...new Set(input.records.map((record) => record.studentId))];
    const classIds = [...new Set(input.records.map((record) => record.classId))];

    return {
      existingStudentIds:
        this.existingStudentIds.size > 0
          ? studentIds.filter((studentId) => this.existingStudentIds.has(studentId))
          : studentIds,
      existingClassIds:
        this.existingClassIds.size > 0
          ? classIds.filter((classId) => this.existingClassIds.has(classId))
          : classIds,
      activeStudentClassLinks:
        this.validStudentClassLinks.size > 0
          ? input.records
              .filter((record) =>
                this.validStudentClassLinks.has(`${record.studentId}:${record.classId}`),
              )
              .map((record) => ({
                studentId: record.studentId,
                classId: record.classId,
              }))
          : input.records.map((record) => ({
              studentId: record.studentId,
              classId: record.classId,
            })),
    };
  }

  async saveBatch(
    input: SaveAttendanceBatchRequest,
  ): Promise<AttendanceRecord[]> {
    const savedRecords = input.records.map((record) => {
      const existingIndex = this.items.findIndex(
        (item) =>
          item.studentId === record.studentId &&
          item.classId === record.classId &&
          item.date === record.date,
      );

      const nextRecord = makeAttendanceRecord({
        ...(existingIndex >= 0 ? this.items[existingIndex] : {}),
        ...record,
      });

      if (existingIndex >= 0) {
        this.items[existingIndex] = nextRecord;
      } else {
        this.items.push(nextRecord);
      }

      return nextRecord;
    });

    return savedRecords;
  }
}

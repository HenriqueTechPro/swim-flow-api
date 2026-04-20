import type {
  AttendanceClassSummary,
  AttendanceStudentSummary,
  AttendanceSummary,
} from '@/domain/attendance/application/repositories/attendance-repository';

export class AttendanceSummaryPresenter {
  static toHTTP(this: void, summary: AttendanceSummary) {
    return {
      date: summary.date,
      startDate: summary.startDate,
      endDate: summary.endDate,
      totalClasses: summary.totalClasses,
      completedClasses: summary.completedClasses,
      pendingClasses: summary.pendingClasses,
      totalStudents: summary.totalStudents,
      studentsWithAttendance: summary.studentsWithAttendance,
      presentCount: summary.presentCount,
      absentCount: summary.absentCount,
      lateCount: summary.lateCount,
      justifiedCount: summary.justifiedCount,
      attendanceRate: summary.attendanceRate,
      classes: summary.classes.map(AttendanceSummaryPresenter.classToHTTP),
      students: summary.students.map(AttendanceSummaryPresenter.studentToHTTP),
      lastSavedAt: summary.lastSavedAt,
    };
  }

  private static classToHTTP(classSummary: AttendanceClassSummary) {
    return {
      classId: classSummary.classId,
      totalStudents: classSummary.totalStudents,
      recordedStudents: classSummary.recordedStudents,
      presentCount: classSummary.presentCount,
      absentCount: classSummary.absentCount,
      lateCount: classSummary.lateCount,
      justifiedCount: classSummary.justifiedCount,
      isCompleted: classSummary.isCompleted,
      savedAt: classSummary.savedAt,
    };
  }

  private static studentToHTTP(studentSummary: AttendanceStudentSummary) {
    return {
      studentId: studentSummary.studentId,
      totalClasses: studentSummary.totalClasses,
      presentCount: studentSummary.presentCount,
      absentCount: studentSummary.absentCount,
      lateCount: studentSummary.lateCount,
      justifiedCount: studentSummary.justifiedCount,
      attendancePercentage: studentSummary.attendancePercentage,
    };
  }
}

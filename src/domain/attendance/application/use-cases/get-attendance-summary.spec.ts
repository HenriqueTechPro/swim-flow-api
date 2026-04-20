import { GetAttendanceSummaryUseCase } from './get-attendance-summary';
import { InMemoryAttendanceRepository } from '../../../../../test/repositories/in-memory-attendance-repository';
import { makeAttendanceRecord } from '../../../../../test/factories/make-attendance-record';

describe('GetAttendanceSummaryUseCase', () => {
  let attendanceRepository: InMemoryAttendanceRepository;
  let sut: GetAttendanceSummaryUseCase;

  beforeEach(() => {
    attendanceRepository = new InMemoryAttendanceRepository();
    attendanceRepository.classStudentIds.set('class-1', ['student-1', 'student-2']);
    attendanceRepository.classStudentIds.set('class-2', ['student-3']);
    sut = new GetAttendanceSummaryUseCase(attendanceRepository);
  });

  it('returns daily completion and status counters grouped by class and student', async () => {
    attendanceRepository.items.push(
      makeAttendanceRecord({
        studentId: 'student-1',
        classId: 'class-1',
        date: '2026-04-19',
        status: 'present',
        savedAt: '2026-04-19T10:00:00.000Z',
      }),
      makeAttendanceRecord({
        studentId: 'student-2',
        classId: 'class-1',
        date: '2026-04-19',
        status: 'late',
        savedAt: '2026-04-19T10:02:00.000Z',
      }),
    );

    const summary = await sut.execute({ date: '2026-04-19' });

    expect(summary.totalClasses).toBe(2);
    expect(summary.completedClasses).toBe(1);
    expect(summary.pendingClasses).toBe(1);
    expect(summary.totalStudents).toBe(3);
    expect(summary.studentsWithAttendance).toBe(2);
    expect(summary.presentCount).toBe(1);
    expect(summary.lateCount).toBe(1);
    expect(summary.classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classId: 'class-1',
          totalStudents: 2,
          recordedStudents: 2,
          isCompleted: true,
        }),
        expect.objectContaining({
          classId: 'class-2',
          totalStudents: 1,
          recordedStudents: 0,
          isCompleted: false,
        }),
      ]),
    );
    expect(summary.students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 'student-1',
          totalClasses: 1,
          attendancePercentage: 100,
        }),
      ]),
    );
  });
});

import { CreateStudentPhysicalAssessmentUseCase } from './create-student-physical-assessment';
import type { StudentPhysicalAssessmentsRepository } from '../repositories/student-physical-assessments-repository';
import { createStudentPhysicalAssessmentSchema } from '@/shared/contracts/student-physical-assessments';

describe('student physical assessment create boundary', () => {
  const studentId = '11111111-1111-4111-8111-111111111111';
  const create = jest.fn();
  const repository = { create } as unknown as StudentPhysicalAssessmentsRepository;
  const useCase = new CreateStudentPhysicalAssessmentUseCase(repository);

  beforeEach(() => create.mockReset());

  it('accepts valid partial anthropometry and saves it for the selected student', async () => {
    const body = createStudentPhysicalAssessmentSchema.parse({
      measuredOn: '2026-11-03', footLengthCm: 22.5, notes: 'Amostra',
    });
    create.mockResolvedValue({ studentId, measuredOn: body.measuredOn });
    await useCase.execute(studentId, body);
    expect(create).toHaveBeenCalledWith(studentId, body);
  });

  it('rejects empty measurement submissions without touching persistence', () => {
    expect(() => useCase.execute(studentId, { measuredOn: '2026-11-03' })).toThrow(
      'At least one physical measurement',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates, negative mass and unexpected properties', () => {
    expect(createStudentPhysicalAssessmentSchema.safeParse({
      measuredOn: '2026-02-30', heightCm: 140,
    }).success).toBe(false);
    expect(createStudentPhysicalAssessmentSchema.safeParse({
      measuredOn: '2026-11-02', bodyMassKg: -1,
    }).success).toBe(false);
    expect(createStudentPhysicalAssessmentSchema.safeParse({
      measuredOn: '2026-11-02', heightCm: 140, studentId,
    }).success).toBe(false);
  });
});

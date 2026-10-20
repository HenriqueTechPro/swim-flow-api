import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import { DeleteExStudentUseCase } from './delete-ex-student';
import { InMemoryExStudentsRepository } from '../../../../../test/repositories/in-memory-ex-students-repository';
import { makeExStudent } from '../../../../../test/factories/make-ex-student';

describe('DeleteExStudentUseCase', () => {
  let exStudentsRepository: InMemoryExStudentsRepository;
  let sut: DeleteExStudentUseCase;

  beforeEach(() => {
    exStudentsRepository = new InMemoryExStudentsRepository();
    sut = new DeleteExStudentUseCase(exStudentsRepository);
  });

  it('voids a mistaken departure without physically deleting its history', async () => {
    const existingExStudent = makeExStudent();
    exStudentsRepository.items.push(existingExStudent);

    const { exStudent } = await sut.execute(existingExStudent.id);

    expect(exStudent.id).toBe(existingExStudent.id);
    expect(exStudentsRepository.items).toHaveLength(1);
    expect(exStudentsRepository.items[0].voidedAt).toBeTruthy();
    expect((await exStudentsRepository.list()).items).toHaveLength(0);
  });

  it('throws when ex-student does not exist', async () => {
    await expect(() =>
      sut.execute('missing-ex-student'),
    ).rejects.toBeInstanceOf(AppError);
  });
});

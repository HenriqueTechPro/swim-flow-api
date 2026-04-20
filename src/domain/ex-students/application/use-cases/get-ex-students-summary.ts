import { ExStudentsRepository } from '../repositories/ex-students-repository';

export class GetExStudentsSummaryUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute() {
    const summary = await this.exStudentsRepository.summary();

    return {
      summary,
    };
  }
}

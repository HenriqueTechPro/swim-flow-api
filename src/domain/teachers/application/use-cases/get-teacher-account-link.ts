import { TeacherAccountLinksRepository } from '../repositories/teacher-account-links-repository';

export class GetTeacherAccountLinkUseCase {
  constructor(private readonly links: TeacherAccountLinksRepository) {}

  execute(teacherId: string) {
    return this.links.find(teacherId);
  }
}

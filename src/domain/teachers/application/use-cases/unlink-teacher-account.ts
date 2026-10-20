import { TeacherAccountLinksRepository } from '../repositories/teacher-account-links-repository';

export class UnlinkTeacherAccountUseCase {
  constructor(private readonly links: TeacherAccountLinksRepository) {}

  execute(input: { teacherId: string; actorProfileId: string }) {
    return this.links.unlink(input);
  }
}

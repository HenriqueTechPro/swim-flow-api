import { TeacherAccountLinksRepository } from '../repositories/teacher-account-links-repository';

export class LinkTeacherAccountUseCase {
  constructor(private readonly links: TeacherAccountLinksRepository) {}

  execute(input: { teacherId: string; profileId: string; actorProfileId: string }) {
    return this.links.link(input);
  }
}

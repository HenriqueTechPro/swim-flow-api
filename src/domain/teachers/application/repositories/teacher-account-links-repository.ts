export interface TeacherAccountLink {
  teacherId: string;
  profileId: string | null;
}

export abstract class TeacherAccountLinksRepository {
  abstract find(teacherId: string): Promise<TeacherAccountLink>;
  abstract link(input: {
    teacherId: string;
    profileId: string;
    actorProfileId: string;
  }): Promise<TeacherAccountLink>;
  abstract unlink(input: {
    teacherId: string;
    actorProfileId: string;
  }): Promise<TeacherAccountLink>;
}

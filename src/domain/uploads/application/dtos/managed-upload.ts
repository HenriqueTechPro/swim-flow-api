export type ManagedUploadTarget =
  | 'student-photo'
  | 'teacher-photo'
  | 'parent-photo'
  | 'profile-avatar';

export interface CreateManagedUploadRequest {
  target: ManagedUploadTarget;
  fileName: string;
  contentType: string;
  resourceId?: string | null;
}

export interface ManagedUploadResult {
  bucket: 'avatars';
  path: string;
  token: string;
  publicUrl: string;
}

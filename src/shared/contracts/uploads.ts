import { z } from 'zod';

export const managedUploadTargetValues = [
  'student-photo',
  'teacher-photo',
  'parent-photo',
  'profile-avatar',
] as const;

export const managedUploadContentTypeValues = [
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const createManagedUploadSchema = z
  .object({
    target: z.enum(managedUploadTargetValues),
    fileName: z.string().trim().min(1).max(255),
    contentType: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .pipe(z.enum(managedUploadContentTypeValues)),
    resourceId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.target === 'profile-avatar' && data.resourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resourceId'],
        message: 'Profile avatar uploads must not include a resource identifier',
      });
    }

    if (data.target !== 'profile-avatar' && !data.resourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resourceId'],
        message: 'A resource identifier is required for this upload target',
      });
    }
  });

export type ManagedUploadTarget = (typeof managedUploadTargetValues)[number];
export type ManagedUploadContentType =
  (typeof managedUploadContentTypeValues)[number];
export type CreateManagedUploadDto = z.infer<typeof createManagedUploadSchema>;

export interface ManagedUploadResponse {
  bucket: 'avatars';
  path: string;
  token: string;
  publicUrl: string;
}

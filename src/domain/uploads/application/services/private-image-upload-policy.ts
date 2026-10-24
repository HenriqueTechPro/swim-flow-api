import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@/shared/errors/app-error';
import type {
  CreateManagedUploadRequest,
  ManagedUploadTarget,
} from '../dtos/managed-upload';

export const MAX_PRIVATE_IMAGE_BYTES = 5 * 1024 * 1024;

const uuidSchema = z.string().uuid();
const extensions: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const targetPrefix: Record<ManagedUploadTarget, string> = {
  'profile-avatar': 'profiles',
  'student-photo': 'students',
  'teacher-photo': 'teachers',
  'parent-photo': 'parents',
};

export interface PrivateImageUploadInput extends CreateManagedUploadRequest {
  fileSizeBytes: number;
}

export interface PrivateImageUploadPlan {
  key: string;
  contentType: string;
  contentLength: number;
  visibility: 'private';
}

/**
 * Pure, side-effect-free policy for the FUTURE R2 adapter. Do not use the
 * caller's filename, bucket, URL or object path as a storage key.
 *
 * IMPORTANT: A plan is not an authorization grant. The HTTP use case must
 * authenticate the actor and verify permission for the resource before any
 * presigned URL is issued.
 */
export function planPrivateImageUpload(
  actorUserId: string,
  input: PrivateImageUploadInput,
  generateId: () => string = randomUUID,
): PrivateImageUploadPlan {
  if (!uuidSchema.safeParse(actorUserId).success) {
    throw new AppError(401, 'Invalid upload identity');
  }
  if (
    typeof input.fileName !== 'string' ||
    input.fileName.trim().length === 0 ||
    input.fileName.length > 255
  ) {
    throw new AppError(400, 'Invalid image filename');
  }
  if (!Number.isSafeInteger(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    throw new AppError(400, 'Invalid image file size');
  }
  if (input.fileSizeBytes > MAX_PRIVATE_IMAGE_BYTES) {
    throw new AppError(413, 'Image size exceeds the 5 MB limit');
  }

  const contentType = input.contentType.toLowerCase();
  const extension = extensions[contentType];
  if (!extension) {
    throw new AppError(400, 'Unsupported image content type');
  }

  const isAvatar = input.target === 'profile-avatar';
  if (!(input.target in targetPrefix)) {
    throw new AppError(400, 'Unsupported image target');
  }
  if (isAvatar && input.resourceId) {
    throw new AppError(400, 'Profile avatar cannot target another resource');
  }
  if (!isAvatar && !uuidSchema.safeParse(input.resourceId).success) {
    throw new AppError(
      400,
      'Image target requires a valid resource identifier',
    );
  }

  const objectId = generateId();
  if (!uuidSchema.safeParse(objectId).success) {
    throw new AppError(500, 'Cannot create an image object identifier');
  }

  // Even for avatars, use fresh random object keys. Overwriting an old
  // stable URL may let previously issued presigned PUT URLs replace it.
  const ownerId = isAvatar ? actorUserId : input.resourceId;
  const key = `${targetPrefix[input.target]}/${ownerId}/${objectId}.${extension}`;

  return {
    key,
    contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType,
    contentLength: input.fileSizeBytes,
    visibility: 'private',
  };
}

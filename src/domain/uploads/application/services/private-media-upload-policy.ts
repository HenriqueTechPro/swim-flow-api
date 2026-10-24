import { randomUUID } from 'node:crypto';
import type {
  CreateManagedUploadRequest,
  ManagedUploadTarget,
} from '../dtos/managed-upload';

export const MAX_PRIVATE_IMAGE_BYTES = 5 * 1024 * 1024;
export const PRIVATE_PUT_URL_TTL_SECONDS = 90;
export const PRIVATE_GET_URL_TTL_SECONDS = 60;

const validUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const contentTypeExtensions: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const objectPrefixByTarget: Record<ManagedUploadTarget, string> = {
  'profile-avatar': 'profiles',
  'student-photo': 'students',
  'teacher-photo': 'teachers',
  'parent-photo': 'parents',
};

export interface PrivateMediaUploadInput extends CreateManagedUploadRequest {
  /**
   * Browser File.size in bytes. Future S3 adapter MUST validate actual object
   * size and magic bytes after upload, before persisting a private reference.
   */
  fileSizeBytes: number;
}

export class PrivateMediaUploadPolicyError extends Error {
  constructor(
    public readonly code:
      | 'invalid-identity'
      | 'invalid-content-type'
      | 'invalid-file-size'
      | 'invalid-resource',
  ) {
    super(code);
    this.name = 'PrivateMediaUploadPolicyError';
  }
}

export function validatePrivateMediaUpload(
  actorId: string,
  input: PrivateMediaUploadInput,
): string {
  if (!validUuid.test(actorId)) {
    throw new PrivateMediaUploadPolicyError('invalid-identity');
  }
  const normalizedContentType = input.contentType.toLowerCase();
  const extension = contentTypeExtensions[normalizedContentType];
  if (!extension) {
    throw new PrivateMediaUploadPolicyError('invalid-content-type');
  }
  if (
    !Number.isSafeInteger(input.fileSizeBytes) ||
    input.fileSizeBytes <= 0 ||
    input.fileSizeBytes > MAX_PRIVATE_IMAGE_BYTES
  ) {
    throw new PrivateMediaUploadPolicyError('invalid-file-size');
  }
  if (input.target === 'profile-avatar') {
    if (input.resourceId !== null && input.resourceId !== undefined) {
      throw new PrivateMediaUploadPolicyError('invalid-resource');
    }
  } else if (!input.resourceId || !validUuid.test(input.resourceId)) {
    throw new PrivateMediaUploadPolicyError('invalid-resource');
  }
  return extension;
}

/**
 * Opaque, non-PII object key. The filename supplied by the browser is NEVER
 * interpolated into the S3 path. UUID scope is not sufficient authorization:
 * the use case must verify actor permissions and resource ownership first.
 *
 * Keys alone do not make a bucket private. The bucket must disallow public
 * access and issue short-lived signed GETs to authenticated users only.
 */
export function createPrivateMediaObjectKey(
  actorId: string,
  input: PrivateMediaUploadInput,
  objectId = randomUUID(),
): string {
  const extension = validatePrivateMediaUpload(actorId, input);
  if (!validUuid.test(objectId)) {
    throw new PrivateMediaUploadPolicyError('invalid-resource');
  }
  const ownerId =
    input.target === 'profile-avatar' ? actorId : input.resourceId!;
  return `private/${objectPrefixByTarget[input.target]}/${ownerId}/${objectId}.${extension}`;
}

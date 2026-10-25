import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import type { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { ConfirmPrivateMediaUploadUseCase } from './confirm-private-media-upload';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const UPLOAD = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-25T17:00:00.000Z');
const EXPIRY = new Date('2026-10-25T16:57:00.000Z');
const KEY = 'private/students/' + STUDENT + '/' + UPLOAD + '.png';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const pending = {
  id: UPLOAD,
  objectKey: KEY,
  target: 'student-photo' as const,
  resourceId: STUDENT,
  uploadedById: ACTOR,
  declaredContentType: 'image/png' as const,
  declaredSizeBytes: 1000,
  ticketExpiresAt: EXPIRY,
  status: 'PENDING' as const,
  verifiedAt: null,
};

function setup() {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: ACTOR, role: 'admin' }),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const objects = {
    findById: jest.fn().mockResolvedValue({ ...pending }),
    markVerifiedIfPending: jest.fn().mockResolvedValue(true),
    rejectIfPending: jest.fn().mockResolvedValue(true),
  };
  const storage = {
    headObject: jest.fn().mockResolvedValue({
      contentType: 'image/png',
      sizeBytes: 1000,
    }),
    readPrefix: jest.fn().mockResolvedValue(PNG),
  };
  const useCase = new ConfirmPrivateMediaUploadUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    objects as unknown as PrivateMediaObjectsRepository,
    storage as unknown as PrivateMediaStorageRepository,
  );
  return { useCase, profiles, resources, objects, storage };
}

describe('Private image confirmation (offline, no HTTP)', () => {
  it('validates HEAD bytes and signature before an atomic PENDING -> VERIFIED', async () => {
    const api = setup();
    expect(await api.useCase.execute(ACTOR, UPLOAD, NOW)).toEqual({
      uploadId: UPLOAD, status: 'VERIFIED',
    });
    expect(api.storage.headObject).toHaveBeenCalledWith(KEY);
    expect(api.storage.readPrefix).toHaveBeenCalledWith(KEY, 64);
    expect(api.objects.markVerifiedIfPending).toHaveBeenCalledWith(
      UPLOAD,
      new Date('2026-10-25T16:58:00.000Z'),
      NOW,
    );
    expect(api.objects.rejectIfPending).not.toHaveBeenCalled();
  });

  it('refuses confirmation until expiry plus settlement grace', async () => {
    const api = setup();
    api.objects.findById.mockResolvedValue({ ...pending,
      ticketExpiresAt: new Date('2026-10-25T16:59:00.000Z'),
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(api.storage.headObject).not.toHaveBeenCalled();
    expect(api.objects.markVerifiedIfPending).not.toHaveBeenCalled();
  });

  it('rejects mismatched bytes and never marks invalid data VERIFIED', async () => {
    const api = setup();
    api.storage.readPrefix.mockResolvedValue(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]));
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(api.objects.rejectIfPending).toHaveBeenCalledWith(
      UPLOAD,
      new Date('2026-10-25T16:58:00.000Z'),
    );
    expect(api.objects.markVerifiedIfPending).not.toHaveBeenCalled();
  });

  it('rejects observed MIME/length mismatch, not just magic bytes', async () => {
    const api = setup();
    api.storage.headObject.mockResolvedValue({
      contentType: 'image/jpeg', sizeBytes: 1000,
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toBeInstanceOf(AppError);
    expect(api.objects.rejectIfPending).toHaveBeenCalledTimes(1);
    expect(api.objects.markVerifiedIfPending).not.toHaveBeenCalled();
  });

  it('preserves PENDING after S3 outage or absent object for retry/cleanup', async () => {
    const api = setup();
    api.storage.headObject.mockRejectedValueOnce(new Error('temporarily offline'));
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toThrow('temporarily offline');
    api.storage.headObject.mockResolvedValueOnce(null);
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(api.objects.rejectIfPending).not.toHaveBeenCalled();
    expect(api.objects.markVerifiedIfPending).not.toHaveBeenCalled();
  });

  it('revokes authorization if admin loses role, resource disappears or actor differs', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'teacher' });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'admin' });
    api.resources.existsForTarget.mockResolvedValue(false);
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
    const other = '44444444-4444-4444-8444-444444444444';
    await expect(api.useCase.execute(other, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.storage.headObject).not.toHaveBeenCalled();
  });

  it('does not sign anything or verify malformed IDs and non-pending media', async () => {
    const api = setup();
    await expect(api.useCase.execute(ACTOR, '../bad', NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.objects.findById.mockResolvedValue({ ...pending, status: 'DELETED' });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(api.storage.headObject).not.toHaveBeenCalled();
  });

  it('provides idempotent re-confirmation after checking CURRENT permission', async () => {
    const api = setup();
    api.objects.findById.mockResolvedValue({ ...pending, status: 'VERIFIED', verifiedAt: NOW });
    expect(await api.useCase.execute(ACTOR, UPLOAD, NOW)).toEqual({
      uploadId: UPLOAD, status: 'VERIFIED',
    });
    expect(api.storage.headObject).not.toHaveBeenCalled();
  });

  it('does not report VERIFIED if a concurrent cleanup claimed the row', async () => {
    const api = setup();
    api.objects.markVerifiedIfPending.mockResolvedValue(false);
    api.objects.findById
      .mockResolvedValueOnce({ ...pending })
      .mockResolvedValueOnce({ ...pending, status: 'REJECTED' });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('treats a concurrent verification as idempotent after rechecking ACL', async () => {
    const api = setup();
    api.objects.markVerifiedIfPending.mockResolvedValue(false);
    api.objects.findById
      .mockResolvedValueOnce({ ...pending })
      .mockResolvedValueOnce({ ...pending, status: 'VERIFIED', verifiedAt: NOW });
    expect(await api.useCase.execute(ACTOR, UPLOAD, NOW)).toEqual({
      uploadId: UPLOAD, status: 'VERIFIED',
    });
    expect(api.profiles.findByUserId).toHaveBeenCalledTimes(2);
  });

  it('confirms self-avatar for authenticated user, not a foreign profile', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    api.objects.findById.mockResolvedValue({ ...pending,
      target: 'profile-avatar', resourceId: ACTOR,
    });
    expect(await api.useCase.execute(ACTOR, UPLOAD, NOW)).toMatchObject({
      status: 'VERIFIED',
    });
    api.objects.findById.mockResolvedValue({ ...pending,
      target: 'profile-avatar', resourceId: STUDENT,
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD, NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

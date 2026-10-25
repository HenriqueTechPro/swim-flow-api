import { AppError } from '@/shared/errors/app-error';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { PreparePrivateMediaUploadUseCase } from './prepare-private-media-upload';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const TEACHER = '33333333-3333-4333-8333-333333333333';

const photo = {
  target: 'student-photo' as const,
  resourceId: STUDENT,
  fileName: '../../foto-da-crianca.png',
  contentType: 'image/png',
  fileSizeBytes: 128,
};

function setup(role: 'admin' | 'teacher' | 'user' | null = 'admin') {
  const findByUserId = jest.fn().mockResolvedValue(
    role
      ? {
          id: ADMIN,
          role,
          permissions: [],
          fullName: 'Test',
          avatarUrl: null,
        }
      : null,
  );
  const existsForTarget = jest.fn().mockResolvedValue(true);
  const signUpload = jest.fn().mockResolvedValue({
    method: 'PUT',
    url: 'https://storage.example.invalid/signed-put?test-only',
    headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
    expiresInSeconds: 90,
  });
  const createPending = jest.fn().mockResolvedValue(undefined);
  const useCase = new PreparePrivateMediaUploadUseCase(
    { findByUserId } as unknown as AuthProfilesRepository,
    { existsForTarget } as unknown as ManagedUploadResourcesRepository,
    { signUpload } as unknown as PrivateMediaStorageRepository,
    { createPending } as unknown as PrivateMediaObjectsRepository,
  );
  return { useCase, findByUserId, existsForTarget, signUpload, createPending };
}

describe('Private S3 media permission and pending object registration', () => {
  it('allows an admin to sign for an existing student with no PII in the private key', async () => {
    const api = setup();
    const response = await api.useCase.execute(ADMIN, photo);
    expect(response).toEqual({
      uploadId: expect.any(String),
      method: 'PUT',
      uploadUrl: 'https://storage.example.invalid/signed-put?test-only',
      headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
      expiresInSeconds: 90,
    });
    expect(api.existsForTarget).toHaveBeenCalledWith('student-photo', STUDENT);
    const objectKey = api.signUpload.mock.calls[0][0].objectKey as string;
    expect(objectKey).toMatch(
      /^private\/students\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/,
    );
    expect(objectKey).not.toContain(photo.fileName);
    expect(api.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: response.uploadId,
        objectKey,
        uploadedById: ADMIN,
        resourceId: STUDENT,
        declaredContentType: 'image/png',
        declaredSizeBytes: 128,
        ticketExpiresAt: expect.any(Date),
      }),
    );
    expect(JSON.stringify(api.createPending.mock.calls)).not.toContain(
      'signed-put',
    );
  });

  it.each(['teacher', 'user'] as const)(
    'denies %s upload to a child without leaking resource existence',
    async (role) => {
      const api = setup(role);
      await expect(api.useCase.execute(ADMIN, photo)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(api.existsForTarget).not.toHaveBeenCalled();
      expect(api.signUpload).not.toHaveBeenCalled();
      expect(api.createPending).not.toHaveBeenCalled();
    },
  );

  it('allows every authenticated profile to change only its own avatar', async () => {
    const api = setup('user');
    api.signUpload.mockResolvedValueOnce({
      method: 'PUT',
      url: 'https://storage.example.invalid/signed-put?test-only',
      headers: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' },
      expiresInSeconds: 90,
    });
    const result = await api.useCase.execute(ADMIN, {
      target: 'profile-avatar',
      fileName: 'avatar.jpg',
      contentType: 'image/jpg',
      fileSizeBytes: 400,
    });
    expect(result.uploadId).toBeTruthy();
    expect(api.existsForTarget).not.toHaveBeenCalled();
    expect(api.signUpload).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^private\/profiles\//),
      contentType: 'image/jpeg',
    });
    expect(api.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: ADMIN,
        declaredContentType: 'image/jpeg',
      }),
    );
  });

  it('rejects cross-profile avatar IDs and oversized or malicious file types', async () => {
    const api = setup('admin');
    for (const invalid of [
      {
        target: 'profile-avatar' as const,
        resourceId: TEACHER,
        fileName: 'foo.jpg',
        contentType: 'image/jpeg',
        fileSizeBytes: 10,
      },
      { ...photo, fileSizeBytes: 5 * 1024 * 1024 + 1 },
      { ...photo, fileSizeBytes: 0 },
      { ...photo, contentType: 'image/svg+xml' },
    ]) {
      await expect(api.useCase.execute(ADMIN, invalid)).rejects.toBeInstanceOf(
        AppError,
      );
    }
    expect(api.signUpload).not.toHaveBeenCalled();
    expect(api.createPending).not.toHaveBeenCalled();
  });

  it('requires a current profile and an existing referenced resource', async () => {
    const absent = setup(null);
    await expect(absent.useCase.execute(ADMIN, photo)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(absent.signUpload).not.toHaveBeenCalled();

    const missing = setup();
    missing.existsForTarget.mockResolvedValue(false);
    await expect(missing.useCase.execute(ADMIN, photo)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(missing.signUpload).not.toHaveBeenCalled();
    expect(missing.createPending).not.toHaveBeenCalled();
  });

  it('never returns an unsigned ticket or persists metadata after S3 signing fails', async () => {
    const api = setup();
    api.signUpload.mockRejectedValueOnce(new Error('storage offline'));
    await expect(api.useCase.execute(ADMIN, photo)).rejects.toThrow(
      'storage offline',
    );
    expect(api.createPending).not.toHaveBeenCalled();
  });

  it('never returns a signed URL if writing the pending record fails', async () => {
    const api = setup();
    api.createPending.mockRejectedValueOnce(new Error('database offline'));
    await expect(api.useCase.execute(ADMIN, photo)).rejects.toThrow(
      'database offline',
    );
  });

  it('refuses an excessive TTL or unexpected signed header from the adapter', async () => {
    const api = setup();
    api.signUpload.mockResolvedValueOnce({
      method: 'PUT',
      url: 'https://storage.example.invalid/signed',
      headers: { 'Content-Type': 'image/gif' },
      expiresInSeconds: 500,
    });
    await expect(api.useCase.execute(ADMIN, photo)).rejects.toThrow(
      'Invalid private upload ticket',
    );
    expect(api.createPending).not.toHaveBeenCalled();
  });
});

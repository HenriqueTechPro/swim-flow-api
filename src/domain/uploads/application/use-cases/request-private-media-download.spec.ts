import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import type { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { RequestPrivateMediaDownloadUseCase } from './request-private-media-download';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const RESOURCE = '22222222-2222-4222-8222-222222222222';
const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const UPLOAD = '33333333-3333-4333-8333-333333333333';

const verified = {
  id: UPLOAD,
  status: 'VERIFIED',
  verifiedEtag: ETAG,
  uploadedById: ACTOR,
  target: 'student-photo',
  resourceId: RESOURCE,
  objectKey: 'private/students/' + RESOURCE + '/' + UPLOAD + '.png',
};

function setup() {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: ACTOR, role: 'admin' }),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const objects = { findById: jest.fn().mockResolvedValue(verified) };
  const storage = {
    signDownload: jest.fn().mockResolvedValue({
      url: 'https://storage.invalid/short-lived-private-ticket',
      expiresInSeconds: 60,
      headers: { 'If-Match': ETAG },
    }),
  };
  const useCase = new RequestPrivateMediaDownloadUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    objects as unknown as PrivateMediaObjectsRepository,
    storage as unknown as PrivateMediaStorageRepository,
  );
  return { useCase, profiles, resources, objects, storage };
}

describe('Verified private image read tickets', () => {
  it('rechecks current admin role and student existence before each GET', async () => {
    const api = setup();
    const result = await api.useCase.execute(ACTOR, UPLOAD);
    expect(result.expiresInSeconds).toBe(60);
    expect(api.storage.signDownload).toHaveBeenCalledWith(
      verified.objectKey,
      ETAG,
    );
    expect(api.resources.existsForTarget).toHaveBeenCalledWith(
      'student-photo',
      RESOURCE,
    );
  });

  it.each(['PENDING', 'REJECTED', 'DELETED'])(
    'does not read private image in %s state',
    async (status) => {
      const api = setup();
      api.objects.findById.mockResolvedValue({ ...verified, status });
      await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(api.storage.signDownload).not.toHaveBeenCalled();
    },
  );

  it('refuses verified media without an immutable recorded ETag', async () => {
    const api = setup();
    api.objects.findById.mockResolvedValue({ ...verified, verifiedEtag: null });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.storage.signDownload).not.toHaveBeenCalled();
  });

  it('denies teacher even when they know a verified child image UUID', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'teacher' });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.storage.signDownload).not.toHaveBeenCalled();
  });

  it('revokes access immediately when admin role or resource access changes', async () => {
    const api = setup();
    await api.useCase.execute(ACTOR, UPLOAD);
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'admin' });
    api.resources.existsForTarget.mockResolvedValue(false);
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.storage.signDownload).toHaveBeenCalledTimes(1);
  });

  it('allows self-avatar but not another profile avatar', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    api.objects.findById.mockResolvedValue({
      ...verified,
      target: 'profile-avatar',
      resourceId: ACTOR,
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).resolves.toMatchObject({
      expiresInSeconds: 60,
    });
    api.objects.findById.mockResolvedValue({
      ...verified,
      target: 'profile-avatar',
      resourceId: RESOURCE,
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects unexpectedly long or insecure signed GET', async () => {
    const api = setup();
    api.storage.signDownload.mockResolvedValue({
      url: 'http://public.invalid/object',
      expiresInSeconds: 600,
    });
    await expect(api.useCase.execute(ACTOR, UPLOAD)).rejects.toThrow(
      'Invalid private download ticket',
    );
  });
});

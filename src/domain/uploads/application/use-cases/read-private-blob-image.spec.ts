import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { ReadPrivateBlobImageUseCase } from './read-private-blob-image';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const MEDIA = '33333333-3333-4333-8333-333333333333';
const ETAG = '"123456789abcdef0123456789abcdef0"';
const KEY = `private/students/${STUDENT}/${MEDIA}.jpg`;

function setup() {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: ACTOR, role: 'admin' }),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const record = {
    id: MEDIA,
    objectKey: KEY,
    uploadedById: ACTOR,
    target: 'student-photo',
    resourceId: STUDENT,
    status: 'VERIFIED',
    verifiedEtag: ETAG,
    declaredSizeBytes: 8,
    declaredContentType: 'image/jpeg',
  };
  const records = { findById: jest.fn().mockResolvedValue(record) };
  const blobs = {
    get: jest.fn().mockResolvedValue({
      pathname: KEY,
      etag: ETAG,
      sizeBytes: 8,
      contentType: 'image/jpeg',
      stream: { async *[Symbol.asyncIterator]() { yield new Uint8Array(8); } },
    }),
  };
  const useCase = new ReadPrivateBlobImageUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    records as unknown as PrivateMediaObjectsRepository,
    blobs as unknown as PrivateBlobStorageRepository,
  );
  return { useCase, profiles, resources, records, blobs, record };
}

describe('Authenticated private Blob stream', () => {
  it('rechecks current administrator rights before streaming, with no-store headers', async () => {
    const api = setup();
    const result = await api.useCase.execute(ACTOR, MEDIA);
    expect(result.headers).toEqual({
      'Content-Type': 'image/jpeg',
      'Content-Length': '8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(api.blobs.get).toHaveBeenCalledWith(KEY, ETAG);
  });

  it('fails closed for revoked roles and deleted student', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'teacher' });
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'admin' });
    api.resources.existsForTarget.mockResolvedValue(false);
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.blobs.get).not.toHaveBeenCalled();
  });

  it('never streams pending, rejected, deleted or unversioned records', async () => {
    const api = setup();
    for (const status of ['PENDING', 'REJECTED', 'DELETED']) {
      api.records.findById.mockResolvedValueOnce({ ...api.record, status });
      await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
        statusCode: 404,
      });
    }
    api.records.findById.mockResolvedValueOnce({
      ...api.record,
      verifiedEtag: null,
    });
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.blobs.get).not.toHaveBeenCalled();
  });

  it('rejects changed bytes metadata, missing blob and malformed IDs', async () => {
    const api = setup();
    api.blobs.get.mockResolvedValueOnce({
      pathname: KEY, etag: ETAG, sizeBytes: 99,
      contentType: 'image/jpeg', stream: {},
    });
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.blobs.get.mockResolvedValueOnce(null);
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(api.useCase.execute(ACTOR, '../bad')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('allows a user to access only their own profile avatar', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    api.records.findById.mockResolvedValue({
      ...api.record,
      target: 'profile-avatar',
      resourceId: ACTOR,
    });
    await expect(api.useCase.execute(ACTOR, MEDIA)).resolves.toHaveProperty('stream');
    api.records.findById.mockResolvedValue({
      ...api.record,
      target: 'profile-avatar',
      resourceId: STUDENT,
    });
    await expect(api.useCase.execute(ACTOR, MEDIA)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

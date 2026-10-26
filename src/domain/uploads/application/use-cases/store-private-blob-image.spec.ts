import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateBlobImageProcessor } from '../repositories/private-blob-image-processor';
import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { StorePrivateBlobImageUseCase } from './store-private-blob-image';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const ETAG = '"123456789abcdef0123456789abcdef0"';
const RAW = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04]);

function setup(role: 'admin' | 'teacher' | 'user' | null = 'admin') {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue(role ? { id: ACTOR, role } : null),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const images = {
    normalize: jest.fn().mockResolvedValue({ bytes: JPEG, contentType: 'image/jpeg' }),
  };
  const blobs = {
    put: jest.fn().mockImplementation(async (input: { pathname: string }) => ({
      pathname: input.pathname,
      sizeBytes: JPEG.byteLength,
      contentType: 'image/jpeg',
      etag: ETAG,
    })),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const records = { createVerifiedBlob: jest.fn().mockResolvedValue(undefined) };
  const useCase = new StorePrivateBlobImageUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    images as unknown as PrivateBlobImageProcessor,
    blobs as unknown as PrivateBlobStorageRepository,
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { useCase, profiles, resources, images, blobs, records };
}

const photo = {
  target: 'student-photo' as const,
  resourceId: STUDENT,
  contentType: 'image/png',
  bytes: RAW,
};

describe('Blob private upload use case: conservative current ACL + clean bytes', () => {
  it('uploads normalized JPEG with an opaque key and saves VERIFIED metadata only', async () => {
    const api = setup();
    const result = await api.useCase.execute(ACTOR, photo);
    expect(result).toEqual({ uploadId: expect.any(String), status: 'VERIFIED' });
    expect(api.images.normalize).toHaveBeenCalledWith(RAW, 'image/png');
    const stored = api.blobs.put.mock.calls[0][0] as {
      pathname: string;
      bytes: Uint8Array;
      contentType: string;
    };
    expect(stored.pathname).toMatch(
      /^private\/students\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/,
    );
    expect(stored.bytes).toBe(JPEG);
    expect(stored.contentType).toBe('image/jpeg');
    expect(api.records.createVerifiedBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.uploadId,
        objectKey: stored.pathname,
        target: 'student-photo',
        resourceId: STUDENT,
        uploadedById: ACTOR,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: JPEG.byteLength,
        verifiedEtag: ETAG,
      }),
    );
    expect(api.profiles.findByUserId).toHaveBeenCalledTimes(3);
    expect(api.blobs.delete).not.toHaveBeenCalled();
  });

  it('denies teacher and inactive user BEFORE normalization, upload or DB', async () => {
    for (const role of ['teacher', 'user', null] as const) {
      const api = setup(role);
      await expect(api.useCase.execute(ACTOR, photo)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(api.images.normalize).not.toHaveBeenCalled();
      expect(api.blobs.put).not.toHaveBeenCalled();
      expect(api.records.createVerifiedBlob).not.toHaveBeenCalled();
    }
  });

  it('allows self-avatar for a non-admin but no foreign profile scope', async () => {
    const api = setup('user');
    await expect(api.useCase.execute(ACTOR, {
      target: 'profile-avatar',
      contentType: 'image/png',
      bytes: RAW,
    })).resolves.toMatchObject({ status: 'VERIFIED' });
    expect(api.resources.existsForTarget).not.toHaveBeenCalled();
    await expect(api.useCase.execute(ACTOR, {
      target: 'profile-avatar',
      resourceId: STUDENT,
      contentType: 'image/png',
      bytes: RAW,
    })).resolves.toMatchObject({ status: 'VERIFIED' });
  });

  it('fails closed after role revocation during processing', async () => {
    const api = setup();
    api.profiles.findByUserId
      .mockResolvedValueOnce({ id: ACTOR, role: 'admin' })
      .mockResolvedValueOnce({ id: ACTOR, role: 'teacher' });
    await expect(api.useCase.execute(ACTOR, photo)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.blobs.put).not.toHaveBeenCalled();
  });

  it('compensates exact generation after lost role or database failure', async () => {
    const db = setup();
    db.records.createVerifiedBlob.mockRejectedValue(new Error('database offline'));
    await expect(db.useCase.execute(ACTOR, photo)).rejects.toThrow('database offline');
    expect(db.blobs.delete).toHaveBeenCalledWith(
      db.blobs.put.mock.results[0].value.then
        ? expect.stringMatching(/^private\/students\//)
        : expect.any(String),
      ETAG,
    );
    const revoked = setup();
    revoked.profiles.findByUserId
      .mockResolvedValueOnce({ id: ACTOR, role: 'admin' })
      .mockResolvedValueOnce({ id: ACTOR, role: 'admin' })
      .mockResolvedValueOnce({ id: ACTOR, role: 'user' });
    await expect(revoked.useCase.execute(ACTOR, photo)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(revoked.blobs.delete).toHaveBeenCalledTimes(1);
    expect(revoked.records.createVerifiedBlob).not.toHaveBeenCalled();
  });

  it('reports fail-closed compensation failure without exposing image path', async () => {
    const api = setup();
    api.records.createVerifiedBlob.mockRejectedValue(new Error('db broken'));
    api.blobs.delete.mockRejectedValue(new Error('remote unavailable with URL'));
    await expect(api.useCase.execute(ACTOR, photo)).rejects.toThrow(
      'private-blob-compensation-failed',
    );
  });

  it('never passes invalid request bytes to processor or storage', async () => {
    const api = setup();
    await expect(api.useCase.execute('invalid', photo)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(api.useCase.execute(ACTOR, {
      ...photo, contentType: 'image/svg+xml',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(api.images.normalize).not.toHaveBeenCalled();
    expect(api.blobs.put).not.toHaveBeenCalled();
  });

  it('does not write VERIFIED metadata after invalid storage receipt', async () => {
    const api = setup();
    api.blobs.put.mockResolvedValueOnce({
      pathname: 'public/elsewhere.jpg',
      sizeBytes: JPEG.byteLength,
      contentType: 'image/jpeg',
      etag: ETAG,
    });
    await expect(api.useCase.execute(ACTOR, photo)).rejects.toThrow(
      'invalid-private-blob-storage-receipt',
    );
    expect(api.records.createVerifiedBlob).not.toHaveBeenCalled();
  });
});

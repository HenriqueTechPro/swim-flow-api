import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { AssignPrivateBlobImageUseCase } from './assign-private-blob-image';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const MEDIA = '33333333-3333-4333-8333-333333333333';
const PREVIOUS = '44444444-4444-4444-8444-444444444444';

const verified = {
  id: MEDIA,
  target: 'student-photo',
  resourceId: STUDENT,
  uploadedById: ACTOR,
  objectKey: `private/students/${STUDENT}/${MEDIA}.jpg`,
  status: 'VERIFIED',
  storageProvider: 'BLOB',
  ticketExpiresAt: null,
  verifiedEtag: '"aabbccddeeff00112233445566778899"',
};

function setup() {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: ACTOR, role: 'admin' }),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const records = {
    findById: jest.fn().mockResolvedValue(verified),
    assignActiveVerifiedBlob: jest.fn().mockResolvedValue(true),
  };
  const service = new AssignPrivateBlobImageUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { service, profiles, resources, records };
}

describe('Optimistic binding of only one VERIFIED private Blob per resource', () => {
  it('links a first private photo using null expected media', async () => {
    const api = setup();
    expect(await api.service.execute(ACTOR, MEDIA, null)).toEqual({
      mediaId: MEDIA,
      status: 'ACTIVE',
    });
    expect(api.records.assignActiveVerifiedBlob).toHaveBeenCalledWith({
      target: 'student-photo',
      resourceId: STUDENT,
      mediaId: MEDIA,
      expectedMediaId: null,
    });
  });

  it('replaces only the expected old reference, never silently overwrites', async () => {
    const api = setup();
    await api.service.execute(ACTOR, MEDIA, PREVIOUS);
    expect(api.records.assignActiveVerifiedBlob).toHaveBeenCalledWith({
      target: 'student-photo',
      resourceId: STUDENT,
      mediaId: MEDIA,
      expectedMediaId: PREVIOUS,
    });
    api.records.assignActiveVerifiedBlob.mockResolvedValueOnce(false);
    await expect(api.service.execute(ACTOR, MEDIA, PREVIOUS)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('fails before DB modification if role revoked or resource disappears', async () => {
    const api = setup();
    api.profiles.findByUserId.mockResolvedValueOnce({ id: ACTOR, role: 'teacher' });
    await expect(api.service.execute(ACTOR, MEDIA, null)).rejects.toMatchObject({
      statusCode: 404,
    });
    api.resources.existsForTarget.mockResolvedValueOnce(false);
    await expect(api.service.execute(ACTOR, MEDIA, null)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(api.records.assignActiveVerifiedBlob).not.toHaveBeenCalled();
  });

  it('refuses R2, pending, mismatched ticket or missing ETag', async () => {
    const api = setup();
    for (const change of [
      { storageProvider: 'R2' },
      { status: 'PENDING' },
      { ticketExpiresAt: new Date() },
      { verifiedEtag: null },
    ]) {
      api.records.findById.mockResolvedValueOnce({ ...verified, ...change });
      await expect(api.service.execute(ACTOR, MEDIA, null)).rejects.toMatchObject({
        statusCode: 404,
      });
    }
    expect(api.records.assignActiveVerifiedBlob).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs and permits only self avatar to non-admin actors', async () => {
    const api = setup();
    for (const params of [
      ['no-user', MEDIA, null],
      [ACTOR, '../strange', null],
      [ACTOR, MEDIA, 'wrong-old-id'],
    ] as const) {
      await expect(api.service.execute(...params)).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    api.profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    api.records.findById.mockResolvedValueOnce({
      ...verified, target: 'profile-avatar', resourceId: ACTOR,
    });
    await expect(api.service.execute(ACTOR, MEDIA, null)).resolves.toHaveProperty(
      'status', 'ACTIVE',
    );
    api.records.findById.mockResolvedValueOnce({
      ...verified, target: 'profile-avatar', resourceId: STUDENT,
    });
    await expect(api.service.execute(ACTOR, MEDIA, null)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

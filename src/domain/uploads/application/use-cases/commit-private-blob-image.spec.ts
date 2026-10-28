import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { CommitPrivateBlobImageUseCase } from './commit-private-blob-image';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const MEDIA = '33333333-3333-4333-8333-333333333333';
const PREVIOUS = '44444444-4444-4444-8444-444444444444';
const URL = 'https://legacy.example.invalid/photo.jpg';
const verified = {
  id: MEDIA,
  target: 'student-photo',
  resourceId: STUDENT,
  storageProvider: 'BLOB',
  status: 'VERIFIED',
  ticketExpiresAt: null,
  verifiedEtag: '"aabbccddeeff00112233445566778899"',
};
const newPhoto = {
  target: 'student-photo' as const,
  resourceId: STUDENT,
  newMediaId: MEDIA,
  expectedMediaId: PREVIOUS,
  expectedLegacyUrl: URL,
};

function setup() {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: ACTOR, role: 'admin' }),
  };
  const resources = { existsForTarget: jest.fn().mockResolvedValue(true) };
  const records = {
    findById: jest.fn().mockResolvedValue(verified),
    commitPrivateBlobBinding: jest.fn().mockResolvedValue(true),
  };
  const useCase = new CommitPrivateBlobImageUseCase(
    profiles as unknown as AuthProfilesRepository,
    resources as unknown as ManagedUploadResourcesRepository,
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { useCase, profiles, resources, records };
}

describe('02F-06B3D atomic private image commit domain', () => {
  it('commits a verified image and clears only the observed legacy photo', async () => {
    const { useCase, records } = setup();
    await expect(useCase.execute(ACTOR, newPhoto)).resolves.toEqual({
      mediaId: MEDIA,
      status: 'ACTIVE',
    });
    expect(records.commitPrivateBlobBinding).toHaveBeenCalledWith(newPhoto);
  });

  it('removes only the expected active photo without remotely deleting bytes', async () => {
    const { useCase, records } = setup();
    const removal = { ...newPhoto, newMediaId: null };
    await expect(useCase.execute(ACTOR, removal)).resolves.toEqual({
      mediaId: null,
      status: 'REMOVED',
    });
    expect(records.findById).not.toHaveBeenCalled();
    expect(records.commitPrivateBlobBinding).toHaveBeenCalledWith(removal);
  });

  it('returns conflict for stale old media or stale legacy URL', async () => {
    const { useCase, records } = setup();
    records.commitPrivateBlobBinding.mockResolvedValue(false);
    await expect(useCase.execute(ACTOR, newPhoto)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('rejects revoked roles, missing resources and foreign avatars', async () => {
    const { useCase, profiles, resources, records } = setup();
    profiles.findByUserId.mockResolvedValueOnce({ id: ACTOR, role: 'teacher' });
    await expect(useCase.execute(ACTOR, newPhoto)).rejects.toMatchObject({
      statusCode: 404,
    });
    resources.existsForTarget.mockResolvedValueOnce(false);
    await expect(useCase.execute(ACTOR, newPhoto)).rejects.toMatchObject({
      statusCode: 404,
    });
    profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    await expect(
      useCase.execute(ACTOR, {
        ...newPhoto,
        target: 'profile-avatar',
        resourceId: STUDENT,
        newMediaId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(records.commitPrivateBlobBinding).not.toHaveBeenCalled();
  });

  it('permits an ordinary user to remove only their own avatar', async () => {
    const { useCase, profiles, records } = setup();
    profiles.findByUserId.mockResolvedValue({ id: ACTOR, role: 'user' });
    await expect(
      useCase.execute(ACTOR, {
        target: 'profile-avatar',
        resourceId: ACTOR,
        newMediaId: null,
        expectedMediaId: PREVIOUS,
        expectedLegacyUrl: null,
      }),
    ).resolves.toHaveProperty('status', 'REMOVED');
    expect(records.commitPrivateBlobBinding).toHaveBeenCalledTimes(1);
  });

  it('fails closed on pending/R2/foreign media or weak ETag', async () => {
    const { useCase, records } = setup();
    for (const variation of [
      { status: 'PENDING' },
      { storageProvider: 'R2' },
      { resourceId: ACTOR },
      { target: 'teacher-photo' },
      { verifiedEtag: null },
      { ticketExpiresAt: new Date() },
    ]) {
      records.findById.mockResolvedValueOnce({ ...verified, ...variation });
      await expect(useCase.execute(ACTOR, newPhoto)).rejects.toMatchObject({
        statusCode: 404,
      });
    }
    expect(records.commitPrivateBlobBinding).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs, no-ops and illegal legacy URL lengths', async () => {
    const { useCase, records } = setup();
    for (const input of [
      { ...newPhoto, newMediaId: PREVIOUS },
      { ...newPhoto, newMediaId: null, expectedMediaId: null },
      { ...newPhoto, resourceId: 'bad' },
      { ...newPhoto, expectedLegacyUrl: 'x'.repeat(2049) },
      { ...newPhoto, expectedMediaId: 'bad' },
    ]) {
      await expect(useCase.execute(ACTOR, input)).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(records.commitPrivateBlobBinding).not.toHaveBeenCalled();
  });
});

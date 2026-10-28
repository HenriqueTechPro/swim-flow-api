import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { ListActivePrivateBlobReferencesUseCase } from './list-active-private-blob-references';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const MEDIA = '44444444-4444-4444-8444-444444444444';

function setup(role: string | null = 'admin') {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue(
      role ? { id: ADMIN, role } : null,
    ),
  };
  const records = {
    findActiveMediaIds: jest.fn().mockResolvedValue([
      { resourceId: STUDENT, mediaId: MEDIA },
    ]),
  };
  const useCase = new ListActivePrivateBlobReferencesUseCase(
    profiles as unknown as AuthProfilesRepository,
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { useCase, profiles, records };
}

describe('Private active references - scoped batch query', () => {
  it('queries only one DB batch and preserves page order with null for missing photos', async () => {
    const { useCase, records } = setup();
    expect(await useCase.execute(ADMIN, 'student-photo', [OTHER, STUDENT])).toEqual({
      references: [
        { resourceId: OTHER, mediaId: null },
        { resourceId: STUDENT, mediaId: MEDIA },
      ],
    });
    expect(records.findActiveMediaIds).toHaveBeenCalledTimes(1);
    expect(records.findActiveMediaIds).toHaveBeenCalledWith(
      'student-photo', [OTHER, STUDENT],
    );
  });

  it('supports exactly the current user avatar, not another profile', async () => {
    const { useCase, records } = setup('user');
    records.findActiveMediaIds.mockResolvedValueOnce([
      { resourceId: ADMIN, mediaId: MEDIA },
    ]);
    expect(await useCase.execute(ADMIN, 'profile-avatar', [ADMIN])).toEqual({
      references: [{ resourceId: ADMIN, mediaId: MEDIA }],
    });
    await expect(
      useCase.execute(ADMIN, 'profile-avatar', [OTHER]),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(records.findActiveMediaIds).toHaveBeenCalledTimes(1);
  });

  it('denies current teacher, downgraded admin and missing profiles', async () => {
    const { useCase, profiles, records } = setup('teacher');
    await expect(
      useCase.execute(ADMIN, 'student-photo', [STUDENT]),
    ).rejects.toMatchObject({ statusCode: 404 });
    profiles.findByUserId.mockResolvedValueOnce(null);
    await expect(
      useCase.execute(ADMIN, 'parent-photo', [STUDENT]),
    ).rejects.toMatchObject({ statusCode: 404 });
    profiles.findByUserId.mockResolvedValueOnce({ id: ADMIN, role: 'user' });
    await expect(
      useCase.execute(ADMIN, 'teacher-photo', [STUDENT]),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(records.findActiveMediaIds).not.toHaveBeenCalled();
  });

  it('rejects injected, duplicate and oversized batches without querying', async () => {
    const { useCase, records } = setup();
    for (const ids of [[], [STUDENT, STUDENT], ['../photo'], Array(26).fill(STUDENT)]) {
      await expect(
        useCase.execute(ADMIN, 'student-photo', ids),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(
      useCase.execute('bad-actor', 'student-photo', [STUDENT]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(records.findActiveMediaIds).not.toHaveBeenCalled();
  });

  it('does not make a DB query for each image on a full page', async () => {
    const { useCase, records } = setup();
    const ids = Array.from({ length: 25 }, (_, index) =>
      '55555555-5555-4555-8555-' + index.toString(16).padStart(12, '0'),
    );
    const result = await useCase.execute(ADMIN, 'student-photo', ids);
    expect(result.references).toHaveLength(25);
    expect(records.findActiveMediaIds).toHaveBeenCalledTimes(1);
  });
});

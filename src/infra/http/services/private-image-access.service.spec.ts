import { ServiceUnavailableException } from '@nestjs/common';
import type { AssignPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/assign-private-blob-image';
import type { ReadPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/read-private-blob-image';
import { PrivateImageAccessService } from './private-image-access.service';
import type { ListActivePrivateBlobReferencesUseCase } from '@/domain/uploads/application/use-cases/list-active-private-blob-references';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const MEDIA = '33333333-3333-4333-8333-333333333333';

describe('PrivateImageAccessService', () => {
  it('is fail-closed when the private Blob flag is off', async () => {
    const service = new PrivateImageAccessService(null, null);
    await expect(service.activate(ACTOR, MEDIA, null)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.download(ACTOR, MEDIA)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      service.activeReferences(ACTOR, 'profile-avatar', [ACTOR]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('delegates references to the authorization use case', async () => {
    const execute = jest
      .fn<ListActivePrivateBlobReferencesUseCase['execute']>()
      .mockResolvedValue({
        references: [{ resourceId: ACTOR, mediaId: MEDIA }],
      });
    const service = new PrivateImageAccessService(
      null,
      null,
      { execute } as unknown as ListActivePrivateBlobReferencesUseCase,
    );
    const references = await service.activeReferences(ACTOR, 'profile-avatar', [
      ACTOR,
    ]);
    expect(references).toEqual({
      references: [{ resourceId: ACTOR, mediaId: MEDIA }],
    });
    expect(execute).toHaveBeenCalledWith(ACTOR, 'profile-avatar', [ACTOR]);
  });

  it('delegates binding and reading to audited domain use cases', async () => {
    const assign = jest
      .fn<AssignPrivateBlobImageUseCase['execute']>()
      .mockResolvedValue({ mediaId: MEDIA, status: 'ACTIVE' });
    const read = jest
      .fn<ReadPrivateBlobImageUseCase['execute']>()
      .mockResolvedValue({
        stream: {
          async *[Symbol.asyncIterator]() {
            yield new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
          },
        },
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '4',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    const service = new PrivateImageAccessService(
      { execute: assign } as unknown as AssignPrivateBlobImageUseCase,
      { execute: read } as unknown as ReadPrivateBlobImageUseCase,
    );

    await expect(service.activate(ACTOR, MEDIA, null)).resolves.toEqual({
      mediaId: MEDIA,
      status: 'ACTIVE',
    });
    await expect(service.download(ACTOR, MEDIA)).resolves.toHaveProperty(
      'headers',
    );
    expect(assign).toHaveBeenCalledWith(ACTOR, MEDIA, null);
    expect(read).toHaveBeenCalledWith(ACTOR, MEDIA);
  });
});

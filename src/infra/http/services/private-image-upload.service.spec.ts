import { ServiceUnavailableException } from '@nestjs/common';
import type { StorePrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/store-private-blob-image';
import { PrivateImageUploadService } from './private-image-upload.service';

describe('PrivateImageUploadService', () => {
  const input = {
    target: 'profile-avatar' as const,
    contentType: 'image/png',
    bytes: new Uint8Array(8),
  };

  it('fails closed with 503 when private Blob is not configured', async () => {
    const service = new PrivateImageUploadService(null);
    await expect(service.execute('actor-id', input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('passes bytes through existing audited use case without rewriting authorization', async () => {
    const execute = jest.fn<StorePrivateBlobImageUseCase['execute']>().mockResolvedValue({
      uploadId: 'media-id',
      status: 'VERIFIED',
    });
    const service = new PrivateImageUploadService({
      execute,
    } as unknown as StorePrivateBlobImageUseCase);

    await service.execute('actor-id', input);
    expect(execute).toHaveBeenCalledWith('actor-id', input);
  });
});

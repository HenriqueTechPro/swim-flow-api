import { ServiceUnavailableException } from '@nestjs/common';
import { AssignPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/assign-private-blob-image';
import { ReadPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/read-private-blob-image';

/**
 * HTTP façade with no fallback to public/Supabase media storage.
 * Both use cases remain disabled unless the private Blob flag is enabled.
 */
export class PrivateImageAccessService {
  constructor(
    private readonly assign: AssignPrivateBlobImageUseCase | null,
    private readonly read: ReadPrivateBlobImageUseCase | null,
  ) {}

  async activate(
    actorId: string,
    uploadId: string,
    expectedMediaId: string | null,
  ) {
    if (!this.assign) {
      throw new ServiceUnavailableException(
        'Private image storage is not configured',
      );
    }
    return this.assign.execute(actorId, uploadId, expectedMediaId);
  }

  async download(actorId: string, uploadId: string) {
    if (!this.read) {
      throw new ServiceUnavailableException(
        'Private image storage is not configured',
      );
    }
    return this.read.execute(actorId, uploadId);
  }
}

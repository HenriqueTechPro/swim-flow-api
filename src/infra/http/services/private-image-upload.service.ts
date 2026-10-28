import { ServiceUnavailableException } from '@nestjs/common';
import {
  StorePrivateBlobImageUseCase,
  type StorePrivateBlobImageInput,
} from '@/domain/uploads/application/use-cases/store-private-blob-image';

/** Keep the new HTTP transport disabled until private Blob is configured.
 * Never fall back to public storage or return storage credentials.
 */
export class PrivateImageUploadService {
  constructor(private readonly store: StorePrivateBlobImageUseCase | null) {}

  async execute(actorId: string, input: StorePrivateBlobImageInput) {
    if (!this.store) {
      throw new ServiceUnavailableException(
        'Private image storage is not configured',
      );
    }
    return this.store.execute(actorId, input);
  }
}

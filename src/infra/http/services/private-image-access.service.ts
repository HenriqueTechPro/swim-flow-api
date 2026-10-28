import { ServiceUnavailableException } from '@nestjs/common';
import { AssignPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/assign-private-blob-image';
import { CommitPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/commit-private-blob-image';
import type { CommitPrivateBlobBindingInput } from '@/domain/uploads/application/repositories/private-media-objects-repository';
import { ReadPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/read-private-blob-image';
import { ListActivePrivateBlobReferencesUseCase } from '@/domain/uploads/application/use-cases/list-active-private-blob-references';
import type { ManagedUploadTarget } from '@/domain/uploads/application/dtos/managed-upload';

/**
 * HTTP façade with no fallback to public/Supabase media storage.
 * Both use cases remain disabled unless the private Blob flag is enabled.
 */
export class PrivateImageAccessService {
  constructor(
    private readonly assign: AssignPrivateBlobImageUseCase | null,
    private readonly read: ReadPrivateBlobImageUseCase | null,
    private readonly listReferences: ListActivePrivateBlobReferencesUseCase | null = null,
    private readonly commitBinding: CommitPrivateBlobImageUseCase | null = null,
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

  async commit(actorId: string, input: CommitPrivateBlobBindingInput) {
    if (!this.commitBinding) {
      throw new ServiceUnavailableException(
        'Private image storage is not configured',
      );
    }
    return this.commitBinding.execute(actorId, input);
  }

  async activeReferences(
    actorId: string,
    target: ManagedUploadTarget,
    resourceIds: string[],
  ) {
    if (!this.listReferences) {
      throw new ServiceUnavailableException(
        'Private image storage is not configured',
      );
    }
    return this.listReferences.execute(actorId, target, resourceIds);
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

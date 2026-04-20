import type { AppRole } from '@/domain/auth/application/auth.types';
import { AppError } from '@/shared/errors/app-error';
import type { CreateManagedUploadRequest } from '../dtos/managed-upload';
import { ManagedUploadsRepository } from '../repositories/managed-uploads-repository';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';

interface ManagedUploadActor {
  id: string;
  role?: AppRole | null;
}

export class CreateManagedUploadUseCase {
  constructor(
    private readonly managedUploadsRepository: ManagedUploadsRepository,
    private readonly managedUploadResourcesRepository: ManagedUploadResourcesRepository,
  ) {}

  async execute(actor: ManagedUploadActor, input: CreateManagedUploadRequest) {
    if (input.target !== 'profile-avatar') {
      if (actor.role !== 'admin' && actor.role !== 'teacher') {
        throw new AppError(403, 'User does not have permission for this upload target');
      }

      if (!input.resourceId) {
        throw new AppError(400, 'A resource identifier is required for this upload target');
      }

      const resourceExists = await this.managedUploadResourcesRepository.existsForTarget(
        input.target,
        input.resourceId,
      );

      if (!resourceExists) {
        throw new AppError(404, 'Upload target resource not found');
      }
    }

    return this.managedUploadsRepository.createSignedUpload(actor.id, input);
  }
}

import type {
  CreateManagedUploadRequest,
  ManagedUploadResult,
} from '../dtos/managed-upload';

export abstract class ManagedUploadsRepository {
  abstract createSignedUpload(
    userId: string,
    input: CreateManagedUploadRequest,
  ): Promise<ManagedUploadResult>;
}

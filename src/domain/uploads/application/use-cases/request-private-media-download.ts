import { AppError } from '@/shared/errors/app-error';
import {
  PrivateMediaAccessRepository,
  type PrivateMediaActor,
} from '../repositories/private-media-access-repository';
import { PrivateMediaRecordsRepository } from '../repositories/private-media-records-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class RequestPrivateMediaDownloadUseCase {
  constructor(
    private readonly access: PrivateMediaAccessRepository,
    private readonly records: PrivateMediaRecordsRepository,
    private readonly storage: PrivateMediaStorageRepository,
  ) {}

  async execute(actor: PrivateMediaActor, mediaId: string) {
    if (!UUID.test(mediaId)) {
      throw new AppError(404, 'Private media unavailable');
    }
    const record = await this.records.findById(mediaId);
    if (!record || record.status !== 'CONFIRMED') {
      // PENDING objects (or rejected/deleted ones) are never downloadable.
      throw new AppError(404, 'Private media unavailable');
    }

    // Check current scope, not the original uploader or an old ACL snapshot.
    const allowed = await this.access.canAccess({
      actor,
      operation: 'read',
      target: record.target,
      resourceId: record.resourceId,
    });
    if (!allowed) throw new AppError(404, 'Private media unavailable');

    return this.storage.signDownload(record.objectKey);
  }
}

import { AppError } from '@/shared/errors/app-error';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { canAccessPrivateMediaRecord } from '../services/private-media-record-access';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal short-lived private GET tickets. A verified row alone NEVER grants
 * access: recheck current role and target ownership on every request.
 * Still no HTTP endpoints, cache or direct public image URL.
 */
export class RequestPrivateMediaDownloadUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly objects: PrivateMediaObjectsRepository,
    private readonly storage: PrivateMediaStorageRepository,
  ) {}

  async execute(actorId: string, uploadId: string) {
    if (!UUID.test(actorId) || !UUID.test(uploadId)) {
      throw new AppError(404, 'Private media unavailable');
    }
    const record = await this.objects.findById(uploadId);
    if (
      !record ||
      record.status !== 'VERIFIED' ||
      !isStrongPrivateMediaEtag(record.verifiedEtag) ||
      !(await canAccessPrivateMediaRecord(
        actorId,
        record,
        this.profiles,
        this.resources,
      ))
    ) {
      throw new AppError(404, 'Private media unavailable');
    }

    const ticket = await this.storage.signDownload(
      record.objectKey,
      record.verifiedEtag,
    );
    if (
      !ticket.url.startsWith('https://') ||
      !Number.isSafeInteger(ticket.expiresInSeconds) ||
      ticket.expiresInSeconds <= 0 ||
      ticket.expiresInSeconds > 60 ||
      ticket.headers['If-Match'] !== record.verifiedEtag
    ) {
      throw new Error('Invalid private download ticket');
    }
    // The URL must never be written into PostgreSQL or application logs.
    return ticket;
  }
}

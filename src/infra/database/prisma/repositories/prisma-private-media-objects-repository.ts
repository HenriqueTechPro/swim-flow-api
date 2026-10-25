import { Injectable } from '@nestjs/common';
import {
  PrivateMediaObjectsRepository,
  type PendingPrivateMediaObject,
} from '@/domain/uploads/application/repositories/private-media-objects-repository';
import { PrismaService } from '../prisma.service';

/**
 * Pending object metadata is written only AFTER scope authorization and S3
 * signing have succeeded. The uploader snapshot remains after profile
 * deletion; the nullable FK is intentionally cleared by PostgreSQL.
 *
 * This repository is NOT registered for requests until an authenticated
 * controller, post-upload verification and cleanup are implemented.
 */
@Injectable()
export class PrismaPrivateMediaObjectsRepository extends PrivateMediaObjectsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createPending(input: PendingPrivateMediaObject): Promise<void> {
    await this.prisma.privateMediaObject.create({
      data: {
        id: input.id,
        objectKey: input.objectKey,
        target: input.target,
        resourceId: input.resourceId,
        uploadedById: input.uploadedById,
        uploadedByProfileId: input.uploadedById,
        declaredContentType: input.declaredContentType,
        declaredSizeBytes: input.declaredSizeBytes,
        status: 'PENDING',
        ticketExpiresAt: input.ticketExpiresAt,
      },
      select: { id: true },
    });
  }
}

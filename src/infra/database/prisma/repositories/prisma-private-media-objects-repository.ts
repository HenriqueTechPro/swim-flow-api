import { Injectable } from '@nestjs/common';
import type { PrivateMediaObject } from '@prisma/client';
import {
  PrivateMediaObjectsRepository,
  type PendingPrivateMediaObject,
  type PrivateMediaObjectRecord,
  type PrivateMediaStatus,
  type VerifiedPrivateBlobMediaObject,
} from '@/domain/uploads/application/repositories/private-media-objects-repository';
import type { ManagedUploadTarget } from '@/domain/uploads/application/dtos/managed-upload';
import { PrismaService } from '../prisma.service';

function toRecord(record: PrivateMediaObject): PrivateMediaObjectRecord {
  return {
    id: record.id,
    objectKey: record.objectKey,
    target: record.target as ManagedUploadTarget,
    resourceId: record.resourceId,
    uploadedById: record.uploadedById,
    declaredContentType:
      record.declaredContentType as PendingPrivateMediaObject['declaredContentType'],
    declaredSizeBytes: record.declaredSizeBytes,
    ticketExpiresAt: record.ticketExpiresAt,
    status: record.status as PrivateMediaStatus,
    verifiedAt: record.verifiedAt,
    verifiedEtag: record.verifiedEtag,
  };
}

/**
 * Intentionally NOT registered for HTTP traffic. The WHERE predicates on
 * updateMany provide atomic compare-and-swap for concurrent confirm/cleanup.
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

  async createVerifiedBlob(
    input: VerifiedPrivateBlobMediaObject,
  ): Promise<void> {
    // The legacy table requires ticket_expires_at even for server-mediated
    // uploads. This future timestamp satisfies that historical CHECK; it is
    // NOT a real client ticket, nor used by the VERIFIED cleanup query.
    const legacyTicketExpiry = new Date(
      input.verifiedAt.getTime() + 86_400_000,
    );
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
        status: 'VERIFIED',
        verifiedAt: input.verifiedAt,
        verifiedEtag: input.verifiedEtag,
        ticketExpiresAt: legacyTicketExpiry,
      },
      select: { id: true },
    });
  }

  async findById(id: string): Promise<PrivateMediaObjectRecord | null> {
    const object = await this.prisma.privateMediaObject.findUnique({
      where: { id },
    });
    return object ? toRecord(object) : null;
  }

  async markVerifiedIfPending(
    id: string,
    cutoff: Date,
    verifiedAt: Date,
    verifiedEtag: string,
  ): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: { id, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
      data: { status: 'VERIFIED', verifiedAt, verifiedEtag },
    });
    return updated.count === 1;
  }

  async rejectIfPending(id: string, cutoff: Date): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: { id, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
      data: { status: 'REJECTED' },
    });
    return updated.count === 1;
  }

  async listCleanupCandidates(
    cutoff: Date,
    limit: number,
  ): Promise<PrivateMediaObjectRecord[]> {
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 50) {
      throw new Error('invalid-private-media-cleanup-limit');
    }
    const records = await this.prisma.privateMediaObject.findMany({
      where: {
        status: { in: ['PENDING', 'REJECTED'] },
        ticketExpiresAt: { lte: cutoff },
      },
      take: limit,
      orderBy: [{ ticketExpiresAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(toRecord);
  }

  async markDeletedIfRejected(id: string): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: { id, status: 'REJECTED' },
      data: { status: 'DELETED' },
    });
    return updated.count === 1;
  }
}

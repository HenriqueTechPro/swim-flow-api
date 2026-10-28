import { Injectable } from '@nestjs/common';
import type { PrivateMediaObject } from '@prisma/client';
import {
  PrivateMediaObjectsRepository,
  type PendingPrivateMediaObject,
  type PrivateMediaObjectRecord,
  type PrivateMediaStatus,
  type VerifiedPrivateBlobMediaObject,
  type CommitPrivateBlobBindingInput,
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
    storageProvider: record.storageProvider as 'R2' | 'BLOB',
    status: record.status as PrivateMediaStatus,
    verifiedAt: record.verifiedAt,
    verifiedEtag: record.verifiedEtag,
    cleanupClaimedAt: record.cleanupClaimedAt,
    cleanupCompletedAt: record.cleanupCompletedAt,
  };
}

class PrivateBlobBindingConflict extends Error {
  constructor() {
    super('private-blob-binding-concurrent-change');
  }
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
        storageProvider: 'R2',
        ticketExpiresAt: input.ticketExpiresAt,
      },
      select: { id: true },
    });
  }

  async createVerifiedBlob(
    input: VerifiedPrivateBlobMediaObject,
  ): Promise<void> {
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
        storageProvider: 'BLOB',
        verifiedAt: input.verifiedAt,
        verifiedEtag: input.verifiedEtag,
        ticketExpiresAt: null,
      },
      select: { id: true },
    });
  }

  async findActiveMediaId(
    target: ManagedUploadTarget,
    resourceId: string,
  ): Promise<string | null> {
    const binding = await this.prisma.privateMediaActiveBinding.findUnique({
      where: { target_resourceId: { target, resourceId } },
      select: { mediaId: true },
    });
    return binding?.mediaId ?? null;
  }

  async findActiveMediaIds(
    target: ManagedUploadTarget,
    resourceIds: readonly string[],
  ): Promise<ReadonlyArray<{ resourceId: string; mediaId: string }>> {
    if (resourceIds.length === 0) return [];
    return this.prisma.privateMediaActiveBinding.findMany({
      where: {
        target,
        resourceId: { in: [...resourceIds] },
        storageProvider: 'BLOB',
        status: 'VERIFIED',
      },
      select: { resourceId: true, mediaId: true },
    });
  }

  async assignActiveVerifiedBlob(input: {
    target: ManagedUploadTarget;
    resourceId: string;
    mediaId: string;
    expectedMediaId: string | null;
  }): Promise<boolean> {
    if (input.expectedMediaId !== null) {
      const changed = await this.prisma.privateMediaActiveBinding.updateMany({
        where: {
          target: input.target,
          resourceId: input.resourceId,
          mediaId: input.expectedMediaId,
        },
        data: { mediaId: input.mediaId },
      });
      return changed.count === 1;
    }
    try {
      await this.prisma.privateMediaActiveBinding.create({
        data: {
          target: input.target,
          resourceId: input.resourceId,
          mediaId: input.mediaId,
          storageProvider: 'BLOB',
          status: 'VERIFIED',
        },
        select: { mediaId: true },
      });
      return true;
    } catch (error: unknown) {
      // Only an optimistic UNIQUE conflict is a lost race. Invalid FK and
      // other database failures MUST propagate (never masquerade as CAS).
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  async commitPrivateBlobBinding(
    input: CommitPrivateBlobBindingInput,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Lock and compare the current legacy field before touching the
        // private reference. A stale edit must roll back both changes.
        const where = {
          id: input.resourceId,
          // Compound predicates on updateMany implement a legacy URL CAS.
        };
        let updated: { count: number };
        switch (input.target) {
          case 'student-photo':
            updated = await tx.student.updateMany({
              where: { ...where, photo: input.expectedLegacyUrl },
              data: { photo: null },
            });
            break;
          case 'teacher-photo':
            updated = await tx.teacher.updateMany({
              where: { ...where, photo: input.expectedLegacyUrl },
              data: { photo: null },
            });
            break;
          case 'parent-photo':
            updated = await tx.parent.updateMany({
              where: { ...where, photo: input.expectedLegacyUrl },
              data: { photo: null },
            });
            break;
          case 'profile-avatar':
            updated = await tx.profile.updateMany({
              where: { ...where, avatarUrl: input.expectedLegacyUrl },
              data: { avatarUrl: null },
            });
            break;
        }
        if (updated.count !== 1) {
          throw new PrivateBlobBindingConflict();
        }

        const match = {
          target: input.target,
          resourceId: input.resourceId,
        };
        if (input.newMediaId === null) {
          const removed = await tx.privateMediaActiveBinding.deleteMany({
            where: { ...match, mediaId: input.expectedMediaId! },
          });
          if (removed.count !== 1) {
            throw new PrivateBlobBindingConflict();
          }
          return;
        }

        if (input.expectedMediaId === null) {
          // Existing composite FK enforces VERIFIED BLOB and exact owner.
          await tx.privateMediaActiveBinding.create({
            data: {
              ...match,
              mediaId: input.newMediaId,
              storageProvider: 'BLOB',
              status: 'VERIFIED',
            },
            select: { mediaId: true },
          });
          return;
        }

        const swapped = await tx.privateMediaActiveBinding.updateMany({
          where: { ...match, mediaId: input.expectedMediaId },
          data: { mediaId: input.newMediaId },
        });
        if (swapped.count !== 1) {
          throw new PrivateBlobBindingConflict();
        }
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof PrivateBlobBindingConflict) return false;
      // Only unique violations from a first-time binding race are CAS
      // conflicts. FK violations and database outages must propagate.
      if (
        input.newMediaId !== null &&
        input.expectedMediaId === null &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<PrivateMediaObjectRecord | null> {
    const object = await this.prisma.privateMediaObject.findUnique({
      where: { id },
    });
    return object ? toRecord(object) : null;
  }

  async listUnboundVerifiedBlobCandidates(
    cutoff: Date,
    limit: number,
  ): Promise<
    ReadonlyArray<{
      id: string;
      target: ManagedUploadTarget;
      declaredSizeBytes: number;
      verifiedAt: Date;
    }>
  > {
    if (
      !(cutoff instanceof Date) ||
      !Number.isFinite(cutoff.getTime()) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 51
    ) {
      throw new Error('invalid-private-blob-audit-query');
    }
    const objects = await this.prisma.privateMediaObject.findMany({
      where: {
        storageProvider: 'BLOB',
        status: 'VERIFIED',
        ticketExpiresAt: null,
        verifiedAt: { lte: cutoff },
        createdAt: { lte: cutoff },
        activeBindings: { none: {} },
      },
      orderBy: [{ verifiedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        target: true,
        declaredSizeBytes: true,
        verifiedAt: true,
      },
    });
    return objects.map((item) => {
      if (item.verifiedAt === null) {
        throw new Error('invalid-private-blob-audit-metadata');
      }
      return {
        id: item.id,
        target: item.target as ManagedUploadTarget,
        declaredSizeBytes: item.declaredSizeBytes,
        verifiedAt: item.verifiedAt,
      };
    });
  }

  async claimUnboundVerifiedBlobForCleanup(
    mediaId: string,
    cutoff: Date,
    claimedAt: Date,
  ): Promise<boolean> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        mediaId,
      ) ||
      !(cutoff instanceof Date) ||
      !Number.isFinite(cutoff.getTime()) ||
      !(claimedAt instanceof Date) ||
      !Number.isFinite(claimedAt.getTime()) ||
      cutoff.getTime() > claimedAt.getTime()
    ) {
      throw new Error('invalid-private-blob-cleanup-claim');
    }

    return this.prisma.$transaction(async (tx) => {
      // Parent FOR UPDATE conflicts with a child FK's KEY SHARE lock. This
      // serializes any concurrent binding BEFORE the separate fresh read,
      // unlike a single UPDATE with a stale NOT EXISTS snapshot.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "private_media_objects"
        WHERE "id" = ${mediaId}::uuid
          AND "storage_provider" = 'BLOB'
          AND "status" = 'VERIFIED'
          AND "ticket_expires_at" IS NULL
          AND "cleanup_claimed_at" IS NULL
          AND "created_at" <= ${cutoff}
          AND "verified_at" <= ${cutoff}
          AND "verified_etag" IS NOT NULL
        FOR UPDATE
      `;
      if (locked.length !== 1) return false;

      // Fresh statement after locking parent: committed FK insertion now
      // visible, and new assignments must wait for transaction completion.
      const active = await tx.privateMediaActiveBinding.findUnique({
        where: { mediaId },
        select: { mediaId: true },
      });
      if (active) return false;

      const changed = await tx.privateMediaObject.updateMany({
        where: {
          id: mediaId,
          storageProvider: 'BLOB',
          status: 'VERIFIED',
          ticketExpiresAt: null,
          cleanupClaimedAt: null,
          createdAt: { lte: cutoff },
          verifiedAt: { lte: cutoff },
        },
        data: {
          status: 'GC_CLAIMED',
          cleanupClaimedAt: claimedAt,
        },
      });
      if (changed.count !== 1) {
        throw new Error('private-blob-cleanup-claim-concurrency');
      }
      return true;
    });
  }

  async completeClaimedBlobCleanup(
    mediaId: string,
    etag: string,
    claimedAt: Date,
    completedAt: Date,
  ): Promise<boolean> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        mediaId,
      ) ||
      !/^"[A-Za-z0-9-]{1,120}"$/.test(etag) ||
      !(claimedAt instanceof Date) ||
      !Number.isFinite(claimedAt.getTime()) ||
      !(completedAt instanceof Date) ||
      !Number.isFinite(completedAt.getTime()) ||
      completedAt.getTime() < claimedAt.getTime()
    ) {
      throw new Error('invalid-private-blob-cleanup-completion');
    }

    const changed = await this.prisma.privateMediaObject.updateMany({
      where: {
        id: mediaId,
        storageProvider: 'BLOB',
        status: 'GC_CLAIMED',
        cleanupClaimedAt: claimedAt,
        cleanupCompletedAt: null,
        ticketExpiresAt: null,
        verifiedEtag: etag,
        activeBindings: { none: {} },
      },
      data: { status: 'DELETED', cleanupCompletedAt: completedAt },
    });
    return changed.count === 1;
  }

  async markVerifiedIfPending(
    id: string,
    cutoff: Date,
    verifiedAt: Date,
    verifiedEtag: string,
  ): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: {
        id,
        status: 'PENDING',
        storageProvider: 'R2',
        ticketExpiresAt: { lte: cutoff },
      },
      data: { status: 'VERIFIED', verifiedAt, verifiedEtag },
    });
    return updated.count === 1;
  }

  async rejectIfPending(id: string, cutoff: Date): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: {
        id,
        status: 'PENDING',
        storageProvider: 'R2',
        ticketExpiresAt: { lte: cutoff },
      },
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
        storageProvider: 'R2',
        ticketExpiresAt: { lte: cutoff },
      },
      take: limit,
      orderBy: [{ ticketExpiresAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(toRecord);
  }

  async markDeletedIfRejected(id: string): Promise<boolean> {
    const updated = await this.prisma.privateMediaObject.updateMany({
      where: { id, status: 'REJECTED', storageProvider: 'R2' },
      data: { status: 'DELETED' },
    });
    return updated.count === 1;
  }
}

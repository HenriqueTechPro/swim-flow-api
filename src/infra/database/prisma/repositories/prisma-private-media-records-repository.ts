import { Injectable } from '@nestjs/common';
import {
  PrivateMediaTarget as PrismaMediaTarget,
  type PrivateMediaObject,
} from '@prisma/client';
import type { ManagedUploadTarget } from '@/domain/uploads/application/dtos/managed-upload';
import {
  PrivateMediaRecordsRepository,
  type CreatePendingPrivateMediaRecord,
  type PrivateMediaRecord,
  type PrivateMediaRecordStatus,
} from '@/domain/uploads/application/repositories/private-media-records-repository';
import { PrismaService } from '../prisma.service';

const toPrismaTarget: Record<ManagedUploadTarget, PrismaMediaTarget> = {
  'profile-avatar': PrismaMediaTarget.PROFILE_AVATAR,
  'student-photo': PrismaMediaTarget.STUDENT_PHOTO,
  'teacher-photo': PrismaMediaTarget.TEACHER_PHOTO,
  'parent-photo': PrismaMediaTarget.PARENT_PHOTO,
};

const toDomainTarget: Record<PrismaMediaTarget, ManagedUploadTarget> = {
  PROFILE_AVATAR: 'profile-avatar',
  STUDENT_PHOTO: 'student-photo',
  TEACHER_PHOTO: 'teacher-photo',
  PARENT_PHOTO: 'parent-photo',
};

function toDomain(record: PrivateMediaObject): PrivateMediaRecord {
  return {
    id: record.id,
    requestedById: record.requestedById,
    resourceId: record.resourceId,
    objectKey: record.objectKey,
    target: toDomainTarget[record.target],
    status: record.status as PrivateMediaRecordStatus,
  };
}

@Injectable()
export class PrismaPrivateMediaRecordsRepository extends PrivateMediaRecordsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createPending(
    input: CreatePendingPrivateMediaRecord,
  ): Promise<PrivateMediaRecord> {
    const row = await this.prisma.privateMediaObject.create({
      data: {
        id: input.id,
        requestedById: input.requestedById,
        target: toPrismaTarget[input.target],
        resourceId: input.resourceId,
        objectKey: input.objectKey,
        status: 'PENDING',
        declaredContentType: input.declaredContentType,
        declaredSizeBytes: input.declaredSizeBytes,
        uploadExpiresAt: input.uploadExpiresAt,
      },
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<PrivateMediaRecord | null> {
    const row = await this.prisma.privateMediaObject.findUnique({
      where: { id },
    });
    return row ? toDomain(row) : null;
  }
}

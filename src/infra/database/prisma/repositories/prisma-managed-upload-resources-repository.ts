import { Injectable } from '@nestjs/common';
import { ManagedUploadResourcesRepository } from '@/domain/uploads/application/repositories/managed-upload-resources-repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaManagedUploadResourcesRepository
  implements ManagedUploadResourcesRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async existsForTarget(
    target: 'student-photo' | 'teacher-photo' | 'parent-photo',
    resourceId: string,
  ): Promise<boolean> {
    switch (target) {
      case 'student-photo':
        return this.prisma.student
          .findUnique({ where: { id: resourceId }, select: { id: true } })
          .then(Boolean);
      case 'teacher-photo':
        return this.prisma.teacher
          .findUnique({ where: { id: resourceId }, select: { id: true } })
          .then(Boolean);
      case 'parent-photo':
        return this.prisma.parent
          .findUnique({ where: { id: resourceId }, select: { id: true } })
          .then(Boolean);
    }
  }
}

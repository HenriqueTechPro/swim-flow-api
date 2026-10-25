import { Injectable } from '@nestjs/common';
import { PrivateMediaAccessRepository } from '@/domain/uploads/application/repositories/private-media-access-repository';
import type { ManagedUploadTarget } from '@/domain/uploads/application/dtos/managed-upload';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaPrivateMediaAccessRepository extends PrivateMediaAccessRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canAccess(input: {
    actor: { id: string; role: 'admin' | 'teacher' | 'user' | null | undefined };
    operation: 'read' | 'write';
    target: ManagedUploadTarget;
    resourceId: string;
  }): Promise<boolean> {
    const { actor, resourceId, target } = input;
    if (
      !['admin', 'teacher', 'user'].includes(actor.role ?? '') ||
      !['read', 'write'].includes(input.operation)
    ) {
      return false;
    }

    if (target === 'profile-avatar') {
      if (resourceId !== actor.id) return false;
      const profile = await this.prisma.profile.findUnique({
        where: { id: actor.id },
        select: { id: true },
      });
      return !!profile;
    }

    if (actor.role === 'admin') {
      // Administrators still need an existing entity, not an arbitrary UUID.
      switch (target) {
        case 'student-photo':
          return !!(await this.prisma.student.findUnique({
            where: { id: resourceId },
            select: { id: true },
          }));
        case 'teacher-photo':
          return !!(await this.prisma.teacher.findUnique({
            where: { id: resourceId },
            select: { id: true },
          }));
        case 'parent-photo':
          return !!(await this.prisma.parent.findUnique({
            where: { id: resourceId },
            select: { id: true },
          }));
      }
      return false;
    }

    if (actor.role !== 'teacher') return false;

    if (target === 'teacher-photo') {
      // A teacher can manage only their own verified, ACTIVE teacher identity.
      return !!(await this.prisma.teacher.findFirst({
        where: {
          id: resourceId,
          profileId: actor.id,
          status: 'Ativo',
        },
        select: { id: true },
      }));
    }

    if (target === 'student-photo') {
      // Current (not historical) student assignment to an active teacher.
      // Rechecked on each action so unlink/transfer immediately revokes access.
      return !!(await this.prisma.student.findFirst({
        where: {
          id: resourceId,
          studentClasses: {
            some: {
              toDate: null,
              swimmingClass: {
                classTeachers: {
                  some: {
                    teacher: {
                      profileId: actor.id,
                      status: 'Ativo',
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      }));
    }

    // Teacher has no parent-photo authority in the current permission model.
    return false;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TeacherAccountLinksRepository,
  type TeacherAccountLink,
} from '@/domain/teachers/application/repositories/teacher-account-links-repository';
import { AppError } from '@/shared/errors/app-error';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaTeacherAccountLinksRepository implements TeacherAccountLinksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(teacherId: string): Promise<TeacherAccountLink> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, profileId: true },
    });
    if (!teacher) throw new AppError(404, 'Teacher not found');
    return { teacherId: teacher.id, profileId: teacher.profileId };
  }

  async link(input: {
    teacherId: string;
    profileId: string;
    actorProfileId: string;
  }): Promise<TeacherAccountLink> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actor = await tx.profile.findUnique({
          where: { id: input.actorProfileId },
          select: { role: true },
        });
        if (actor?.role !== 'admin') throw new AppError(403, 'Administrator account required');

        const teacher = await tx.teacher.findUnique({
          where: { id: input.teacherId },
          select: { id: true, profileId: true, status: true },
        });
        if (!teacher) throw new AppError(404, 'Teacher not found');
        if (teacher.status !== 'Ativo') {
          throw new AppError(409, 'Only active teachers can be linked');
        }

        const profile = await tx.profile.findUnique({
          where: { id: input.profileId },
          select: { role: true },
        });
        if (!profile) throw new AppError(404, 'Access profile not found');
        if (profile.role !== 'teacher') {
          throw new AppError(422, 'Access profile must have teacher role');
        }

        if (teacher.profileId === input.profileId) {
          return { teacherId: teacher.id, profileId: teacher.profileId };
        }
        if (teacher.profileId) {
          throw new AppError(409, 'Unlink the existing teacher account before replacing it');
        }

        const existingAccount = await tx.teacher.findFirst({
          where: { profileId: input.profileId },
          select: { id: true },
        });
        if (existingAccount) {
          throw new AppError(409, 'Access profile already belongs to another teacher');
        }

        // Compare-and-set. Even two concurrent administrators cannot attach
        // different profiles to the same teacher.
        const updated = await tx.teacher.updateMany({
          where: { id: input.teacherId, profileId: null, status: 'Ativo' },
          data: { profileId: input.profileId },
        });
        if (updated.count !== 1) {
          throw new AppError(409, 'Teacher account was modified concurrently');
        }

        await tx.teacherAccountLinkEvent.create({
          data: {
            teacherId: input.teacherId,
            profileId: input.profileId,
            actorProfileId: input.actorProfileId,
            action: 'LINK',
          },
        });
        return { teacherId: input.teacherId, profileId: input.profileId };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034')) {
        throw new AppError(409, 'Teacher account link conflicts with a concurrent change');
      }
      throw error;
    }
  }

  async unlink(input: {
    teacherId: string;
    actorProfileId: string;
  }): Promise<TeacherAccountLink> {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.profile.findUnique({
        where: { id: input.actorProfileId },
        select: { role: true },
      });
      if (actor?.role !== 'admin') throw new AppError(403, 'Administrator account required');

      const teacher = await tx.teacher.findUnique({
        where: { id: input.teacherId },
        select: { id: true, profileId: true },
      });
      if (!teacher) throw new AppError(404, 'Teacher not found');
      if (!teacher.profileId) return { teacherId: teacher.id, profileId: null };

      const updated = await tx.teacher.updateMany({
        where: { id: input.teacherId, profileId: teacher.profileId },
        data: { profileId: null },
      });
      if (updated.count !== 1) {
        throw new AppError(409, 'Teacher account was modified concurrently');
      }
      await tx.teacherAccountLinkEvent.create({
        data: {
          teacherId: input.teacherId,
          profileId: teacher.profileId,
          actorProfileId: input.actorProfileId,
          action: 'UNLINK',
        },
      });
      return { teacherId: input.teacherId, profileId: null };
    });
  }
}

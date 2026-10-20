import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import type { AuthUser } from './auth.types';

interface AttendanceRequest extends Request {
  user?: AuthUser;
  query: Request['query'];
  body: unknown;
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const validId = (id: unknown): id is string =>
  typeof id === 'string' && UUID.test(id);

function isAttendanceRow(value: unknown): value is { classId: string; studentId: string } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return validId(record.classId) && validId(record.studentId);
}

/**
 * Enforcement for CURRENT class membership; never trust class IDs supplied by
 * the frontend, a JWT role claim or a teacher's display name.
 *
 * Read operations also require classId, and the repository applies the same
 * tenant filter to every returned attendance row (defence in depth).
 */
@Injectable()
export class TeacherAttendanceScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AttendanceRequest>();
    if (request.user?.role === 'admin') return true;
    if (request.user?.role !== 'teacher' || !validId(request.user.id)) {
      throw new ForbiddenException('A verified teacher profile is required');
    }

    let pairs: Array<{ classId: string; studentId: string }> = [];
    let classIds: string[];

    if (request.method === 'GET') {
      const classId = request.query.classId;
      const studentId = request.query.studentId;
      if (!validId(classId) || (studentId !== undefined && !validId(studentId))) {
        throw new ForbiddenException('Teachers must specify an authorized class');
      }
      classIds = [classId];
      if (studentId !== undefined) pairs = [{ classId, studentId }];
    } else if (request.method === 'POST') {
      const body = request.body;
      if (!body || typeof body !== 'object') {
        throw new ForbiddenException('Invalid attendance batch');
      }
      const records = (body as { records?: unknown }).records;
      if (!Array.isArray(records) || records.length === 0 ||
          records.length > 500 || !records.every(isAttendanceRow)) {
        throw new ForbiddenException('Invalid attendance batch');
      }
      pairs = records;
      classIds = [...new Set(records.map((record) => record.classId))];
    } else {
      throw new ForbiddenException('Attendance operation not authorized');
    }

    const classes = await this.prisma.classTeacher.findMany({
      where: {
        classId: { in: classIds },
        teacher: {
          profileId: request.user.id,
          status: 'Ativo',
        },
      },
      select: { classId: true },
    });
    const allowed = new Set(classes.map((record) => record.classId));
    if (classIds.some((id) => !allowed.has(id))) {
      throw new ForbiddenException('Class is not assigned to teacher');
    }

    if (pairs.length) {
      const links = await this.prisma.studentClass.findMany({
        where: {
          toDate: null,
          OR: pairs.map((pair) => ({
            studentId: pair.studentId,
            classId: pair.classId,
          })),
        },
        select: { studentId: true, classId: true },
      });
      const active = new Set(links.map(({ studentId, classId }) => `${studentId}:${classId}`));
      if (pairs.some(({ studentId, classId }) => !active.has(`${studentId}:${classId}`))) {
        throw new ForbiddenException('Student is not active in the assigned class');
      }
    }

    return true;
  }
}

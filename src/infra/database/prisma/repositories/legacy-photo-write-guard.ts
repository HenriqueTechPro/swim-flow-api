import { Prisma, type Prisma as PrismaNamespace } from '@prisma/client';
import { AppError } from '@/shared/errors/app-error';

export type LegacyPhotoTarget =
  | 'profile-avatar'
  | 'student-photo'
  | 'teacher-photo'
  | 'parent-photo';

/**
 * Serialize legacy photo writes with the atomic private-image commit.
 * /commit locks the same entity row before replacing the private binding.
 * Read the binding in a SEPARATE statement AFTER obtaining FOR UPDATE to
 * avoid observing an outdated snapshot while waiting for concurrent commit.
 * Null/omitted photo values cannot resurrect public URLs and need no guard.
 */
export async function assertLegacyPhotoWriteAllowed(
  tx: PrismaNamespace.TransactionClient,
  target: LegacyPhotoTarget,
  resourceId: string,
  requestedLegacyUrl: string | null | undefined,
): Promise<void> {
  if (!requestedLegacyUrl) return;

  const table = {
    'profile-avatar': 'profiles',
    'student-photo': 'students',
    'teacher-photo': 'teachers',
    'parent-photo': 'parents',
  }[target];
  // Hard-coded allowlist, never any user-controlled SQL identifier.
  const sql = Prisma.sql([
    'SELECT "id" FROM "' + table + '" WHERE "id" = ',
    '::uuid FOR UPDATE',
  ] as unknown as TemplateStringsArray, resourceId);
  const locked = await tx.$queryRaw<Array<{ id: string }>>(sql);
  if (locked.length === 0) return;

  const active = await tx.privateMediaActiveBinding.findUnique({
    where: { target_resourceId: { target, resourceId } },
    select: { mediaId: true },
  });
  if (active) {
    throw new AppError(
      409,
      'Private photo is active; legacy photo URLs cannot be restored',
    );
  }
}

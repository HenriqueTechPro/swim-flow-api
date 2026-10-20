import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service';
import { PrismaTeacherAccountLinksRepository } from './prisma-teacher-account-links-repository';

const teacherId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const actorProfileId = '33333333-3333-4333-8333-333333333333';

describe('PrismaTeacherAccountLinksRepository', () => {
  const tx = {
    profile: { findUnique: jest.fn() },
    teacher: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    teacherAccountLinkEvent: { create: jest.fn() },
  };
  const prisma = {
    teacher: { findUnique: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const repo = new PrismaTeacherAccountLinksRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    tx.profile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ role: where.id === actorProfileId ? 'admin' : 'teacher' }),
    );
    tx.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId: null, status: 'Ativo' });
    tx.teacher.findFirst.mockResolvedValue(null);
    tx.teacher.updateMany.mockResolvedValue({ count: 1 });
    tx.teacherAccountLinkEvent.create.mockResolvedValue({ id: 'audit-1' });
    prisma.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId: null });
  });

  const link = () => repo.link({ teacherId, profileId, actorProfileId });

  it('only exposes the teacher and linked account IDs on read', async () => {
    expect(await repo.find(teacherId)).toEqual({ teacherId, profileId: null });
  });

  it('links an active teacher with a teacher-role account in a single transaction and audits actor', async () => {
    expect(await link()).toEqual({ teacherId, profileId });
    expect(tx.teacher.updateMany).toHaveBeenCalledWith({
      where: { id: teacherId, profileId: null, status: 'Ativo' },
      data: { profileId },
    });
    expect(tx.teacherAccountLinkEvent.create).toHaveBeenCalledWith({
      data: { teacherId, profileId, actorProfileId, action: 'LINK' },
    });
  });

  it('rejects a non-administrator even if the method is invoked outside HTTP', async () => {
    tx.profile.findUnique.mockResolvedValue({ role: 'teacher' });
    await expect(link()).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.teacher.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an account without the teacher role', async () => {
    tx.profile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ role: where.id === actorProfileId ? 'admin' : 'user' }),
    );
    await expect(link()).rejects.toMatchObject({ statusCode: 422 });
    expect(tx.teacher.updateMany).not.toHaveBeenCalled();
  });

  it('rejects linking an inactive teacher', async () => {
    tx.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId: null, status: 'Inativo' });
    await expect(link()).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not overwrite a teacher already linked to a different account', async () => {
    tx.teacher.findUnique.mockResolvedValue({
      id: teacherId,
      profileId: '44444444-4444-4444-8444-444444444444',
      status: 'Ativo',
    });
    await expect(link()).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.teacherAccountLinkEvent.create).not.toHaveBeenCalled();
  });

  it('does not reuse a profile linked to another teacher', async () => {
    tx.teacher.findFirst.mockResolvedValue({ id: 'other-teacher' });
    await expect(link()).rejects.toMatchObject({ statusCode: 409 });
  });

  it('returns existing link idempotently without a second audit event', async () => {
    tx.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId, status: 'Ativo' });
    expect(await link()).toEqual({ teacherId, profileId });
    expect(tx.teacher.updateMany).not.toHaveBeenCalled();
    expect(tx.teacherAccountLinkEvent.create).not.toHaveBeenCalled();
  });

  it('detects racing changes of the same teacher', async () => {
    tx.teacher.updateMany.mockResolvedValue({ count: 0 });
    await expect(link()).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.teacherAccountLinkEvent.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent UNIQUE violation to a conflict instead of exposing database details', async () => {
    tx.teacher.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    );
    await expect(link()).rejects.toMatchObject({ statusCode: 409 });
  });

  it('unlinks and records the original account for future audit', async () => {
    tx.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId });
    expect(await repo.unlink({ teacherId, actorProfileId })).toEqual({
      teacherId, profileId: null,
    });
    expect(tx.teacher.updateMany).toHaveBeenCalledWith({
      where: { id: teacherId, profileId },
      data: { profileId: null },
    });
    expect(tx.teacherAccountLinkEvent.create).toHaveBeenCalledWith({
      data: { teacherId, profileId, actorProfileId, action: 'UNLINK' },
    });
  });

  it('does not write an audit entry for an already-unlinked teacher', async () => {
    expect(await repo.unlink({ teacherId, actorProfileId })).toEqual({
      teacherId, profileId: null,
    });
    expect(tx.teacherAccountLinkEvent.create).not.toHaveBeenCalled();
  });

  it('prevents double-unlink after an intervening reassignment', async () => {
    tx.teacher.findUnique.mockResolvedValue({ id: teacherId, profileId });
    tx.teacher.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.unlink({ teacherId, actorProfileId })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(tx.teacherAccountLinkEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a missing teacher instead of creating an orphan link', async () => {
    tx.teacher.findUnique.mockResolvedValue(null);
    await expect(link()).rejects.toMatchObject({ statusCode: 404 });
  });
});

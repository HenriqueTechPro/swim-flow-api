import type { PrismaService } from '../prisma.service';
import { PrismaPrivateMediaRecordsRepository } from './prisma-private-media-records-repository';

const id = '33333333-3333-4333-8333-333333333333';
const uploader = '11111111-1111-4111-8111-111111111111';
const student = '22222222-2222-4222-8222-222222222222';
const objectKey = 'private/students/' + student + '/' + id + '.png';

describe('Prisma private media metadata', () => {
  const prisma = {
    privateMediaObject: { create: jest.fn(), findUnique: jest.fn() },
  };
  const repository = new PrismaPrivateMediaRecordsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates only a pending record with internal object key', async () => {
    prisma.privateMediaObject.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    const input = {
      id,
      requestedById: uploader,
      target: 'student-photo' as const,
      resourceId: student,
      objectKey,
      declaredContentType: 'image/png',
      declaredSizeBytes: 1024,
      uploadExpiresAt: new Date('2026-10-25T15:00:00Z'),
    };
    const row = await repository.createPending(input);
    expect(prisma.privateMediaObject.create).toHaveBeenCalledWith({
      data: {
        ...input,
        target: 'STUDENT_PHOTO',
        status: 'PENDING',
      },
    });
    expect(row).toMatchObject({
      id,
      target: 'student-photo',
      status: 'PENDING',
      objectKey,
    });
  });

  it('looks up by opaque media ID and does not expose temporary URLs', async () => {
    prisma.privateMediaObject.findUnique.mockResolvedValue({
      id,
      requestedById: uploader,
      target: 'STUDENT_PHOTO',
      resourceId: student,
      objectKey,
      status: 'CONFIRMED',
    });
    expect(await repository.findById(id)).toMatchObject({
      id,
      target: 'student-photo',
      status: 'CONFIRMED',
    });
    expect(prisma.privateMediaObject.findUnique).toHaveBeenCalledWith({
      where: { id },
    });
  });
});

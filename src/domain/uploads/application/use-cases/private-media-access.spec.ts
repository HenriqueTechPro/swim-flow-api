import { AppError } from '@/shared/errors/app-error';
import type { PrivateMediaAccessRepository } from '../repositories/private-media-access-repository';
import type { PrivateMediaRecordsRepository } from '../repositories/private-media-records-repository';
import type { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { RequestPrivateMediaUploadUseCase } from './request-private-media-upload';
import { RequestPrivateMediaDownloadUseCase } from './request-private-media-download';

const actorId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const recordId = '33333333-3333-4333-8333-333333333333';

describe('Private media use cases (no routes, no live storage)', () => {
  const access = {
    canAccess: jest.fn(),
  };
  const records = {
    createPending: jest.fn(),
    findById: jest.fn(),
  };
  const storage = {
    signUpload: jest.fn(),
    signDownload: jest.fn(),
  };
  const upload = new RequestPrivateMediaUploadUseCase(
    access as unknown as PrivateMediaAccessRepository,
    records as unknown as PrivateMediaRecordsRepository,
    storage as unknown as PrivateMediaStorageRepository,
  );
  const download = new RequestPrivateMediaDownloadUseCase(
    access as unknown as PrivateMediaAccessRepository,
    records as unknown as PrivateMediaRecordsRepository,
    storage as unknown as PrivateMediaStorageRepository,
  );
  const actor = { id: actorId, role: 'teacher' as const };
  const file = {
    target: 'student-photo' as const,
    resourceId: studentId,
    fileSizeBytes: 1024,
    fileName: 'minor-sensitive-name.png',
    contentType: 'image/png',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    access.canAccess.mockResolvedValue(true);
    records.createPending.mockImplementation(async (value: unknown) => value);
    storage.signUpload.mockResolvedValue({
      method: 'PUT',
      url: 'https://private-storage.example/signed',
      expiresInSeconds: 90,
      headers: { 'Content-Type': 'image/png' },
    });
    storage.signDownload.mockResolvedValue({
      url: 'https://private-storage.example/read',
      expiresInSeconds: 60,
    });
  });

  it('writes a PENDING record before signing a PUT and never stores a URL', async () => {
    const calls: string[] = [];
    records.createPending.mockImplementation(async (input: unknown) => {
      calls.push('persist');
      return input;
    });
    storage.signUpload.mockImplementation(async () => {
      calls.push('sign');
      return { method: 'PUT', url: 'https://signed', headers: { 'Content-Type': 'image/png' }, expiresInSeconds: 90 };
    });

    const result = await upload.execute(actor, file);
    expect(calls).toEqual(['persist', 'sign']);
    expect(result.mediaId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.upload.method).toBe('PUT');
    expect(access.canAccess).toHaveBeenCalledWith({
      actor,
      operation: 'write',
      target: 'student-photo',
      resourceId: studentId,
    });
    const pending = records.createPending.mock.calls[0][0];
    expect(pending).toMatchObject({
      id: result.mediaId,
      requestedById: actorId,
      target: 'student-photo',
      resourceId: studentId,
      declaredContentType: 'image/png',
      declaredSizeBytes: 1024,
    });
    expect(pending.objectKey).toBe(
      'private/students/' + studentId + '/' + result.mediaId + '.png',
    );
    expect(pending.objectKey).not.toContain(file.fileName);
    expect(JSON.stringify(pending)).not.toContain('https://');
  });

  it('normalizes image/jpg to a safe MIME before persisting and signing', async () => {
    await upload.execute(actor, { ...file, contentType: 'image/jpg' });
    expect(records.createPending.mock.calls[0][0]).toMatchObject({
      declaredContentType: 'image/jpeg',
      objectKey: expect.stringMatching(/\.jpg$/),
    });
    expect(storage.signUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });

  it('rejects cross-class uploads before creating credentials or metadata', async () => {
    access.canAccess.mockResolvedValue(false);
    await expect(upload.execute(actor, file)).rejects.toBeInstanceOf(AppError);
    expect(records.createPending).not.toHaveBeenCalled();
    expect(storage.signUpload).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before querying students', async () => {
    await expect(
      upload.execute(actor, { ...file, resourceId: '../other-person' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      upload.execute(actor, { ...file, fileSizeBytes: 6 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(AppError);
    expect(access.canAccess).not.toHaveBeenCalled();
    expect(records.createPending).not.toHaveBeenCalled();
  });

  it('retains a pending row for later cleanup when signing fails', async () => {
    storage.signUpload.mockRejectedValue(new Error('R2 unavailable'));
    await expect(upload.execute(actor, file)).rejects.toThrow('R2 unavailable');
    expect(records.createPending).toHaveBeenCalledTimes(1);
  });

  it('refuses unconfirmed, missing and malformed media without signing GET', async () => {
    records.findById.mockResolvedValue({
      id: recordId,
      target: 'student-photo',
      resourceId: studentId,
      status: 'PENDING',
      objectKey: 'private/students/key.png',
    });
    await expect(download.execute(actor, recordId)).rejects.toBeInstanceOf(AppError);
    records.findById.mockResolvedValue(null);
    await expect(download.execute(actor, recordId)).rejects.toBeInstanceOf(AppError);
    await expect(download.execute(actor, '../bad')).rejects.toBeInstanceOf(AppError);
    expect(storage.signDownload).not.toHaveBeenCalled();
    expect(access.canAccess).not.toHaveBeenCalled();
  });

  it('checks CURRENT scope before every confirmed-media GET', async () => {
    const objectKey =
      'private/students/' + studentId + '/' + recordId + '.png';
    records.findById.mockResolvedValue({
      id: recordId,
      target: 'student-photo',
      resourceId: studentId,
      status: 'CONFIRMED',
      objectKey,
    });
    access.canAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const authorized = await download.execute(actor, recordId);
    expect(authorized.expiresInSeconds).toBe(60);
    expect(storage.signDownload).toHaveBeenCalledWith(objectKey);
    await expect(download.execute(actor, recordId)).rejects.toBeInstanceOf(AppError);
    expect(storage.signDownload).toHaveBeenCalledTimes(1);
    expect(access.canAccess).toHaveBeenNthCalledWith(2, {
      actor,
      operation: 'read',
      target: 'student-photo',
      resourceId: studentId,
    });
  });
});

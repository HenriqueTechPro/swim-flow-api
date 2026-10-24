import { AppError } from '@/shared/errors/app-error';
import {
  MAX_PRIVATE_IMAGE_BYTES,
  planPrivateImageUpload,
} from './private-image-upload-policy';

const actorId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const objectId = '33333333-3333-4333-8333-333333333333';
const plan = (overrides: Record<string, unknown> = {}) =>
  planPrivateImageUpload(
    actorId,
    {
      target: 'student-photo',
      resourceId: studentId,
      fileName: '../../sensitive-name.png',
      contentType: 'image/png',
      fileSizeBytes: 10_000,
      ...overrides,
    },
    () => objectId,
  );

describe('Private image upload policy (R2 staging, no network)', () => {
  it('generates a unique server-owned key, never the browser filename', () => {
    expect(plan()).toEqual({
      key: `students/${studentId}/${objectId}.png`,
      contentType: 'image/png',
      contentLength: 10_000,
      visibility: 'private',
    });
    expect(plan().key).not.toContain('sensitive-name');
    expect(plan({ fileName: 'different.gif' }).key).toBe(plan().key);
  });

  it('uses actor identity for avatars, not a supplied resource', () => {
    expect(plan({ target: 'profile-avatar', resourceId: undefined }).key)
      .toBe(`profiles/${actorId}/${objectId}.png`);
    expect(() => plan({ target: 'profile-avatar', resourceId: studentId }))
      .toThrow(AppError);
  });

  it('supports exactly the existing image MIME types', () => {
    const cases = [
      ['image/jpeg', 'jpg'],
      ['image/jpg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['image/gif', 'gif'],
    ];
    for (const [mime, extension] of cases) {
      const result = plan({ contentType: mime });
      expect(result.key).toMatch(new RegExp(`\\.${extension}$`));
      expect(result.contentType).toBe(
        mime === 'image/jpg' ? 'image/jpeg' : mime,
      );
    }
    for (const bad of ['image/svg+xml', 'text/html', 'application/pdf', '']) {
      expect(() => plan({ contentType: bad })).toThrow(AppError);
    }
  });

  it('rejects oversize, missing, fractional and invalid image byte lengths', () => {
    for (const bad of [-1, 0, NaN, Infinity, 2.5, 2 ** 55]) {
      expect(() => plan({ fileSizeBytes: bad })).toThrow(AppError);
    }
    expect(() => plan({ fileSizeBytes: MAX_PRIVATE_IMAGE_BYTES + 1 }))
      .toThrow(expect.objectContaining({ statusCode: 413 }));
    expect(plan({ fileSizeBytes: MAX_PRIVATE_IMAGE_BYTES }).contentLength)
      .toBe(MAX_PRIVATE_IMAGE_BYTES);
  });

  it('rejects invalid actor/resource identifiers and arbitrary object keys', () => {
    expect(() => plan({ resourceId: '../path-traversal' })).toThrow(AppError);
    expect(() => plan({ resourceId: '' })).toThrow(AppError);
    expect(() => planPrivateImageUpload(
      '../../user',
      {
        target: 'profile-avatar', fileName: 'x.png',
        contentType: 'image/png', fileSizeBytes: 1,
      },
    )).toThrow(AppError);
    expect(() => planPrivateImageUpload(
      actorId,
      {
        target: 'profile-avatar', fileName: 'x.png',
        contentType: 'image/png', fileSizeBytes: 1,
      },
      () => '../bad-key',
    )).toThrow(AppError);
  });

  it('never includes a public object URL in its contract', () => {
    expect(plan()).not.toHaveProperty('publicUrl');
    expect(plan()).not.toHaveProperty('token');
    expect(plan()).not.toHaveProperty('bucket');
  });
});

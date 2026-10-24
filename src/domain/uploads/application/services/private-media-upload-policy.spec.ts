import {
  createPrivateMediaObjectKey,
  MAX_PRIVATE_IMAGE_BYTES,
  PRIVATE_GET_URL_TTL_SECONDS,
  PRIVATE_PUT_URL_TTL_SECONDS,
  PrivateMediaUploadPolicyError,
  validatePrivateMediaUpload,
  type PrivateMediaUploadInput,
} from './private-media-upload-policy';

const actorId = '11111111-1111-4111-8111-111111111111';
const resourceId = '22222222-2222-4222-8222-222222222222';
const objectId = '33333333-3333-4333-8333-333333333333';

const input: PrivateMediaUploadInput = {
  target: 'student-photo',
  fileName: '../../secret-name-of-minor.png',
  contentType: 'image/png',
  fileSizeBytes: 350_000,
  resourceId,
};

describe('Private media policies (S3-compatible storage, no live bucket)', () => {
  it('generates a non-PII key and never interpolates the browser filename', () => {
    const key = createPrivateMediaObjectKey(actorId, input, objectId);
    expect(key).toBe(`private/students/${resourceId}/${objectId}.png`);
    expect(key).not.toContain('secret-name');
    expect(key).not.toContain('..');
    expect(key).not.toContain(actorId);
    expect(key).not.toContain('?');
  });

  it.each([
    ['student-photo', 'students'],
    ['teacher-photo', 'teachers'],
    ['parent-photo', 'parents'],
  ] as const)(
    'uses the %s scope only with an explicit existing entity ID',
    (target, segment) => {
      expect(
        createPrivateMediaObjectKey(actorId, { ...input, target }, objectId),
      ).toBe(`private/${segment}/${resourceId}/${objectId}.png`);
    },
  );

  it('restricts avatar scope to the signed-in profile, with randomized names', () => {
    const avatar: PrivateMediaUploadInput = {
      target: 'profile-avatar',
      contentType: 'image/jpeg',
      fileName: 'staff.jpeg',
      fileSizeBytes: 1024,
    };
    expect(createPrivateMediaObjectKey(actorId, avatar, objectId)).toBe(
      `private/profiles/${actorId}/${objectId}.jpg`,
    );
    expect(createPrivateMediaObjectKey(actorId, avatar)).toMatch(
      /^private\/profiles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/,
    );
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif'],
  ])('accepts %s with extension %s', (contentType, extension) => {
    expect(
      createPrivateMediaObjectKey(actorId, { ...input, contentType }, objectId),
    ).toMatch(new RegExp(`\\.${extension}$`));
  });

  it.each([
    'image/svg+xml',
    'text/html',
    'application/octet-stream',
    'image/png; charset=utf-8',
    '',
  ])('rejects a potentially unsafe or unsupported MIME: %s', (contentType) => {
    expect(() =>
      validatePrivateMediaUpload(actorId, { ...input, contentType }),
    ).toThrow(new PrivateMediaUploadPolicyError('invalid-content-type'));
  });

  it.each([0, -1, 0.1, NaN, Infinity, MAX_PRIVATE_IMAGE_BYTES + 1])(
    'rejects invalid sizes without allocating content: %s',
    (fileSizeBytes) => {
      expect(() =>
        validatePrivateMediaUpload(actorId, { ...input, fileSizeBytes }),
      ).toThrow(new PrivateMediaUploadPolicyError('invalid-file-size'));
    },
  );

  it('accepts exactly 5 MB (the current frontend maximum)', () => {
    expect(
      validatePrivateMediaUpload(actorId, {
        ...input,
        fileSizeBytes: MAX_PRIVATE_IMAGE_BYTES,
      }),
    ).toBe('png');
  });

  it('rejects ID traversal, arbitrary strings and avatar cross-profile writes', () => {
    expect(() =>
      createPrivateMediaObjectKey('../private', input, objectId),
    ).toThrow(new PrivateMediaUploadPolicyError('invalid-identity'));
    expect(() =>
      createPrivateMediaObjectKey(
        actorId,
        {
          ...input,
          resourceId: '../another-profile',
        },
        objectId,
      ),
    ).toThrow(new PrivateMediaUploadPolicyError('invalid-resource'));
    expect(() =>
      createPrivateMediaObjectKey(
        actorId,
        {
          ...input,
          target: 'profile-avatar',
        },
        objectId,
      ),
    ).toThrow(new PrivateMediaUploadPolicyError('invalid-resource'));
    expect(() =>
      createPrivateMediaObjectKey(actorId, input, '../../escape'),
    ).toThrow(new PrivateMediaUploadPolicyError('invalid-resource'));
  });

  it('sets brief signed URL TTLs for private access and upload', () => {
    expect(PRIVATE_PUT_URL_TTL_SECONDS).toBeLessThanOrEqual(120);
    expect(PRIVATE_GET_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });
});

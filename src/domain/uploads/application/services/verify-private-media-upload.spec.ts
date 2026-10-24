import {
  PrivateMediaVerificationError,
  verifyPrivateImageObject,
} from './verify-private-media-upload';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x20, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

function verify(overrides: Record<string, unknown> = {}) {
  return verifyPrivateImageObject({
    declaredContentType: 'image/png',
    declaredSizeBytes: 1024,
    observedContentType: 'image/png',
    observedSizeBytes: 1024,
    firstBytes: png,
    ...overrides,
  });
}

describe('Private S3 media byte verification (offline)', () => {
  it.each([
    ['image/png', png],
    ['image/jpeg', jpeg],
    ['image/gif', gif],
    ['image/webp', webp],
  ])('accepts genuine %s magic numbers', (mime, bytes) => {
    expect(
      verify({
        declaredContentType: mime,
        observedContentType: mime,
        firstBytes: bytes,
      }),
    ).toBe(mime);
  });

  it('canonicalizes the JPG alias', () => {
    expect(
      verify({
        declaredContentType: 'image/jpg',
        observedContentType: 'image/jpeg',
        firstBytes: jpeg,
      }),
    ).toBe('image/jpeg');
  });

  it('rejects a spoofed MIME type even if headers say PNG', () => {
    expect(() => verify({ firstBytes: jpeg })).toThrow(
      new PrivateMediaVerificationError('invalid-file-signature'),
    );
  });

  it('rejects missing observed MIME', () => {
    expect(() => verify({ observedContentType: undefined })).toThrow(
      new PrivateMediaVerificationError('invalid-content-type'),
    );
  });

  it('rejects MIME mismatches', () => {
    expect(() => verify({ observedContentType: 'image/gif' })).toThrow(
      new PrivateMediaVerificationError('invalid-content-type'),
    );
  });

  it.each([0, -1, 5 * 1024 * 1024 + 1, 1025, 0.5, NaN])(
    'rejects unexpected observed object size %s',
    (size) => {
      expect(() => verify({ observedSizeBytes: size })).toThrow(
        new PrivateMediaVerificationError('invalid-file-size'),
      );
    },
  );

  it('rejects client-declared size different from HEAD result', () => {
    expect(() => verify({ declaredSizeBytes: 2048 })).toThrow(
      new PrivateMediaVerificationError('invalid-file-size'),
    );
  });

  it('rejects too-short signatures and arbitrary HTML', () => {
    expect(() => verify({ firstBytes: new Uint8Array([0x89]) })).toThrow(
      new PrivateMediaVerificationError('invalid-file-signature'),
    );
    expect(() => verify({ firstBytes: Buffer.from('<html>') })).toThrow(
      new PrivateMediaVerificationError('invalid-file-signature'),
    );
  });
});

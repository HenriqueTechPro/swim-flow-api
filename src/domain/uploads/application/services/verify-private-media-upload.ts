import { MAX_PRIVATE_IMAGE_BYTES } from './private-media-upload-policy';

export type VerifiedPrivateImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export class PrivateMediaVerificationError extends Error {
  constructor(
    public readonly code:
      | 'invalid-content-type'
      | 'invalid-file-size'
      | 'invalid-file-signature',
  ) {
    super(code);
    this.name = 'PrivateMediaVerificationError';
  }
}

function canonicalMime(value: string | undefined) {
  const normalized = value?.toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasImageSignature(mime: string, bytes: Uint8Array) {
  switch (mime) {
    case 'image/png':
      return startsWith(bytes, [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/gif':
      return (
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      );
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
      );
    default:
      return false;
  }
}

/**
 * Verify observed HEAD metadata plus a short GET Range prefix BEFORE recording
 * an uploaded object as usable. Both checks are required: browser MIME and
 * client-declared size cannot be trusted.
 *
 * Magic numbers are an initial integrity gate, not a complete image decoder.
 */
export function verifyPrivateImageObject(input: {
  declaredContentType: string;
  declaredSizeBytes: number;
  observedContentType: string | undefined;
  observedSizeBytes: number;
  firstBytes: Uint8Array;
}): VerifiedPrivateImageContentType {
  const expectedMime = canonicalMime(input.declaredContentType);
  const observedMime = canonicalMime(input.observedContentType);

  if (
    !expectedMime ||
    !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      expectedMime,
    ) ||
    observedMime !== expectedMime
  ) {
    throw new PrivateMediaVerificationError('invalid-content-type');
  }

  if (
    !Number.isSafeInteger(input.declaredSizeBytes) ||
    !Number.isSafeInteger(input.observedSizeBytes) ||
    input.observedSizeBytes <= 0 ||
    input.observedSizeBytes > MAX_PRIVATE_IMAGE_BYTES ||
    input.observedSizeBytes !== input.declaredSizeBytes
  ) {
    throw new PrivateMediaVerificationError('invalid-file-size');
  }

  if (!hasImageSignature(expectedMime, input.firstBytes)) {
    throw new PrivateMediaVerificationError('invalid-file-signature');
  }

  return expectedMime as VerifiedPrivateImageContentType;
}

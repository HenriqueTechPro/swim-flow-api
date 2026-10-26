/**
 * Untrusted bytes are decoded and re-encoded before the storage adapter
 * receives them. No filename, original EXIF, animation or SVG is preserved.
 */
export interface NormalizedPrivateBlobImage {
  bytes: Uint8Array;
  contentType: 'image/jpeg';
}

export abstract class PrivateBlobImageProcessor {
  abstract normalize(
    bytes: Uint8Array,
    declaredContentType: string,
  ): Promise<NormalizedPrivateBlobImage>;
}

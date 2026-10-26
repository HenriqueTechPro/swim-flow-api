import sharp from 'sharp';
import { PrivateBlobImageProcessor } from '@/domain/uploads/application/repositories/private-blob-image-processor';
import { MAX_PRIVATE_IMAGE_BYTES } from '@/domain/uploads/application/services/private-media-upload-policy';

const MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 10_000;
const MAX_EDGE = 2048;
const ACCEPTED_FORMATS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Sharp strips EXIF, GPS, ICC and other embedded metadata by default
 * on the output. Fail-closed decode and one-frame-only policy prevent
 * malformed or animated uploads from reaching the private Blob store.
 */
export class SharpPrivateBlobImageProcessor extends PrivateBlobImageProcessor {
  async normalize(
    bytes: Uint8Array,
    declaredContentType: string,
  ): Promise<{ bytes: Uint8Array; contentType: 'image/jpeg' }> {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength < 8 ||
      bytes.byteLength > MAX_PRIVATE_IMAGE_BYTES
    ) {
      throw new Error('invalid-private-image-input-size');
    }
    const normalized = declaredContentType.toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : declaredContentType.toLowerCase();
    const expectedFormat = ACCEPTED_FORMATS[normalized];
    if (!expectedFormat) {
      throw new Error('invalid-private-image-input-format');
    }

    try {
      const input = Buffer.from(bytes);
      const meta = await sharp(input, {
        failOn: 'warning',
        limitInputPixels: MAX_PIXELS,
        animated: true,
      }).metadata();

      if (
        meta.format !== expectedFormat ||
        !meta.width ||
        !meta.height ||
        meta.width > MAX_DIMENSION ||
        meta.height > MAX_DIMENSION ||
        meta.width * meta.height > MAX_PIXELS ||
        (meta.pages ?? 1) !== 1
      ) {
        throw new Error('invalid-private-image-decoded-format');
      }

      const output = await sharp(input, {
        failOn: 'warning',
        limitInputPixels: MAX_PIXELS,
        animated: false,
      })
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      if (
        output.length === 0 ||
        output.length > MAX_PRIVATE_IMAGE_BYTES ||
        output[0] !== 0xff ||
        output[1] !== 0xd8 ||
        output[2] !== 0xff
      ) {
        throw new Error('invalid-private-image-output');
      }
      return { bytes: output, contentType: 'image/jpeg' };
    } catch {
      // Never include libvips details, original filenames or EXIF data in logs.
      throw new Error('invalid-private-image-content');
    }
  }
}

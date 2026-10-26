import sharp from 'sharp';
import { SharpPrivateBlobImageProcessor } from './sharp-private-blob-image-processor';

const processImage = new SharpPrivateBlobImageProcessor();

async function png() {
  return sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: '#336699',
    },
  })
    .png()
    .toBuffer();
}

describe('Safe private image normalization (real decoder, offline)', () => {
  it('fully decodes PNG and converts it to a clean JPEG', async () => {
    const bytes = await png();
    const output = await processImage.normalize(bytes, 'image/png');
    expect(output.contentType).toBe('image/jpeg');
    expect([...output.bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const decoded = await sharp(Buffer.from(output.bytes)).metadata();
    expect(decoded.format).toBe('jpeg');
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.exif).toBeUndefined();
    expect(decoded.xmp).toBeUndefined();
    expect(decoded.iptc).toBeUndefined();
  });

  it('removes embedded EXIF/GPS-like data when re-encoding', async () => {
    const source = await sharp(await png())
      .withExif({
        IFD0: { ImageDescription: 'sensitive child photo metadata' },
      })
      .png()
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();
    const result = await processImage.normalize(source, 'image/png');
    const metadata = await sharp(Buffer.from(result.bytes)).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(
      Buffer.from(result.bytes).includes(
        Buffer.from('sensitive child photo metadata'),
      ),
    ).toBe(false);
  });

  it('refuses unsupported formats, malformed data and forged MIME', async () => {
    const source = await png();
    await expect(processImage.normalize(source, 'image/gif')).rejects.toThrow(
      'invalid-private-image-content',
    );
    await expect(
      processImage.normalize(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        'image/svg+xml',
      ),
    ).rejects.toThrow('invalid-private-image-input-format');
    await expect(
      processImage.normalize(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]),
        'image/png',
      ),
    ).rejects.toThrow('invalid-private-image-content');
  });

  it('refuses empty/oversized inputs before invoking image decode', async () => {
    for (const bytes of [
      new Uint8Array(0),
      new Uint8Array(5 * 1024 * 1024 + 1),
    ]) {
      await expect(processImage.normalize(bytes, 'image/png')).rejects.toThrow(
        'invalid-private-image-input-size',
      );
    }
  });
});

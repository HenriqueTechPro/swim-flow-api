import { isStrongPrivateMediaEtag } from './private-media-etag-policy';

describe('Strong S3/R2 private object ETag policy', () => {
  it('accepts strong quoted opaque tokens, not only MD5s', () => {
    expect(isStrongPrivateMediaEtag('"d41d8cd98f00b204e9800998ecf8427e"')).toBe(true);
    expect(isStrongPrivateMediaEtag('"multipart-or-opaque-2"')).toBe(true);
  });

  it.each([
    null,
    undefined,
    '',
    'weak-token',
    'W/"weak"',
    '"has space"',
    '"header\r\ninjection"',
    '"quote"inside"',
    '"' + 'a'.repeat(129) + '"',
  ])('rejects an unsafe or weak validator: %s', (etag) => {
    expect(isStrongPrivateMediaEtag(etag)).toBe(false);
  });
});

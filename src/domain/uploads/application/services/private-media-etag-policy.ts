/**
 * R2 / S3 strong, quoted ETag. ETags are opaque object validators, NOT a
 * cryptographic content hash; multipart ETags are especially not MD5s.
 * Restrict characters before sending the token to AWS request headers.
 */
export function isStrongPrivateMediaEtag(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    /^"[A-Za-z0-9-]{1,120}"$/.test(value)
  );
}

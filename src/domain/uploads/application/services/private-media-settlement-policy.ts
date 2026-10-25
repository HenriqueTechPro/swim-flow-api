/**
 * A presigned PUT may be reused until expiry and uploads already in-flight
 * can outlive that timestamp. Delay verification and cleanup to reduce the
 * chance of treating mutable bytes as final. This grace is NOT a guarantee
 * of S3 object immutability: see 02E-16B.4 rollout documentation.
 */
export const PRIVATE_MEDIA_SETTLEMENT_MS = 2 * 60 * 1000;
export const PRIVATE_MEDIA_SIGNATURE_READ_BYTES = 64;

export function settledBefore(now: Date): Date {
  return new Date(now.getTime() - PRIVATE_MEDIA_SETTLEMENT_MS);
}

/**
 * Transport-independent contract for a future Vercel PRIVATE Blob adapter.
 *
 * Unlike S3 presigned PUT/GET, these operations require an authenticated
 * server credential. The future application use case MUST recheck current
 * actor/target authorization and validate/re-encode image bytes before put.
 * Blob URLs, pathnames and UUIDs must NEVER be treated as permissions.
 */
export interface PrivateBlobWrite {
  pathname: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

export interface StoredPrivateBlob {
  pathname: string;
  etag: string;
  sizeBytes: number;
  contentType: string;
}

export interface ReadPrivateBlob {
  pathname: string;
  etag: string;
  contentType: string;
  sizeBytes: number;
  stream: AsyncIterable<Uint8Array>;
}

export abstract class PrivateBlobStorageRepository {
  /** The adapter must always set access: private and allowOverwrite: false. */
  abstract put(input: PrivateBlobWrite): Promise<StoredPrivateBlob>;

  /** Caller must have up-to-date permission to access this stored record. */
  abstract get(pathname: string): Promise<ReadPrivateBlob | null>;

  /** Only a privileged internal retention/cleanup operation may call this. */
  abstract delete(pathname: string, etag: string): Promise<void>;
}

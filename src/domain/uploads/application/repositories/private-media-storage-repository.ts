/**
 * Internal private-object storage port. Not injected into a controller yet.
 * Authorization and object ownership must be verified by the application
 * before signing GETs, PUTs or deleting objects.
 */
export interface PrivateMediaPutTicket {
  method: 'PUT';
  url: string;
  headers: { 'Content-Type': string; 'If-None-Match': '*' };
  expiresInSeconds: number;
}

export interface PrivateMediaReadTicket {
  url: string;
  headers: { 'If-Match': string };
  expiresInSeconds: number;
}

export interface PrivateMediaObjectInfo {
  contentType: string | undefined;
  sizeBytes: number;
  etag: string | undefined;
}

export abstract class PrivateMediaStorageRepository {
  abstract signUpload(input: {
    objectKey: string;
    contentType: string;
  }): Promise<PrivateMediaPutTicket>;

  abstract headObject(
    objectKey: string,
  ): Promise<PrivateMediaObjectInfo | null>;

  /** Read only the prefix needed to validate a file signature. */
  abstract readPrefix(
    objectKey: string,
    maxBytes: number,
    etag: string,
  ): Promise<Uint8Array>;

  /** Never call before revalidating the requesting actor's access. */
  abstract signDownload(
    objectKey: string,
    etag: string,
  ): Promise<PrivateMediaReadTicket>;

  abstract deleteObject(objectKey: string): Promise<void>;
}

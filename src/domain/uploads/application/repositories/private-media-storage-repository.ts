/**
 * Internal private-object storage port. Not injected into a controller yet.
 * Authorization and object ownership must be verified by the application
 * before signing GETs, PUTs or deleting objects.
 */
export interface PrivateMediaPutTicket {
  method: 'PUT';
  url: string;
  headers: { 'Content-Type': string };
  expiresInSeconds: number;
}

export interface PrivateMediaReadTicket {
  url: string;
  expiresInSeconds: number;
}

export interface PrivateMediaObjectInfo {
  contentType: string | undefined;
  sizeBytes: number;
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
  ): Promise<Uint8Array>;

  /** Never call before revalidating the requesting actor's access. */
  abstract signDownload(objectKey: string): Promise<PrivateMediaReadTicket>;

  abstract deleteObject(objectKey: string): Promise<void>;
}

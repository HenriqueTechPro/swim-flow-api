import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PRIVATE_GET_URL_TTL_SECONDS,
  PRIVATE_PUT_URL_TTL_SECONDS,
} from '@/domain/uploads/application/services/private-media-upload-policy';
import {
  PrivateMediaStorageRepository,
  type PrivateMediaObjectInfo,
  type PrivateMediaPutTicket,
  type PrivateMediaReadTicket,
} from '@/domain/uploads/application/repositories/private-media-storage-repository';

const UUID_PART =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PRIVATE_OBJECT_KEY = new RegExp(
  `^private/(?:profiles|students|teachers|parents)/${UUID_PART}/${UUID_PART}\\.(?:jpg|png|gif|webp)$`,
  'i',
);
const ALLOWED_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_SIGNATURE_READ_BYTES = 64;

export interface PrivateS3Settings {
  enabled: boolean;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

function requirePrivateObjectKey(key: string): void {
  if (!PRIVATE_OBJECT_KEY.test(key)) {
    throw new Error('invalid-private-media-object-key');
  }
}

function requireSignedContentType(key: string, type: string): string {
  const normalized = type.trim().toLowerCase();
  const canonical = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
  const expectedExtension = ALLOWED_TYPES[canonical];
  if (
    !expectedExtension ||
    !key.toLowerCase().endsWith(`.${expectedExtension}`)
  ) {
    throw new Error('invalid-private-media-content-type');
  }
  return canonical;
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const awsError = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    awsError.$metadata?.httpStatusCode === 404 ||
    awsError.name === 'NotFound' ||
    awsError.name === 'NoSuchKey'
  );
}

/**
 * S3-compatible transport only. This class is NOT a permission boundary:
 * callers must authorize the actor and target resource before EVERY operation.
 * It is deliberately not registered with Nest or called from an HTTP route.
 */
export class S3PrivateMediaStorageRepository extends PrivateMediaStorageRepository {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {
    super();
  }

  async signUpload(input: {
    objectKey: string;
    contentType: string;
  }): Promise<PrivateMediaPutTicket> {
    requirePrivateObjectKey(input.objectKey);
    const contentType = requireSignedContentType(
      input.objectKey,
      input.contentType,
    );
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        ContentType: contentType,
      }),
      {
        expiresIn: PRIVATE_PUT_URL_TTL_SECONDS,
        signableHeaders: new Set(['content-type']),
      },
    );
    return {
      method: 'PUT',
      url,
      headers: { 'Content-Type': contentType },
      expiresInSeconds: PRIVATE_PUT_URL_TTL_SECONDS,
    };
  }

  async headObject(objectKey: string): Promise<PrivateMediaObjectInfo | null> {
    requirePrivateObjectKey(objectKey);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      if (
        response.ContentLength === undefined ||
        !Number.isSafeInteger(response.ContentLength) ||
        response.ContentLength < 0
      ) {
        throw new Error('invalid-private-media-object-size');
      }
      return {
        contentType: response.ContentType,
        sizeBytes: response.ContentLength,
      };
    } catch (error: unknown) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async readPrefix(objectKey: string, maxBytes: number): Promise<Uint8Array> {
    requirePrivateObjectKey(objectKey);
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= 0 ||
      maxBytes > MAX_SIGNATURE_READ_BYTES
    ) {
      throw new Error('invalid-private-media-read-range');
    }
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: `bytes=0-${maxBytes - 1}`,
      }),
    );
    if (
      !response.Body ||
      typeof (response.Body as { [Symbol.asyncIterator]?: unknown })[
        Symbol.asyncIterator
      ] !== 'function'
    ) {
      throw new Error('missing-private-media-object-body');
    }
    const stream = response.Body as AsyncIterable<Uint8Array>;
    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += bytes.byteLength;
      // Never buffer an entire unbounded object if a provider ignores Range.
      if (received > maxBytes) {
        throw new Error('unexpected-private-media-object-range');
      }
      chunks.push(bytes);
    }
    return new Uint8Array(Buffer.concat(chunks, received));
  }

  async signDownload(objectKey: string): Promise<PrivateMediaReadTicket> {
    requirePrivateObjectKey(objectKey);
    return {
      url: await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
        { expiresIn: PRIVATE_GET_URL_TTL_SECONDS },
      ),
      expiresInSeconds: PRIVATE_GET_URL_TTL_SECONDS,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    requirePrivateObjectKey(objectKey);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }
}

/**
 * Explicit factory to avoid constructing an SDK client when disabled.
 * Do not wire it into request handling before object ownership and
 * authorization are implemented in a separate use case.
 */
export function createPrivateMediaS3Repository(
  config: PrivateS3Settings,
): S3PrivateMediaStorageRepository {
  if (
    !config.enabled ||
    !config.endpoint ||
    !config.region ||
    !config.bucket ||
    !config.accessKeyId ||
    !config.secretAccessKey
  ) {
    throw new Error('private-media-s3-not-enabled-or-incomplete');
  }
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return new S3PrivateMediaStorageRepository(client, config.bucket);
}

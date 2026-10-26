import { BlobNotFoundError, del, get, head, put } from '@vercel/blob';
import { MAX_PRIVATE_IMAGE_BYTES } from '@/domain/uploads/application/services/private-media-upload-policy';
import { verifyPrivateImageObject } from '@/domain/uploads/application/services/verify-private-media-upload';
import { isStrongPrivateMediaEtag } from '@/domain/uploads/application/services/private-media-etag-policy';
import {
  PrivateBlobStorageRepository,
  type PrivateBlobWrite,
  type ReadPrivateBlob,
  type StoredPrivateBlob,
} from '@/domain/uploads/application/repositories/private-blob-storage-repository';
import type { PrivateVercelBlobConfig } from './private-vercel-blob-config';

type BlobSdk = Pick<
  typeof import('@vercel/blob'),
  'put' | 'head' | 'get' | 'del'
>;

const SDK: BlobSdk = { put, head, get, del };
const UUID_PART =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PRIVATE_PATHNAME = new RegExp(
  `^private/(?:profiles|students|teachers|parents)/${UUID_PART}/${UUID_PART}\\.(?:jpg|png|webp|gif)$`,
  'i',
);
const MIME_EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function requirePrivatePathname(pathname: string): void {
  if (!PRIVATE_PATHNAME.test(pathname)) {
    throw new Error('invalid-private-blob-pathname');
  }
}

function requirePrivateBlobUrl(value: string, pathname: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('invalid-private-blob-host');
  }
  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== `/${pathname}`
  ) {
    throw new Error('invalid-private-blob-host');
  }
}

function requireStrongEtag(etag: string): void {
  if (!isStrongPrivateMediaEtag(etag)) {
    throw new Error('invalid-private-blob-etag');
  }
}

function requireBlobMetadata(
  pathname: string,
  metadata: {
    pathname: string;
    contentType: string | null;
    size: number | null;
    etag: string;
    url: string;
  },
): asserts metadata is {
  pathname: string;
  contentType: string;
  size: number;
  etag: string;
  url: string;
} {
  requirePrivatePathname(pathname);
  if (
    metadata.pathname !== pathname ||
    typeof metadata.contentType !== 'string' ||
    !MIME_EXTENSION[metadata.contentType] ||
    !pathname.endsWith(MIME_EXTENSION[metadata.contentType]) ||
    metadata.size === null ||
    !Number.isSafeInteger(metadata.size) ||
    metadata.size <= 0 ||
    metadata.size > MAX_PRIVATE_IMAGE_BYTES
  ) {
    throw new Error('invalid-private-blob-metadata');
  }
  requireStrongEtag(metadata.etag);
  requirePrivateBlobUrl(metadata.url, pathname);
}

/**
 * Opt-in transport adapter ONLY: no Nest registration or HTTP routes.
 * Authorization, resource ownership, DB transaction and complete image
 * re-encoding belong to the application layer before this can go live.
 *
 * Only the backend receives the opaque token. Never return SDK blob URLs
 * to the browser, use VITE_* for credentials or log SDK response objects.
 */
export class VercelPrivateBlobStorageRepository extends PrivateBlobStorageRepository {
  constructor(
    private readonly token: string,
    private readonly sdk: BlobSdk = SDK,
  ) {
    super();
    if (!token || token.length < 32) {
      throw new Error('invalid-private-blob-credentials');
    }
  }

  async put(input: PrivateBlobWrite): Promise<StoredPrivateBlob> {
    requirePrivatePathname(input.pathname);
    const expectedExtension = MIME_EXTENSION[input.contentType];
    if (!expectedExtension || !input.pathname.endsWith(expectedExtension)) {
      throw new Error('invalid-private-blob-content-type');
    }
    if (
      !(input.bytes instanceof Uint8Array) ||
      input.bytes.byteLength <= 0 ||
      input.bytes.byteLength > MAX_PRIVATE_IMAGE_BYTES
    ) {
      throw new Error('invalid-private-blob-size');
    }
    verifyPrivateImageObject({
      declaredContentType: input.contentType,
      declaredSizeBytes: input.bytes.byteLength,
      observedContentType: input.contentType,
      observedSizeBytes: input.bytes.byteLength,
      firstBytes: input.bytes.subarray(0, 64),
    });

    const uploaded = await this.sdk.put(
      input.pathname,
      Buffer.from(input.bytes),
      {
        access: 'private',
        token: this.token,
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: input.contentType,
        cacheControlMaxAge: 60,
      },
    );
    if (
      uploaded.pathname !== input.pathname ||
      uploaded.contentType !== input.contentType
    ) {
      throw new Error('invalid-private-blob-upload-response');
    }
    requirePrivateBlobUrl(uploaded.url, input.pathname);
    requireStrongEtag(uploaded.etag);

    // The SDK put() response doesn't expose the size. Verify it through
    // HEAD before trusting the bytes as a candidate for DB persistence.
    const observed = await this.sdk.head(input.pathname, { token: this.token });
    requireBlobMetadata(input.pathname, observed);
    if (
      observed.contentType !== input.contentType ||
      observed.size !== input.bytes.byteLength ||
      observed.etag !== uploaded.etag
    ) {
      throw new Error('private-blob-object-changed-during-upload');
    }
    return {
      pathname: input.pathname,
      etag: uploaded.etag,
      sizeBytes: observed.size,
      contentType: observed.contentType,
    };
  }

  async get(
    pathname: string,
    expectedEtag: string,
  ): Promise<ReadPrivateBlob | null> {
    requirePrivatePathname(pathname);
    requireStrongEtag(expectedEtag);
    const received = await this.sdk.get(pathname, {
      access: 'private',
      token: this.token,
      useCache: false,
      headers: { 'If-Match': expectedEtag },
    });
    if (received === null) return null;
    if (received.statusCode !== 200 || !received.stream) {
      throw new Error('invalid-private-blob-read-response');
    }
    requireBlobMetadata(pathname, {
      ...received.blob,
      size: received.blob.size,
    });
    if (received.blob.etag !== expectedEtag) {
      throw new Error('private-blob-object-version-changed');
    }

    // Node 22 supports async iteration of web ReadableStreams. The
    // caller controls backpressure and must close the stream on errors.
    const stream = received.stream as unknown as AsyncIterable<Uint8Array>;
    return {
      pathname,
      etag: received.blob.etag,
      sizeBytes: received.blob.size,
      contentType: received.blob.contentType,
      stream,
    };
  }

  async stat(pathname: string): Promise<StoredPrivateBlob | null> {
    requirePrivatePathname(pathname);
    try {
      const remote = await this.sdk.head(pathname, { token: this.token });
      requireBlobMetadata(pathname, remote);
      return {
        pathname: remote.pathname,
        etag: remote.etag,
        contentType: remote.contentType,
        sizeBytes: remote.size,
      };
    } catch (error) {
      // Other failures (auth, network, wrong ETag, service outage) NEVER
      // mean the object was deleted. Retry later without marking DELETED.
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  }

  async delete(pathname: string, etag: string): Promise<void> {
    requirePrivatePathname(pathname);
    requireStrongEtag(etag);
    await this.sdk.del(pathname, { token: this.token, ifMatch: etag });
  }
}

export function createVercelPrivateBlobStorageRepository(
  config: PrivateVercelBlobConfig,
): VercelPrivateBlobStorageRepository {
  if (config.provider !== 'vercel-blob' || config.access !== 'private') {
    throw new Error('invalid-private-blob-provider');
  }
  return new VercelPrivateBlobStorageRepository(config.token);
}

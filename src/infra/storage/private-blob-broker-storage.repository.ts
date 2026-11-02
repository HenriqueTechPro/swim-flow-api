import { Readable } from 'node:stream';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  PrivateBlobStorageRepository,
  type PrivateBlobWrite,
  type ReadPrivateBlob,
  type StoredPrivateBlob,
} from '@/domain/uploads/application/repositories/private-blob-storage-repository';
import type { PrivateBlobBrokerConfig } from './private-blob-broker-config';

const MAX_BYTES = 2_800_000;
const AUD = 'swim-flow-private-media-staging-v2';
const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PATH = new RegExp(
  '^private/(?:profiles|students|teachers|parents)/' +
    UUID +
    '/' +
    UUID +
    '\\.jpg$',
);
const ETAG = /^"[A-Za-z0-9-]{1,120}"$/;

type Operation = 'put' | 'stat' | 'get' | 'delete';
type Receipt = {
  pathname: string;
  etag: string;
  sizeBytes: number;
  contentType: string;
  bytes?: string;
};

function validatePath(path: string): void {
  if (!PATH.test(path)) throw new Error('invalid-private-blob-pathname');
}
function validateEtag(etag: string): void {
  if (!ETAG.test(etag)) throw new Error('invalid-private-blob-etag');
}
function validateReceipt(value: unknown, pathname: string): Receipt {
  if (!value || typeof value !== 'object') {
    throw new Error('invalid-private-blob-receipt');
  }
  const v = value as Partial<Receipt>;
  if (
    v.pathname !== pathname ||
    v.contentType !== 'image/jpeg' ||
    !Number.isSafeInteger(v.sizeBytes) ||
    typeof v.sizeBytes !== 'number' ||
    v.sizeBytes < 8 ||
    v.sizeBytes > MAX_BYTES ||
    typeof v.etag !== 'string' ||
    !ETAG.test(v.etag)
  )
    throw new Error('invalid-private-blob-receipt');
  return v as Receipt;
}

/**
 * Render-only broker client. No Blob token or URL is exposed to the browser.
 * All authorization must run in Nest use cases before calling this transport.
 */
export class PrivateBlobBrokerStorageRepository extends PrivateBlobStorageRepository {
  constructor(
    private readonly config: PrivateBlobBrokerConfig,
    private readonly sendRequest: typeof fetch = fetch,
  ) {
    super();
    if (!config.sharedKey || !config.endpoint) {
      throw new Error('private-blob-broker-not-configured');
    }
  }

  private async request(
    operation: Operation,
    pathname: string,
    etag = '',
    bytes?: Uint8Array,
  ): Promise<{ status: number; value: unknown }> {
    validatePath(pathname);
    if (operation === 'get' || operation === 'delete') validateEtag(etag);
    const data = bytes ? Buffer.from(bytes) : Buffer.alloc(0);
    if (data.length > MAX_BYTES) {
      throw new Error('private-image-broker-limit-exceeded');
    }
    const body = {
      version: 2,
      audience: AUD,
      operation,
      pathname,
      etag,
      contentType: operation === 'put' ? 'image/jpeg' : '',
      bytes: operation === 'put' ? data.toString('base64') : '',
      issuedAtMs: Date.now(),
      nonce: randomUUID(),
    };
    const checksum = createHash('sha256')
      .update(Buffer.from(body.bytes, 'base64'))
      .digest('hex');
    const canonical = [
      'swimflow-private-media/v2',
      body.version,
      body.audience,
      body.operation,
      body.pathname,
      body.etag,
      body.contentType,
      body.issuedAtMs,
      body.nonce,
      checksum,
    ].join('\n');
    const signature = createHmac(
      'sha256',
      Buffer.from(this.config.sharedKey, 'base64url'),
    )
      .update(canonical)
      .digest('base64url');
    let response: Response;
    try {
      response = await this.sendRequest(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vercel-protection-bypass': this.config.protectionBypass,
        },
        body: JSON.stringify({ ...body, signature }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('private-blob-broker-network-unavailable');
    }

    if (response.status === 404) return { status: 404, value: null };
    if (!response.ok) {
      // Log only the remote HTTP status: never log response bodies, headers or image data.
      const safeStatus = Number.isInteger(response.status) &&
        response.status >= 400 && response.status <= 599
          ? response.status
          : 'unknown';
      throw new Error(`private-blob-broker-remote-http-${safeStatus}`);
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error('private-blob-broker-invalid-response');
    }
    return { status: response.status, value };
  }

  async put(input: PrivateBlobWrite): Promise<StoredPrivateBlob> {
    validatePath(input.pathname);
    if (
      input.contentType !== 'image/jpeg' ||
      !(input.bytes instanceof Uint8Array) ||
      input.bytes.length < 8 ||
      input.bytes.length > MAX_BYTES ||
      input.bytes[0] !== 0xff ||
      input.bytes[1] !== 0xd8 ||
      input.bytes[2] !== 0xff
    )
      throw new Error('invalid-private-broker-image');
    const result = await this.request('put', input.pathname, '', input.bytes);
    const stored = validateReceipt(result.value, input.pathname);
    if (stored.sizeBytes !== input.bytes.length) {
      throw new Error('invalid-private-blob-size');
    }
    return {
      pathname: stored.pathname,
      etag: stored.etag,
      sizeBytes: stored.sizeBytes,
      contentType: 'image/jpeg',
    };
  }

  async get(
    pathname: string,
    expectedEtag: string,
  ): Promise<ReadPrivateBlob | null> {
    const result = await this.request('get', pathname, expectedEtag);
    if (result.status === 404) return null;
    const read = validateReceipt(result.value, pathname);
    if (read.etag !== expectedEtag || typeof read.bytes !== 'string') {
      throw new Error('invalid-private-blob-read');
    }
    const bytes = Buffer.from(read.bytes, 'base64');
    if (
      bytes.length !== read.sizeBytes ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes[2] !== 0xff ||
      bytes.toString('base64') !== read.bytes
    )
      throw new Error('invalid-private-blob-read');

    return {
      pathname,
      etag: read.etag,
      contentType: 'image/jpeg',
      sizeBytes: bytes.length,
      stream: Readable.from([bytes]),
    };
  }

  async stat(pathname: string): Promise<StoredPrivateBlob | null> {
    const result = await this.request('stat', pathname);
    if (result.status === 404) return null;
    const stored = validateReceipt(result.value, pathname);
    return {
      pathname,
      etag: stored.etag,
      sizeBytes: stored.sizeBytes,
      contentType: 'image/jpeg',
    };
  }

  async delete(pathname: string, etag: string): Promise<void> {
    const result = await this.request('delete', pathname, etag);
    if (
      !result.value ||
      typeof result.value !== 'object' ||
      (result.value as { deleted?: unknown }).deleted !== true
    )
      throw new Error('invalid-private-blob-delete');
  }
}

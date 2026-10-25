import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import {
  createPrivateMediaS3Repository,
  S3PrivateMediaStorageRepository,
} from './s3-private-media-storage.repository';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const OBJECT_KEY = `private/students/${OWNER}/${OBJECT}.png`;
const ENDPOINT =
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com';
const CONFIG = {
  enabled: true,
  endpoint: ENDPOINT,
  region: 'auto',
  bucket: 'swim-flow-private-media',
  accessKeyId: 'fake-test-key',
  secretAccessKey: 'fake-test-secret',
};

function testRepository(
  respond: (method: string) => {
    statusCode: number;
    headers?: Record<string, string>;
    body?: Readable;
  } = (method) => {
    if (method === 'HEAD') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'image/png', 'content-length': '8', etag: ETAG },
      };
    }
    return {
      statusCode: 206,
      headers: { 'content-type': 'image/png' },
      body: Readable.from([Buffer.from([0x89, 0x50, 0x4e, 0x47])]),
    };
  },
) {
  const requests: Array<{ method: string; headers: Record<string, string> }> =
    [];
  const handle = jest.fn(
    async (request: { method: string; headers: Record<string, string> }) => {
      requests.push({ method: request.method, headers: request.headers });
      return { response: respond(request.method) };
    },
  );
  const client = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'fake-test-key',
      secretAccessKey: 'fake-secret',
    },
    requestHandler: { handle },
    maxAttempts: 1,
  });
  return {
    repository: new S3PrivateMediaStorageRepository(
      client,
      'swim-flow-private-media',
    ),
    requests,
    handle,
  };
}

describe('S3/R2 private media adapter (offline)', () => {
  it('stays opt-in: refuses disabled or incomplete settings', () => {
    expect(() =>
      createPrivateMediaS3Repository({ ...CONFIG, enabled: false }),
    ).toThrow('private-media-s3-not-enabled-or-incomplete');
    expect(() =>
      createPrivateMediaS3Repository({
        ...CONFIG,
        secretAccessKey: undefined,
      }),
    ).toThrow('private-media-s3-not-enabled-or-incomplete');
    expect(createPrivateMediaS3Repository(CONFIG)).toBeInstanceOf(
      S3PrivateMediaStorageRepository,
    );
  });

  it('signs 90s PUT with Content-Type bound to the private object key', async () => {
    const { repository, handle } = testRepository();
    const ticket = await repository.signUpload({
      objectKey: OBJECT_KEY,
      contentType: 'image/png',
    });
    const url = new URL(ticket.url);
    expect(ticket.method).toBe('PUT');
    expect(ticket.expiresInSeconds).toBe(90);
    expect(ticket.headers).toEqual({ 'Content-Type': 'image/png', 'If-None-Match': '*' });
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe(new URL(ENDPOINT).hostname);
    expect(url.pathname).toContain(
      '/swim-flow-private-media/private/students/',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('90');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-type',
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('if-none-match');
    expect(ticket.url).not.toContain(CONFIG.secretAccessKey);
    expect(handle).not.toHaveBeenCalled();
  });

  it('signs 60s GET without an object network request', async () => {
    const { repository, handle } = testRepository();
    const ticket = await repository.signDownload(OBJECT_KEY, ETAG);
    expect(ticket.expiresInSeconds).toBe(60);
    expect(ticket.headers).toEqual({ 'If-Match': ETAG });
    expect(new URL(ticket.url).searchParams.get('X-Amz-SignedHeaders')).toContain('if-match');
    expect(new URL(ticket.url).searchParams.get('X-Amz-Expires')).toBe('60');
    expect(handle).not.toHaveBeenCalled();
  });

  it('denies arbitrary keys and mismatched MIME types', async () => {
    const { repository, handle } = testRepository();
    await expect(repository.signDownload('../other-user.png', ETAG)).rejects.toThrow(
      'invalid-private-media-object-key',
    );
    await expect(
      repository.headObject('private/students/any.png'),
    ).rejects.toThrow('invalid-private-media-object-key');
    await expect(
      repository.signUpload({
        objectKey: OBJECT_KEY,
        contentType: 'image/gif',
      }),
    ).rejects.toThrow('invalid-private-media-content-type');
    expect(handle).not.toHaveBeenCalled();
  });

  it('HEAD reads observed metadata, GET reads only the requested range, DELETE works', async () => {
    const { repository, requests } = testRepository();
    await expect(repository.headObject(OBJECT_KEY)).resolves.toEqual({
      contentType: 'image/png',
      sizeBytes: 8,
      etag: ETAG,
    });
    const prefix = await repository.readPrefix(OBJECT_KEY, 12, ETAG);
    expect([...prefix]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    await repository.deleteObject(OBJECT_KEY);
    expect(requests.map((request) => request.method)).toEqual([
      'HEAD',
      'GET',
      'DELETE',
    ]);
    expect(requests[1].headers.range).toBe('bytes=0-11');
    expect(requests[1].headers['if-match']).toBe(ETAG);
  });

  it('HEAD treats 404 as absent, never hides other failures', async () => {
    const missing = testRepository(() => ({
      statusCode: 404,
      headers: { 'content-type': 'application/xml' },
      body: Readable.from(['<Error><Code>NoSuchKey</Code></Error>']),
    }));
    await expect(missing.repository.headObject(OBJECT_KEY)).resolves.toBeNull();
    const failure = testRepository(() => ({
      statusCode: 500,
      headers: { 'content-type': 'application/xml' },
      body: Readable.from(['<Error><Code>InternalError</Code></Error>']),
    }));
    await expect(failure.repository.headObject(OBJECT_KEY)).rejects.toThrow();
  });

  it('fails safely if Range is ignored or input limits are invalid', async () => {
    const oversized = testRepository(() => ({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      body: Readable.from([Buffer.alloc(65)]),
    }));
    await expect(
      oversized.repository.readPrefix(OBJECT_KEY, 12, ETAG),
    ).rejects.toThrow('unexpected-private-media-object-range');
    for (const limit of [0, -1, 65, 1.5, Number.NaN]) {
      await expect(
        oversized.repository.readPrefix(OBJECT_KEY, limit, ETAG),
      ).rejects.toThrow('invalid-private-media-read-range');
    }
  });
});

import {
  createVercelPrivateBlobStorageRepository,
  VercelPrivateBlobStorageRepository,
} from './private-vercel-blob-storage.repository';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const PATHNAME = `private/students/${OWNER}/${OBJECT}.png`;
const URL = `https://abcdefgh12345678.private.blob.vercel-storage.com/${PATHNAME}`;
const TOKEN = 'vercel_blob_rw_offline_dummy_token_12345';
const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const metadata = {
  pathname: PATHNAME,
  contentType: 'image/png',
  etag: ETAG,
  url: URL,
  size: PNG.byteLength,
};

function setup() {
  const sdk = {
    put: jest.fn().mockResolvedValue({
      pathname: PATHNAME,
      contentType: 'image/png',
      etag: ETAG,
      url: URL,
    }),
    head: jest.fn().mockResolvedValue(metadata),
    get: jest.fn().mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(PNG);
          controller.close();
        },
      }),
      blob: metadata,
    }),
    del: jest.fn().mockResolvedValue(undefined),
  };
  const adapter = new VercelPrivateBlobStorageRepository(
    TOKEN,
    sdk as unknown as ConstructorParameters<
      typeof VercelPrivateBlobStorageRepository
    >[1],
  );
  return { sdk, adapter };
}

describe('Private Vercel Blob transport (SDK mocked, zero cloud calls)', () => {
  it('never constructs an enabled adapter without server-only credentials', () => {
    expect(() => new VercelPrivateBlobStorageRepository('short')).toThrow(
      'invalid-private-blob-credentials',
    );
    expect(
      createVercelPrivateBlobStorageRepository({
        provider: 'vercel-blob',
        access: 'private',
        token: TOKEN,
      }),
    ).toBeInstanceOf(VercelPrivateBlobStorageRepository);
  });

  it('uploads under an opaque UUID path, prohibits overwrite, and verifies size/ETag with HEAD', async () => {
    const { sdk, adapter } = setup();
    await expect(
      adapter.put({
        pathname: PATHNAME,
        bytes: PNG,
        contentType: 'image/png',
      }),
    ).resolves.toEqual({
      pathname: PATHNAME,
      sizeBytes: PNG.byteLength,
      contentType: 'image/png',
      etag: ETAG,
    });
    expect(sdk.put).toHaveBeenCalledWith(PATHNAME, Buffer.from(PNG), {
      access: 'private',
      token: TOKEN,
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: 'image/png',
      cacheControlMaxAge: 60,
    });
    expect(sdk.head).toHaveBeenCalledWith(PATHNAME, { token: TOKEN });
    expect(JSON.stringify(sdk.put.mock.results)).not.toContain(TOKEN);
  });

  it('refuses paths and MIME mismatches before contacting the SDK', async () => {
    const { sdk, adapter } = setup();
    for (const bad of [
      '../../outside.png',
      'https://public.blob.vercel-storage.com/file.png',
      'private/students/untrusted/file.png',
      `private/students/${OWNER}/${OBJECT}.svg`,
    ]) {
      await expect(
        adapter.put({
          pathname: bad,
          bytes: PNG,
          contentType: 'image/png',
        }),
      ).rejects.toThrow('invalid-private-blob-pathname');
    }
    await expect(
      adapter.put({
        pathname: PATHNAME,
        bytes: PNG,
        contentType: 'image/gif',
      }),
    ).rejects.toThrow('invalid-private-blob-content-type');
    await expect(
      adapter.put({
        pathname: PATHNAME,
        bytes: PNG,
        contentType: 'image/png',
      }),
    ).resolves.toBeDefined();
    expect(sdk.put).toHaveBeenCalledTimes(1);
  });

  it('rejects empty, oversized, or invalid magic-byte payloads before PUT', async () => {
    const { sdk, adapter } = setup();
    for (const bytes of [
      new Uint8Array(0),
      new Uint8Array(5 * 1024 * 1024 + 1),
      Uint8Array.from([0x3c, 0x73, 0x76, 0x67]),
    ]) {
      await expect(
        adapter.put({ pathname: PATHNAME, bytes, contentType: 'image/png' }),
      ).rejects.toThrow();
    }
    expect(sdk.put).not.toHaveBeenCalled();
  });

  it('fails closed if SDK returns a public URL or unexpected metadata', async () => {
    const { sdk, adapter } = setup();
    sdk.put.mockResolvedValueOnce({
      pathname: PATHNAME,
      contentType: 'image/png',
      etag: ETAG,
      url: URL.replace('.private.', '.public.'),
    });
    await expect(
      adapter.put({ pathname: PATHNAME, bytes: PNG, contentType: 'image/png' }),
    ).rejects.toThrow('invalid-private-blob-host');
    expect(sdk.head).not.toHaveBeenCalled();

    sdk.head.mockResolvedValueOnce({ ...metadata, size: 9999 });
    await expect(
      adapter.put({ pathname: PATHNAME, bytes: PNG, contentType: 'image/png' }),
    ).rejects.toThrow('private-blob-object-changed-during-upload');
  });

  it('checks private remote presence and refuses spoofed/public HEAD metadata', async () => {
    const { sdk, adapter } = setup();
    await expect(adapter.stat(PATHNAME)).resolves.toEqual({
      pathname: PATHNAME,
      etag: ETAG,
      contentType: 'image/png',
      sizeBytes: PNG.byteLength,
    });
    expect(sdk.head).toHaveBeenCalledWith(PATHNAME, { token: TOKEN });
    sdk.head.mockResolvedValueOnce({ ...metadata, url: URL.replace('.private.', '.public.') });
    await expect(adapter.stat(PATHNAME)).rejects.toThrow(
      'invalid-private-blob-host',
    );
    expect(sdk.del).not.toHaveBeenCalled();
  });

  it('never interprets a network error as absence or completes a deletion', async () => {
    const { sdk, adapter } = setup();
    sdk.head.mockRejectedValueOnce(new Error('unexpected network failure'));
    await expect(adapter.stat(PATHNAME)).rejects.toThrow('unexpected network failure');
    await expect(adapter.stat('../fake')).rejects.toThrow('invalid-private-blob-pathname');
    expect(sdk.del).not.toHaveBeenCalled();
  });

  it('reads private streams only when the returned blob ETag matches the verified record', async () => {
    const { sdk, adapter } = setup();
    const result = await adapter.get(PATHNAME, ETAG);
    expect(result?.etag).toBe(ETAG);
    expect(result?.contentType).toBe('image/png');
    expect(sdk.get).toHaveBeenCalledWith(PATHNAME, {
      access: 'private',
      token: TOKEN,
      useCache: false,
      headers: { 'If-Match': ETAG },
    });
  });

  it('denies unexpected versions and never reads arbitrary or public paths', async () => {
    const { sdk, adapter } = setup();
    sdk.get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new ReadableStream(),
      blob: { ...metadata, etag: '"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"' },
    });
    await expect(adapter.get(PATHNAME, ETAG)).rejects.toThrow(
      'private-blob-object-version-changed',
    );
    await expect(adapter.get('../other.png', ETAG)).rejects.toThrow(
      'invalid-private-blob-pathname',
    );
    await expect(adapter.get(PATHNAME, 'bad-etag')).rejects.toThrow(
      'invalid-private-blob-etag',
    );
    expect(sdk.get).toHaveBeenCalledTimes(1);
  });

  it('returns null for missing private files; never turns a 304 into an accessible stream', async () => {
    const { sdk, adapter } = setup();
    sdk.get.mockResolvedValueOnce(null);
    await expect(adapter.get(PATHNAME, ETAG)).resolves.toBeNull();
    sdk.get.mockResolvedValueOnce({ statusCode: 304, stream: null });
    await expect(adapter.get(PATHNAME, ETAG)).rejects.toThrow(
      'invalid-private-blob-read-response',
    );
  });

  it('deletes only a validated UUID path with the exact conditional ETag', async () => {
    const { sdk, adapter } = setup();
    await adapter.delete(PATHNAME, ETAG);
    expect(sdk.del).toHaveBeenCalledWith(PATHNAME, {
      token: TOKEN,
      ifMatch: ETAG,
    });
    await expect(adapter.delete(PATHNAME, 'W/"weak"')).rejects.toThrow(
      'invalid-private-blob-etag',
    );
    await expect(adapter.delete('private/another.png', ETAG)).rejects.toThrow(
      'invalid-private-blob-pathname',
    );
    expect(sdk.del).toHaveBeenCalledTimes(1);
  });
});

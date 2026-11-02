import { loadPrivateBlobBrokerConfig } from './private-blob-broker-config';
import { PrivateBlobBrokerStorageRepository } from './private-blob-broker-storage.repository';

const KEY = 'A'.repeat(43);
const ENV: NodeJS.ProcessEnv = {
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
  SWIMFLOW_PRIVATE_BLOB_TRANSPORT: 'broker',
  SWIMFLOW_ENVIRONMENT: 'staging',
  BLOB_STORE_ID: 'store_PJZzrdBiiVcRyLHj',
  BLOB_RENDER_STAGING_STORE_NAME: 'swim-flow-private-media-staging',
  SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz',
  SWIMFLOW_BLOB_BROKER_URL:
    'https://swim-flow-private-blob-broker-staging-4adioi4xb.vercel.app/api/media',
  SWIMFLOW_BLOB_BROKER_SHARED_KEY: KEY,
  SWIMFLOW_BLOB_BROKER_BYPASS_TOKEN: 'B'.repeat(32),
};
const PATH =
  'private/students/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04, 0xff, 0xd9,
]);

describe('private Blob broker Render staging', () => {
  it('is OFF by default and rejects nonstaging identities/URLs/secrets', () => {
    expect(loadPrivateBlobBrokerConfig({})).toBeNull();
    for (const patch of [
      { SWIMFLOW_ENVIRONMENT: 'production' },
      { BLOB_STORE_ID: 'store_wrong' },
      { SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_wrong' },
      { VERCEL_OIDC_TOKEN: 'from-lab' },
      { BLOB_READ_WRITE_TOKEN: 'from-other-store' },
      {
        RENDER: 'true',
        RENDER_EXTERNAL_HOSTNAME: 'swim-flow-api.onrender.com',
      },
      { SWIMFLOW_BLOB_BROKER_URL: 'https://evil.invalid/api/media' },
      { SWIMFLOW_BLOB_BROKER_SHARED_KEY: undefined },
      { SWIMFLOW_BLOB_BROKER_BYPASS_TOKEN: undefined },
    ])
      expect(() => loadPrivateBlobBrokerConfig({ ...ENV, ...patch })).toThrow();
  });
  it('signs normalized JPEG PUT, does not expose key and checks response metadata', async () => {
    const mock = jest.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') {
          throw new Error('expected JSON broker body');
        }
        const payload = JSON.parse(init.body) as Record<string, unknown>;
        expect(payload.operation).toBe('put');
        expect(payload.pathname).toBe(PATH);
        expect(payload.signature).toEqual(expect.any(String));
        expect(JSON.stringify(payload)).not.toContain(KEY);
        return new Response(
          JSON.stringify({
            pathname: PATH,
            etag: ETAG,
            sizeBytes: JPEG.length,
            contentType: 'image/jpeg',
          }),
          { status: 200 },
        );
      },
    );
    const client = new PrivateBlobBrokerStorageRepository(
      loadPrivateBlobBrokerConfig(ENV)!,
      mock as typeof fetch,
    );
    await expect(
      client.put({ pathname: PATH, bytes: JPEG, contentType: 'image/jpeg' }),
    ).resolves.toEqual({
      pathname: PATH,
      etag: ETAG,
      sizeBytes: JPEG.length,
      contentType: 'image/jpeg',
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('accepts only matching ETag and normalized JPEG response', async () => {
    const fake = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            pathname: PATH,
            etag: ETAG,
            sizeBytes: JPEG.length,
            contentType: 'image/jpeg',
            bytes: JPEG.toString('base64'),
          }),
          { status: 200 },
        ),
    );
    const client = new PrivateBlobBrokerStorageRepository(
      loadPrivateBlobBrokerConfig(ENV)!,
      fake as typeof fetch,
    );
    const object = await client.get(PATH, ETAG);
    const pieces: Buffer[] = [];
    for await (const chunk of object!.stream) pieces.push(Buffer.from(chunk));
    expect(Buffer.concat(pieces)).toEqual(JPEG);
  });
  it('rejects oversized or forged images before remote fetch', async () => {
    const fake = jest.fn();
    const client = new PrivateBlobBrokerStorageRepository(
      loadPrivateBlobBrokerConfig(ENV)!,
      fake as typeof fetch,
    );
    await expect(
      client.put({
        pathname: PATH,
        bytes: Buffer.from('not-jpeg'),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow();
    await expect(
      client.put({
        pathname: PATH,
        bytes: Buffer.alloc(2_800_001),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow();
    await expect(client.get('../../outside.jpg', ETAG)).rejects.toThrow();
    await expect(client.delete(PATH, 'bad-etag')).rejects.toThrow();
    expect(fake).not.toHaveBeenCalled();
  });
  it('reports only remote HTTP status without logging response payload or headers', async () => {
    const fake = jest.fn(async () => new Response(
      JSON.stringify({ token: 'should-not-appear', details: 'sensitive' }),
      { status: 502, headers: { 'x-sensitive-header': 'should-not-appear' } },
    ));
    const client = new PrivateBlobBrokerStorageRepository(
      loadPrivateBlobBrokerConfig(ENV)!,
      fake as typeof fetch,
    );
    await expect(client.put({
      pathname: PATH,
      bytes: JPEG,
      contentType: 'image/jpeg',
    })).rejects.toThrow('private-blob-broker-remote-http-502');
    expect(fake).toHaveBeenCalledTimes(1);
  });

});

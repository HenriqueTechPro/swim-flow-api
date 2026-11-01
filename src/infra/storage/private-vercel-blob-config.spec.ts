import { loadPrivateVercelBlobConfig } from './private-vercel-blob-config';

const TOKEN =
  'vercel_blob_rw_PJZzrdBiiVcRyLHj_synthetic-placeholder-never-real';
const STAGING: NodeJS.ProcessEnv = {
  SWIMFLOW_ENVIRONMENT: 'staging',
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
  BLOB_STORE_ID: 'store_PJZzrdBiiVcRyLHj',
  BLOB_RENDER_STAGING_STORE_NAME: 'swim-flow-private-media-staging',
  BLOB_READ_WRITE_TOKEN: TOKEN,
  SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false',
  SWIMFLOW_R2_STORAGE_ENABLED: 'false',
};

describe('Private Vercel Blob Render staging activation boundary', () => {
  it('remains disabled even if a Vercel lab identity or real token is present', () => {
    expect(loadPrivateVercelBlobConfig({})).toBeNull();
    expect(
      loadPrivateVercelBlobConfig({
        ...STAGING,
        SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
      }),
    ).toBeNull();
    expect(
      loadPrivateVercelBlobConfig({
        BLOB_READ_WRITE_TOKEN: TOKEN,
        VERCEL_OIDC_TOKEN: 'local-lab-short-lived-token',
      }),
    ).toBeNull();
  });

  it('accepts explicitly enabled staging identity with matching static token', () => {
    expect(loadPrivateVercelBlobConfig(STAGING)).toEqual({
      provider: 'vercel-blob',
      access: 'private',
      token: TOKEN,
    });
    // Render staging uses NODE_ENV=production for optimized Nest builds.
    expect(
      loadPrivateVercelBlobConfig({
        ...STAGING,
        NODE_ENV: 'production',
        RENDER: 'true',
        RENDER_EXTERNAL_HOSTNAME: 'swim-flow-api-staging.onrender.com',
      }),
    ).toEqual({
      provider: 'vercel-blob',
      access: 'private',
      token: TOKEN,
    });
  });

  it('rejects malformed rollout flags without activating any adapter', () => {
    for (const value of ['1', 'TRUE', 'yes', '', 'enabled']) {
      expect(() =>
        loadPrivateVercelBlobConfig({
          ...STAGING,
          SWIMFLOW_PRIVATE_BLOB_ENABLED: value,
        }),
      ).toThrow('Invalid private Blob feature flag');
    }
  });

  it('rejects production, lab and any unmatched store identity', () => {
    for (const patch of [
      { SWIMFLOW_ENVIRONMENT: undefined },
      { SWIMFLOW_ENVIRONMENT: 'production' },
      {
        RENDER: 'true',
        RENDER_EXTERNAL_HOSTNAME: 'swim-flow-api.onrender.com',
      },
      { RENDER: 'true', RENDER_EXTERNAL_HOSTNAME: undefined },
      { BLOB_STORE_ID: undefined },
      { BLOB_STORE_ID: 'store_SdzpYKLzZL6WPLHh' },
      { BLOB_STORE_ID: 'store_pAtHIpXAePc3zgXg' },
      { BLOB_RENDER_STAGING_STORE_NAME: undefined },
      { BLOB_RENDER_STAGING_STORE_NAME: 'swim-flow-private-media' },
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({ ...STAGING, ...patch }),
      ).toThrow('Private Blob staging identity is missing or invalid');
    }
  });

  it('rejects missing, malformed, whitespace and wrong-store credentials', () => {
    for (const value of [
      undefined,
      '',
      'short',
      ' '.repeat(35),
      TOKEN + '\n',
      ' ' + TOKEN,
      'vercel_blob_rw_SdzpYKLzZL6WPLHh_production-secret-test-value',
      'vercel_blob_rw_pAtHIpXAePc3zgXg_disposable-secret-test-value',
      'eyJhbGciOiJIUzI1NiJ9.header.signature',
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({
          ...STAGING,
          BLOB_READ_WRITE_TOKEN: value,
        }),
      ).toThrow('Private Blob staging credential is missing or invalid');
    }
  });

  it('refuses accidental OIDC, lab, and remote Blob endpoint overrides', () => {
    for (const patch of [
      { VERCEL_OIDC_TOKEN: 'temporary-oidc' },
      { BLOB_SMOKE_READ_WRITE_TOKEN: 'disposable-token' },
      { BLOB_SMOKE_STORE_ID: 'store_pAtHIpXAePc3zgXg' },
      { VERCEL_BLOB_API_URL: 'https://wrong.invalid' },
      { NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://wrong.invalid' },
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({ ...STAGING, ...patch }),
      ).toThrow('Private Blob mixed or disposable credentials forbidden');
    }
  });

  it('rejects enabling multiple private storage backends', () => {
    for (const key of [
      'SWIMFLOW_R2_STORAGE_ENABLED',
      'SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED',
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({ ...STAGING, [key]: 'true' }),
      ).toThrow('Multiple private media backends cannot be enabled');
    }
  });

  it('never includes even a part of a credential in its error messages', () => {
    const secret = 'very-private-should-not-appear-in-error';
    try {
      loadPrivateVercelBlobConfig({
        ...STAGING,
        BLOB_READ_WRITE_TOKEN: secret + '\n',
      });
      throw new Error('Expected configuration to reject token');
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

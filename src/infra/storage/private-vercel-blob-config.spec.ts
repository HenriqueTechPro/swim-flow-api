import { loadPrivateVercelBlobConfig } from './private-vercel-blob-config';

const TOKEN = 'vercel_blob_rw_ci_dummy_token_only_12345';

describe('Private Vercel Blob configuration — server only and opt-in', () => {
  it('remains disabled by default, even if Vercel injected its token', () => {
    expect(loadPrivateVercelBlobConfig({})).toBeNull();
    expect(
      loadPrivateVercelBlobConfig({ BLOB_READ_WRITE_TOKEN: TOKEN }),
    ).toBeNull();
    expect(
      loadPrivateVercelBlobConfig({
        SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
      }),
    ).toBeNull();
  });

  it('accepts only an explicit enabled flag and valid server token', () => {
    for (const value of ['1', 'TRUE', 'yes', '', 'enabled']) {
      expect(() =>
        loadPrivateVercelBlobConfig({
          SWIMFLOW_PRIVATE_BLOB_ENABLED: value,
          BLOB_READ_WRITE_TOKEN: TOKEN,
        }),
      ).toThrow('Invalid private Blob feature flag');
    }
    expect(
      loadPrivateVercelBlobConfig({
        SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
        BLOB_READ_WRITE_TOKEN: TOKEN,
      }),
    ).toEqual({
      provider: 'vercel-blob',
      access: 'private',
      token: TOKEN,
    });
  });

  it('refuses empty, weak, or whitespace-polluted credentials', () => {
    for (const value of [
      undefined,
      '',
      'short',
      ' '.repeat(35),
      TOKEN + '\n',
      ' ' + TOKEN,
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({
          SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
          BLOB_READ_WRITE_TOKEN: value,
        }),
      ).toThrow('Private Blob token is missing or invalid');
    }
  });

  it('fails closed if S3 or R2 backend is also enabled', () => {
    for (const key of [
      'SWIMFLOW_R2_STORAGE_ENABLED',
      'SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED',
    ]) {
      expect(() =>
        loadPrivateVercelBlobConfig({
          SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
          BLOB_READ_WRITE_TOKEN: TOKEN,
          [key]: 'true',
        }),
      ).toThrow('Multiple private media backends');
    }
  });

  it('never interpolates any token in errors', () => {
    const secret = 'very-private-should-not-appear-in-error';
    try {
      loadPrivateVercelBlobConfig({
        SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true',
        BLOB_READ_WRITE_TOKEN: secret + '\n',
      });
      throw new Error('Expected config to reject token');
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

import { loadPrivateR2Config } from './private-r2-config';

const good = {
  SWIMFLOW_R2_STORAGE_ENABLED: 'true',
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_PRIVATE_BUCKET: 'swim-flow-private-images',
  R2_ACCESS_KEY_ID: 'example-access-id-not-real',
  R2_SECRET_ACCESS_KEY: 'example-secret-for-local-tests-not-real',
};

describe('Private R2 staged configuration — no connections or secrets', () => {
  it('defaults to disabled without requiring any R2 credentials', () => {
    expect(loadPrivateR2Config({})).toBeNull();
    expect(
      loadPrivateR2Config({
        SWIMFLOW_R2_STORAGE_ENABLED: 'false',
      }),
    ).toBeNull();
  });

  it('rejects flag typos instead of silently enabling public storage', () => {
    for (const value of ['TRUE', '1', 'yes', '', 'enabled']) {
      expect(() =>
        loadPrivateR2Config({
          SWIMFLOW_R2_STORAGE_ENABLED: value,
        }),
      ).toThrow('Invalid private object storage feature flag');
    }
  });

  it('requires explicitly scoped private R2 settings when enabled', () => {
    const config = loadPrivateR2Config(good);
    expect(config).toEqual({
      endpoint:
        'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'swim-flow-private-images',
      credentials: {
        accessKeyId: good.R2_ACCESS_KEY_ID,
        secretAccessKey: good.R2_SECRET_ACCESS_KEY,
      },
    });
    expect(config).not.toHaveProperty('publicUrl');
  });

  it('rejects missing values, invalid account hostnames and unsafe bucket paths', () => {
    for (const key of [
      'R2_ACCOUNT_ID',
      'R2_PRIVATE_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]) {
      expect(() => loadPrivateR2Config({ ...good, [key]: undefined })).toThrow(
        'Private object storage configuration is missing or invalid',
      );
    }
    for (const value of [
      'another.example.invalid',
      'https://r2.example.invalid',
      '../../etc/passwd',
      '01234567.r2.cloudflarestorage.com',
    ]) {
      expect(() =>
        loadPrivateR2Config({
          ...good,
          R2_ACCOUNT_ID: value,
        }),
      ).toThrow();
    }
    for (const value of [
      'bucket/another',
      'UPPERCASE',
      'b',
      '-bucket',
      'bucket-',
      'under_score',
    ]) {
      expect(() =>
        loadPrivateR2Config({
          ...good,
          R2_PRIVATE_BUCKET: value,
        }),
      ).toThrow();
    }
  });

  it('does not leak secrets into configuration errors', () => {
    const sensitive = 'PRIVATE-SECRET-MUST-NOT-APPEAR-IN-ERROR';
    try {
      loadPrivateR2Config({
        ...good,
        R2_ACCOUNT_ID: 'malformed-hostname',
        R2_SECRET_ACCESS_KEY: sensitive,
      });
      throw new Error('Expected invalid account ID to throw');
    } catch (error) {
      expect(String(error)).not.toContain(sensitive);
      expect(String(error)).toContain('Private object storage configuration');
    }
  });
});

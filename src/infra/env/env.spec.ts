describe('Render and Neon environment parsing', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
    jest.resetModules();
  });

  function loadEnv(overrides: Record<string, string | undefined>) {
    process.env = {
      ...previousEnv,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/test',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      JWT_ACCESS_SECRET: 'testing-jwt-access-secret-more-than-32-characters',
      API_CORS_ORIGIN: 'http://localhost:8080',
      SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: undefined,
      S3_ENDPOINT: undefined,
      S3_REGION: undefined,
      S3_BUCKET: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
      ...overrides,
    };
    jest.resetModules();
    return jest.requireActual<{
      env: {
        port: number;
        authSecureCookies: boolean;
        swaggerEnabled: boolean;
        localPasswordLoginEnabled: boolean;
        privateMediaS3: {
          enabled: boolean;
          endpoint: string | undefined;
          bucket: string | undefined;
        };
        supabaseUrl: string | undefined;
        supabasePublishableKey: string | undefined;
      };
    }>('./env').env;
  }

  it('allows Neon-only staging with no Supabase credentials', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      VITE_SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });

    expect(env.supabaseUrl).toBeUndefined();
    expect(env.supabasePublishableKey).toBeUndefined();
  });

  it('rejects invalid legacy Supabase URLs when explicitly configured', () => {
    expect(() => loadEnv({ VITE_SUPABASE_URL: 'not-a-valid-url' })).toThrow();
  });

  it('disables local password login unless explicitly opted in', () => {
    expect(
      loadEnv({ SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED: undefined })
        .localPasswordLoginEnabled,
    ).toBe(false);
    expect(
      loadEnv({ SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED: 'true' })
        .localPasswordLoginEnabled,
    ).toBe(true);
  });

  it('rejects malformed rollout flags', () => {
    expect(() =>
      loadEnv({ SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED: 'yes' }),
    ).toThrow();
  });

  it('reads explicit false booleans correctly', () => {
    const env = loadEnv({
      AUTH_SECURE_COOKIES: 'false',
      SWAGGER_ENABLED: 'false',
    });
    expect(env.authSecureCookies).toBe(false);
    expect(env.swaggerEnabled).toBe(false);
  });

  it('accepts true booleans', () => {
    const env = loadEnv({
      AUTH_SECURE_COOKIES: 'true',
      SWAGGER_ENABLED: 'true',
    });
    expect(env.authSecureCookies).toBe(true);
    expect(env.swaggerEnabled).toBe(true);
  });

  it('prioritizes Render PORT over NEST_API_PORT', () => {
    expect(loadEnv({ PORT: '10000', NEST_API_PORT: '3334' }).port).toBe(10000);
  });

  it('rejects invalid PORT values', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow();
  });

  it('falls back to the local port', () => {
    expect(loadEnv({ PORT: undefined, NEST_API_PORT: '3334' }).port).toBe(3334);
  });

  const validR2 = {
    S3_ENDPOINT:
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
    S3_REGION: 'auto',
    S3_BUCKET: 'swim-flow-private-media',
    S3_ACCESS_KEY_ID: 'fake-access-key',
    S3_SECRET_ACCESS_KEY: 'fake-secret-key',
  };

  it('keeps private media disabled by default, even if config is present', () => {
    const config = loadEnv(validR2).privateMediaS3;
    expect(config.enabled).toBe(false);
    expect(config.bucket).toBe('swim-flow-private-media');
  });

  it('fails closed if enabled without the entire server-side S3 config', () => {
    expect(() =>
      loadEnv({ SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' }),
    ).toThrow();
  });

  it('accepts complete R2 config only after explicit enablement', () => {
    const config = loadEnv({
      SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true',
      ...validR2,
    }).privateMediaS3;
    expect(config.enabled).toBe(true);
    expect(config.endpoint).toBe(validR2.S3_ENDPOINT);
  });

  it.each([
    'http://storage.example.com',
    'https://username:password@storage.example.com',
    'https://storage.example.com/private-bucket',
    'https://storage.example.com/?token=secret',
  ])('rejects insecure or non-origin S3 endpoint: %s', (endpoint) => {
    expect(() =>
      loadEnv({
        SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true',
        ...validR2,
        S3_ENDPOINT: endpoint,
      }),
    ).toThrow();
  });

  it('rejects malformed S3 rollout flags', () => {
    expect(() =>
      loadEnv({ SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'yes' }),
    ).toThrow();
  });
});

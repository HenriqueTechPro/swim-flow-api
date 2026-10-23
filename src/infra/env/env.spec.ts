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
      ...overrides,
    };
    jest.resetModules();
    return jest.requireActual<{
      env: {
        port: number;
        authSecureCookies: boolean;
        swaggerEnabled: boolean;
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
});

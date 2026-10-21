import { prepareE2EEnvironment } from './prepare-e2e-environment';

describe('E2E environment production gate', () => {
  it('refuses production before it can be overwritten', () => {
    expect(() => prepareE2EEnvironment('production')).toThrow(
      'Refusing to run E2E tests with NODE_ENV=production',
    );
  });

  it('allows test and development runs without changing the caller env', () => {
    expect(prepareE2EEnvironment('test')).toBe('test');
    expect(prepareE2EEnvironment('development')).toBe('test');
    expect(prepareE2EEnvironment(undefined)).toBe('test');
  });
});

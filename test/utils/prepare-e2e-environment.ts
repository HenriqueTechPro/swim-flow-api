/** Fail closed: never disguise production as a test environment. */
export function prepareE2EEnvironment(current: string | undefined): 'test' {
  if (current === 'production') {
    throw new Error('Refusing to run E2E tests with NODE_ENV=production');
  }
  return 'test';
}

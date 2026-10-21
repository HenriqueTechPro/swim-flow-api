'use strict';

// Any test creating credentials must fail closed before opening Prisma clients.
function assertDisposablePostgres(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes') {
    throw new Error('Disposable database consent missing.');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    let url;
    try {
      url = new URL(env[key]);
    } catch {
      throw new Error('Both disposable database connection URLs must be configured.');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.pathname !== '/swimflow' ||
        (url.port && url.port !== '5432') ||
        !url.username || !url.password) {
      throw new Error('REFUSING any non-local PostgreSQL target.');
    }
  }
}
module.exports = { assertDisposablePostgres };

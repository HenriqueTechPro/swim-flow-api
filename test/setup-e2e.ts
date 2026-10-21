import 'reflect-metadata';
import { prepareE2EEnvironment } from './utils/prepare-e2e-environment';

beforeAll(() => {
  // Refuse production BEFORE writing NODE_ENV=test. A previous unconditional
  // assignment bypassed the disposable PostgreSQL suite's production check.
  process.env.NODE_ENV = prepareE2EEnvironment(process.env.NODE_ENV);
});

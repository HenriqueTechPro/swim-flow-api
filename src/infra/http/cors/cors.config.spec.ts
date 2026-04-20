import {describe, it,expect, jest} from "@jest/globals"
import {
  createCorsOptions,
  isCorsOriginAllowed,
  parseCorsOrigins,
} from './cors.config';

describe('cors.config', () => {
  it('parses multiple CORS origins with trimming and deduplication', () => {
    expect(
      parseCorsOrigins(
        'http://localhost:8080/, https://app.example.com, http://localhost:8080',
      ),
    ).toEqual(['http://localhost:8080', 'https://app.example.com']);
  });

  it('allows requests without an Origin header', () => {
    expect(
      isCorsOriginAllowed(undefined, ['http://localhost:8080']),
    ).toBe(true);
  });

  it('allows configured origins even when the request has a trailing slash', () => {
    expect(
      isCorsOriginAllowed('http://localhost:8080/', [
        'http://localhost:8080',
      ]),
    ).toBe(true);
  });

  it('blocks origins outside the allowlist', () => {
    expect(
      isCorsOriginAllowed('https://malicious.example.com', [
        'http://localhost:8080',
      ]),
    ).toBe(false);
  });

  it('returns a CORS callback that accepts allowed origins', () => {
    const corsOptions = createCorsOptions(['http://localhost:8080']);
    const callback = jest.fn();

    corsOptions.origin('http://localhost:8080', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('returns a CORS callback that rejects disallowed origins', () => {
    const corsOptions = createCorsOptions(['http://localhost:8080']);
    const callback = jest.fn();

    corsOptions.origin('https://malicious.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });
});

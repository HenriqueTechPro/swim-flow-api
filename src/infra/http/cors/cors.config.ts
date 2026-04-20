const TRAILING_SLASHES = /\/+$/;

export function normalizeCorsOrigin(origin: string) {
  return origin.trim().replace(TRAILING_SLASHES, '');
}

export function parseCorsOrigins(rawOrigins: string) {
  return Array.from(
    new Set(
      rawOrigins
        .split(',')
        .map(normalizeCorsOrigin)
        .filter((origin) => origin.length > 0),
    ),
  );
}

export function isCorsOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigins: string[],
) {
  if (!requestOrigin) {
    return true;
  }

  return allowedOrigins.includes(normalizeCorsOrigin(requestOrigin));
}

export function createCorsOptions(allowedOrigins: string[]) {
  return {
    credentials: true,
    optionsSuccessStatus: 204,
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (isCorsOriginAllowed(requestOrigin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  };
}

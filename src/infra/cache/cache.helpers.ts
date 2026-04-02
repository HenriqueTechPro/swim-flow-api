import type { PaginatedResult } from '@/domain/shared/pagination/pagination-params'
import type { CacheRepository } from './cache-repository'

export const buildPaginatedCacheKey = (prefix: string, page: number, perPage: number) =>
  `${prefix}:list:${page}:${perPage}`

export const rememberPaginatedResult = async <T>(
  cache: CacheRepository,
  key: string,
  ttlInSeconds: number,
  loader: () => Promise<PaginatedResult<T>>,
) => {
  const cached = await cache.get(key)

  if (cached) {
    return JSON.parse(cached) as PaginatedResult<T>
  }

  const result = await loader()
  await cache.set(key, JSON.stringify(result), ttlInSeconds)

  return result
}
